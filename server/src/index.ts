import http from 'http';
import express from 'express';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import * as Y from 'yjs';
import { messageSync } from 'y-websocket';

const PORT = Number(process.env.PORT ?? 3000);
const PORT_EXPLICITLY_SET = typeof process.env.PORT === 'string' && process.env.PORT.trim().length > 0;
const ROOM_MIN = 1000;
const ROOM_MAX = 9999;

const SOCKET_EVENTS = {
  CREATE_ROOM: 'create-room',
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  CODE_CHANGE: 'code-change',
  CURSOR_CHANGE: 'cursor-change',
  CHAT_MESSAGE: 'chat-message',
  CONNECTION_STATE: 'connection-state',
  ROOM_SNAPSHOT: 'room-snapshot',
  ROOM_STATE: 'room-state',
  FILE_CHANGE: 'file-change',
  SET_READONLY: 'set-readonly',
  READONLY_CHANGED: 'readonly-changed',
  ROOM_ERROR: 'room-error',
} as const;

type CursorPosition = {
  line: number;
  character: number;
};

type RoomUser = {
  id: string;
  name: string;
  color: string;
  cursor?: CursorPosition;
  currentFile?: string;
};

type ChatMessage = {
  id: string;
  roomId: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  text: string;
  timestamp: string;
  system?: boolean;
};

type RoomStatePayload = {
  roomId: string;
  users: RoomUser[];
  isReadOnly: boolean;
};

type ConnectionStatePayload = {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  roomId: string | null;
  userCount: number;
  message?: string;
};

type ServerToClientEvents = {
  [SOCKET_EVENTS.ROOM_SNAPSHOT]: (payload: { roomId: string; documentState: Uint8Array; users: RoomUser[] }) => void;
  [SOCKET_EVENTS.ROOM_STATE]: (payload: RoomStatePayload) => void;
  [SOCKET_EVENTS.CODE_CHANGE]: (payload: { roomId: string; update: Uint8Array }) => void;
  [SOCKET_EVENTS.CURSOR_CHANGE]: (payload: { roomId: string; userId: string; cursor: CursorPosition | null }) => void;
  [SOCKET_EVENTS.CHAT_MESSAGE]: (message: ChatMessage) => void;
  [SOCKET_EVENTS.CONNECTION_STATE]: (payload: ConnectionStatePayload) => void;
  [SOCKET_EVENTS.READONLY_CHANGED]: (payload: { roomId: string; isReadOnly: boolean }) => void;
  [SOCKET_EVENTS.ROOM_ERROR]: (payload: { roomId: string; code: 'READ_ONLY' | 'UNKNOWN'; message: string }) => void;
};

type ClientToServerEvents = {
  [SOCKET_EVENTS.CREATE_ROOM]: (payload: { userName: string }, callback: (response: { roomId: string }) => void) => void;
  [SOCKET_EVENTS.JOIN_ROOM]: (
    payload: { roomId: string; userName: string; initialState?: Uint8Array; initialContent?: string },
    callback: (
      response:
        | { roomId: string; users: RoomUser[]; isReadOnly: boolean; isCreator: boolean }
        | { error: string },
    ) => void,
  ) => void;
  [SOCKET_EVENTS.LEAVE_ROOM]: (payload: { roomId: string }) => void;
  [SOCKET_EVENTS.CODE_CHANGE]: (payload: { roomId: string; update: Uint8Array }) => void;
  [SOCKET_EVENTS.CURSOR_CHANGE]: (payload: { roomId: string; cursor: CursorPosition | null }) => void;
  [SOCKET_EVENTS.CHAT_MESSAGE]: (payload: { roomId: string; text: string }) => void;
  [SOCKET_EVENTS.FILE_CHANGE]: (payload: { roomId: string; userId: string; fileName: string }) => void;
  [SOCKET_EVENTS.SET_READONLY]: (payload: { roomId: string; isReadOnly: boolean }) => void;
};

type SocketData = {
  roomId?: string;
  userName?: string;
  color?: string;
};

type RoomData = {
  id: string;
  doc: Y.Doc;
  users: Map<string, RoomUser>;
  refs: number;
  isReadOnly: boolean;
  creatorId: string;
};

