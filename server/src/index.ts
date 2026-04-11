import http from 'http';
import express from 'express';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import * as Y from 'yjs';
import { messageSync } from 'y-websocket';

const PORT = Number(process.env.PORT ?? 3000);
const ROOM_MIN = 1000;
const ROOM_MAX = 9999;

type CursorPosition = {
  line: number;
  character: number;
};

type RoomUser = {
  id: string;
  name: string;
  color: string;
  cursor?: CursorPosition;
};

type ChatMessage = {
  id: string;
  roomId: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  text: string;
  timestamp: string;
};

type RoomStatePayload = {
  roomId: string;
  users: RoomUser[];
};

type ConnectionStatePayload = {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  roomId: string | null;
  userCount: number;
  message?: string;
};

type ServerToClientEvents = {
  'room-snapshot': (payload: { roomId: string; documentState: Uint8Array; users: RoomUser[] }) => void;
  'room-state': (payload: RoomStatePayload) => void;
  'code-change': (payload: { roomId: string; update: Uint8Array }) => void;
  'cursor-change': (payload: { roomId: string; userId: string; cursor: CursorPosition | null }) => void;
  'chat-message': (message: ChatMessage) => void;
  'connection-state': (payload: ConnectionStatePayload) => void;
};

type ClientToServerEvents = {
  'create-room': (payload: { userName: string }, callback: (response: { roomId: string }) => void) => void;
  'join-room': (
    payload: { roomId: string; userName: string; initialState?: Uint8Array },
    callback: (response: { roomId: string; users: RoomUser[] }) => void,
  ) => void;
  'leave-room': (payload: { roomId: string }) => void;
  'code-change': (payload: { roomId: string; update: Uint8Array }) => void;
  'cursor-change': (payload: { roomId: string; cursor: CursorPosition | null }) => void;
  'chat-message': (payload: { roomId: string; text: string }) => void;
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

function getOrCreateRoom(roomId: string): RoomData {
  const existing = rooms.get(roomId);
  if (existing) {
    return existing;
  }

  const room: RoomData = {
    id: roomId,
    doc: new Y.Doc(),
    users: new Map<string, RoomUser>(),
    refs: 0,
  };

  room.doc.getText('content');
  rooms.set(roomId, room);
  return room;
}

function serializeUsers(room: RoomData): RoomUser[] {
  return Array.from(room.users.values());
}

function emitRoomState(room: RoomData): void {
  io.to(room.id).emit('room-state', {
    roomId: room.id,
    users: serializeUsers(room),
  });
}

function leaveCurrentRoom(socket: Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>): void {
  const currentRoomId = socket.data.roomId;
  if (!currentRoomId) {
    return;
  }

  const room = rooms.get(currentRoomId);
  socket.leave(currentRoomId);
  socket.data.roomId = undefined;

  if (!room) {
    return;
  }

  room.users.delete(socket.id);
  room.refs = Math.max(0, room.refs - 1);

  if (room.users.size === 0 && room.refs === 0) {
    room.doc.destroy();
    rooms.delete(room.id);
    return;
  }

  emitRoomState(room);
}

io.on('connection', (socket) => {
  socket.emit('connection-state', {
    status: 'connected',
    roomId: socket.data.roomId ?? null,
    userCount: 0,
  });

  socket.on('create-room', (_payload, callback) => {
    const roomId = generateRoomId();
    getOrCreateRoom(roomId);
    callback({ roomId });
  });

  socket.on('join-room', (payload, callback) => {
    const roomId = payload.roomId.trim().toUpperCase();
    const userName = payload.userName.trim() || `Guest-${socket.id.slice(0, 4)}`;

    leaveCurrentRoom(socket);

    const room = getOrCreateRoom(roomId);
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

    if (payload.initialState && payload.initialState.length > 0) {
      Y.applyUpdate(room.doc, payload.initialState);
    }

    const users = serializeUsers(room);
    callback({ roomId, users });

    socket.emit('room-snapshot', {
      roomId,
      documentState: Y.encodeStateAsUpdate(room.doc),
      users,
    });

    emitRoomState(room);

    socket.emit('connection-state', {
      status: 'connected',
      roomId,
      userCount: users.length,
    });
  });

  socket.on('leave-room', () => {
    const previousRoom = socket.data.roomId;
    leaveCurrentRoom(socket);

    socket.emit('connection-state', {
      status: 'disconnected',
      roomId: previousRoom ?? null,
      userCount: 0,
    });
  });

  socket.on('code-change', (payload) => {
    const room = rooms.get(payload.roomId);
    if (!room) {
      return;
    }

    Y.applyUpdate(room.doc, payload.update);
    socket.to(payload.roomId).emit('code-change', payload);
  });

  socket.on('cursor-change', (payload) => {
    const room = rooms.get(payload.roomId);
    if (!room) {
      return;
    }

    const user = room.users.get(socket.id);
    if (user) {
      user.cursor = payload.cursor ?? undefined;
      room.users.set(socket.id, user);
    }

    socket.to(payload.roomId).emit('cursor-change', {
      roomId: payload.roomId,
      userId: socket.id,
      cursor: payload.cursor,
    });

    emitRoomState(room);
  });

  socket.on('chat-message', (payload) => {
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

    io.to(payload.roomId).emit('chat-message', message);
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket);
  });
});

server.listen(PORT, () => {
  // y-websocket dependency is included for interoperability with Yjs ecosystem clients.
  console.log(`Collaboration server running on port ${PORT}`);
});