const app = express();
app.get('/health', (_req, res) => {
  res.json({ ok: true, yWebsocketMessageType: messageSync });
});

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>(server, {
  cors: {
    origin: '*',
  },
  transports: ['websocket'],
});

const rooms = new Map<string, RoomData>();

function randomRoomId(): string {
  return `${Math.floor(Math.random() * (ROOM_MAX - ROOM_MIN + 1)) + ROOM_MIN}`;
}

function generateRoomId(): string {
  let roomId = randomRoomId();
  while (rooms.has(roomId)) {
    roomId = randomRoomId();
  }
  return roomId;
}

function buildColor(seed: string): string {
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 360;
  }

  return `hsl(${hash}, 75%, 55%)`;
}

function getOrCreateRoom(roomId: string, creatorId?: string): RoomData {
  const existing = rooms.get(roomId);
  if (existing) {
    return existing;
  }

  const room: RoomData = {
    id: roomId,
    doc: new Y.Doc(),
    users: new Map<string, RoomUser>(),
    refs: 0,
    isReadOnly: false,
    creatorId: creatorId ?? '',
  };

  room.doc.getText('content');
  rooms.set(roomId, room);
  return room;
}

function serializeUsers(room: RoomData): RoomUser[] {
  return Array.from(room.users.values());
}

function emitRoomState(room: RoomData): void {
  io.to(room.id).emit(SOCKET_EVENTS.ROOM_STATE, {
    roomId: room.id,
    users: serializeUsers(room),
    isReadOnly: room.isReadOnly,
  });
}

function leaveCurrentRoom(socket: Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>): RoomData | undefined {
  const currentRoomId = socket.data.roomId;
  if (!currentRoomId) {
    return undefined;
  }

  const room = rooms.get(currentRoomId);
  socket.leave(currentRoomId);
  socket.data.roomId = undefined;

  if (!room) {
    return undefined;
  }

  room.users.delete(socket.id);
  room.refs = Math.max(0, room.refs - 1);

  if (room.users.size === 0 && room.refs === 0) {
    room.doc.destroy();
    rooms.delete(room.id);
    return room;
  }

  emitRoomState(room);
  return room;
}

io.on('connection', (socket) => {
  socket.emit(SOCKET_EVENTS.CONNECTION_STATE, {
    status: 'connected',
    roomId: socket.data.roomId ?? null,
    userCount: 0,
  });

  socket.on(SOCKET_EVENTS.CREATE_ROOM, (_payload, callback) => {
    const roomId = generateRoomId();
    getOrCreateRoom(roomId, socket.id);
    callback({ roomId });
  });

  socket.on(SOCKET_EVENTS.JOIN_ROOM, (payload, callback) => {
    const roomId = payload.roomId.trim().toUpperCase();
    const userName = payload.userName.trim() || `Guest-${socket.id.slice(0, 4)}`;

    const existingRoom = rooms.get(roomId);
    if (!existingRoom) {
      callback({
        error: `Room ${roomId} was not found on this server. Verify codus.serverUrl and room code.`,
      });
      return;
    }

    leaveCurrentRoom(socket);

    const room = existingRoom;
    if (!room.creatorId) {
      room.creatorId = socket.id;
    }

    socket.join(roomId);

    socket.data.roomId = roomId;
    socket.data.userName = userName;
    socket.data.color = socket.data.color ?? buildColor(socket.id);

    const user: RoomUser = {
      id: socket.id,
      name: userName,
      color: socket.data.color,
    };

    room.users.set(socket.id, user);
    room.refs += 1;

    const sharedText = room.doc.getText('content');
    const docIsEmpty = sharedText.length === 0;

    if (docIsEmpty && payload.initialContent && payload.initialContent.length > 0) {
      sharedText.insert(0, payload.initialContent);
    } else if (payload.initialState && payload.initialState.length > 0) {
      Y.applyUpdate(room.doc, payload.initialState);
    }

    const users = serializeUsers(room);
    callback({
      roomId,
      users,
      isReadOnly: room.isReadOnly,
      isCreator: room.creatorId === socket.id,
    });

    socket.emit(SOCKET_EVENTS.ROOM_SNAPSHOT, {
      roomId,
      documentState: Y.encodeStateAsUpdate(room.doc),
      users,
    });

    emitRoomState(room);

    socket.emit(SOCKET_EVENTS.CONNECTION_STATE, {
      status: 'connected',
      roomId,
      userCount: users.length,
    });
  });

  socket.on(SOCKET_EVENTS.LEAVE_ROOM, () => {
    const previousRoom = socket.data.roomId;
    leaveCurrentRoom(socket);

    socket.emit(SOCKET_EVENTS.CONNECTION_STATE, {
      status: 'disconnected',
      roomId: previousRoom ?? null,
      userCount: 0,
    });
  });

  socket.on(SOCKET_EVENTS.CODE_CHANGE, (payload) => {
    const room = rooms.get(payload.roomId);
    if (!room) {
      return;
    }

    if (room.isReadOnly) {
      socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
        roomId: room.id,
        code: 'READ_ONLY',
        message: 'This room is in read-only mode. The host has locked editing.',
      });
      return;
    }

    Y.applyUpdate(room.doc, payload.update);
    socket.to(payload.roomId).emit(SOCKET_EVENTS.CODE_CHANGE, payload);
  });

  socket.on(SOCKET_EVENTS.CURSOR_CHANGE, (payload) => {
    const room = rooms.get(payload.roomId);
    if (!room) {
      return;
    }

    const user = room.users.get(socket.id);
    if (user) {
      user.cursor = payload.cursor ?? undefined;
      room.users.set(socket.id, user);
    }

    socket.to(payload.roomId).emit(SOCKET_EVENTS.CURSOR_CHANGE, {
      roomId: payload.roomId,
      userId: socket.id,
      cursor: payload.cursor,
    });

    emitRoomState(room);
  });

  socket.on(SOCKET_EVENTS.FILE_CHANGE, (payload) => {
    const room = rooms.get(payload.roomId);
    if (!room) {
      return;
    }

    const user = room.users.get(socket.id);
    if (!user) {
      return;
    }

    user.currentFile = payload.fileName;
    room.users.set(socket.id, user);
    emitRoomState(room);
  });

  socket.on(SOCKET_EVENTS.SET_READONLY, (payload) => {
    const room = rooms.get(payload.roomId);
    if (!room) {
      return;
    }

    if (room.creatorId !== socket.id) {
      return;
    }

    room.isReadOnly = payload.isReadOnly;
    io.to(room.id).emit(SOCKET_EVENTS.READONLY_CHANGED, {
      roomId: room.id,
      isReadOnly: room.isReadOnly,
    });
    emitRoomState(room);
  });

  socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (payload) => {
    const room = rooms.get(payload.roomId);
    if (!room) {
      return;
    }

    const user = room.users.get(socket.id);
    if (!user) {
      return;
    }

    const message: ChatMessage = {
      id: uuidv4(),
      roomId: payload.roomId,
      authorId: socket.id,
      authorName: user.name,
      authorColor: user.color,
      text: payload.text,
      timestamp: new Date().toISOString(),
    };

    io.to(payload.roomId).emit(SOCKET_EVENTS.CHAT_MESSAGE, message);
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket);
  });
});

function listenWithPortFallback(startPort: number): void {
  const maxAttempts = PORT_EXPLICITLY_SET ? 1 : 20;

  const tryListen = (attempt: number): void => {
    const port = startPort + attempt;

    const onError = (error: NodeJS.ErrnoException): void => {
      server.off('listening', onListening);

      if (error.code === 'EADDRINUSE' && attempt + 1 < maxAttempts) {
        tryListen(attempt + 1);
        return;
      }

      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Set PORT to a free port and restart Codus server.`);
      } else {
        console.error(error);
      }

      process.exitCode = 1;
    };

    const onListening = (): void => {
      server.off('error', onError);
      console.log(`Codus server running on port ${port}`);
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port);
  };

  tryListen(0);
}

listenWithPortFallback(PORT);
