import http from 'http';
import path from 'path';
import express from 'express';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import * as Y from 'yjs';
import {
  ChatMessage,
  CodeChangePayload,
  ConnectionStatePayload,
  CursorPosition,
  HeartbeatPayload,
  RoomErrorCode,
  RoomSnapshotPayload,
  RoomStatePayload,
  RoomUser,
  SOCKET_EVENTS,
} from '../../shared/types';

const PORT = Number(process.env.PORT ?? 3000);
const PORT_EXPLICITLY_SET = typeof process.env.PORT === 'string' && process.env.PORT.trim().length > 0;
const ROOM_MIN = 1000;
const ROOM_MAX = 9999;
const MAX_USERS_PER_ROOM = Number(process.env.MAX_USERS_PER_ROOM ?? 20);
const CODE_CHANGE_MIN_INTERVAL_MS = 16;
const ROOM_TTL_MS = Number(process.env.ROOM_TTL_MS ?? 10 * 60 * 1000);
const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 12000;
const ROOM_TOKEN = process.env.CODUS_ROOM_TOKEN?.trim();
const ALLOWED_ORIGINS = (process.env.CODUS_ALLOWED_ORIGINS ?? '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const ALLOW_ANY_ORIGIN = ALLOWED_ORIGINS.includes('*');

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

type ServerToClientEvents = {
  [SOCKET_EVENTS.ROOM_SNAPSHOT]: (payload: RoomSnapshotPayload) => void;
  [SOCKET_EVENTS.ROOM_STATE]: (payload: RoomStatePayload) => void;
  [SOCKET_EVENTS.CODE_CHANGE]: (payload: CodeChangePayload) => void;
  [SOCKET_EVENTS.CURSOR_CHANGE]: (payload: { roomId: string; userId: string; cursor: CursorPosition | null }) => void;
  [SOCKET_EVENTS.CHAT_MESSAGE]: (message: ChatMessage) => void;
  [SOCKET_EVENTS.CONNECTION_STATE]: (payload: ConnectionStatePayload) => void;
  [SOCKET_EVENTS.READONLY_CHANGED]: (payload: { roomId: string; isReadOnly: boolean }) => void;
  [SOCKET_EVENTS.ROOM_ERROR]: (payload: { roomId: string; code: RoomErrorCode; message: string }) => void;
  [SOCKET_EVENTS.HEARTBEAT_PING]: (payload: HeartbeatPayload) => void;
};

type ClientToServerEvents = {
  [SOCKET_EVENTS.CREATE_ROOM]: (
    payload: { userName: string },
    callback: (response: { roomId: string } | { error: string }) => void,
  ) => void;
  [SOCKET_EVENTS.JOIN_ROOM]: (
    payload: { roomId: string; userName: string; roomToken?: string; initialState?: Uint8Array; initialContent?: string },
    callback: (
      response:
        | { roomId: string; users: RoomUser[]; isReadOnly: boolean; isCreator: boolean }
        | { error: string },
    ) => void,
  ) => void;
  [SOCKET_EVENTS.LEAVE_ROOM]: (payload: { roomId: string }) => void;
  [SOCKET_EVENTS.CODE_CHANGE]: (payload: CodeChangePayload) => void;
  [SOCKET_EVENTS.CURSOR_CHANGE]: (payload: { roomId: string; cursor: CursorPosition | null }) => void;
  [SOCKET_EVENTS.CHAT_MESSAGE]: (payload: { roomId: string; text: string }) => void;
  [SOCKET_EVENTS.FILE_CHANGE]: (payload: { roomId: string; userId: string; fileName: string }) => void;
  [SOCKET_EVENTS.SET_READONLY]: (payload: { roomId: string; isReadOnly: boolean }) => void;
  [SOCKET_EVENTS.HEARTBEAT_PONG]: (payload: HeartbeatPayload) => void;
};

type SocketData = {
  roomId?: string;
  userName?: string;
  color?: string;
  lastCodeChangeAt?: number;
};

type RoomData = {
  id: string;
  doc: Y.Doc;
  users: Map<string, RoomUser>;
  presence: Map<string, number>;
  refs: number;
  isReadOnly: boolean;
  creatorId: string;
  sequence: number;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  expiryTimer: ReturnType<typeof setTimeout> | null;
};

const app = express();
app.get('/', (_req, res) => {
  res.json({
    service: 'codus-server',
    ok: true,
    message: 'Codus collaboration server is running.',
    health: '/health',
  });
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>(server, {
  cors: {
    origin: (origin, callback) => {
      if (ALLOW_ANY_ORIGIN || !origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS origin not allowed'));
    },
  },
  transports: ['websocket', 'polling'],
});

const rooms = new Map<string, RoomData>();

function randomRoomId(): string {
  return `${Math.floor(Math.random() * (ROOM_MAX - ROOM_MIN + 1)) + ROOM_MIN}`;
}

function generateRoomId(): string {
  for (let attempt = 0; attempt < ROOM_MAX - ROOM_MIN + 1; attempt += 1) {
    const roomId = randomRoomId();
    if (!rooms.has(roomId)) {
      return roomId;
    }
  }

  throw new Error('No available room IDs. Server is at capacity.');
}

function buildColor(seed: string): string {
  let hash = 5381;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(index);
    hash >>>= 0;
  }

  const hue = hash % 360;
  return `hsl(${hue}, 70%, 58%)`;
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
    presence: new Map<string, number>(),
    refs: 0,
    isReadOnly: false,
    creatorId: creatorId ?? '',
    sequence: 0,
    heartbeatTimer: null,
    expiryTimer: null,
  };

  room.doc.getText('content');
  rooms.set(roomId, room);
  return room;
}

function destroyRoom(room: RoomData): void {
  if (room.heartbeatTimer) {
    clearInterval(room.heartbeatTimer);
    room.heartbeatTimer = null;
  }

  if (room.expiryTimer) {
    clearTimeout(room.expiryTimer);
    room.expiryTimer = null;
  }

  room.doc.destroy();
  rooms.delete(room.id);
}

function scheduleRoomExpiry(room: RoomData): void {
  if (room.expiryTimer) {
    clearTimeout(room.expiryTimer);
  }

  room.expiryTimer = setTimeout(() => {
    if (room.users.size === 0 && room.refs === 0) {
      destroyRoom(room);
    }
  }, ROOM_TTL_MS);
}

function clearRoomExpiry(room: RoomData): void {
  if (!room.expiryTimer) {
    return;
  }

  clearTimeout(room.expiryTimer);
  room.expiryTimer = null;
}

function touchPresence(room: RoomData, userId: string): void {
  room.presence.set(userId, Date.now());
}

function startHeartbeat(room: RoomData): void {
  if (room.heartbeatTimer) {
    return;
  }

  room.heartbeatTimer = setInterval(() => {
    const now = Date.now();
    const staleUsers: string[] = [];

    for (const [userId, lastSeenAt] of room.presence.entries()) {
      if (now - lastSeenAt > HEARTBEAT_TIMEOUT_MS) {
        staleUsers.push(userId);
      }
    }

    for (const userId of staleUsers) {
      room.presence.delete(userId);
      room.users.delete(userId);
      room.refs = Math.max(0, room.refs - 1);
      io.sockets.sockets.get(userId)?.leave(room.id);
    }

    if (staleUsers.length > 0) {
      emitRoomState(room);
      if (room.users.size === 0) {
        scheduleRoomExpiry(room);
      }
    }

    io.to(room.id).emit(SOCKET_EVENTS.HEARTBEAT_PING, {
      roomId: room.id,
      timestamp: now,
    });
  }, HEARTBEAT_INTERVAL_MS);
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
  room.presence.delete(socket.id);
  room.refs = Math.max(0, room.refs - 1);

  if (room.users.size === 0) {
    scheduleRoomExpiry(room);
  }

  if (room.users.size === 0 && room.refs === 0) {
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
    try {
      // Room IDs are always 4 numeric digits.
      const roomId = generateRoomId();
      getOrCreateRoom(roomId, socket.id);
      callback({ roomId });
    } catch (error) {
      callback({ error: error instanceof Error ? error.message : 'Unable to create a room right now.' });
    }
  });

  socket.on(SOCKET_EVENTS.JOIN_ROOM, (payload, callback) => {
    const roomId = payload.roomId.trim();
    const userName = payload.userName.trim() || `Guest-${socket.id.slice(0, 4)}`;

    if (ROOM_TOKEN && payload.roomToken !== ROOM_TOKEN) {
      socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
        roomId,
        code: 'UNKNOWN',
        message: 'Room token is invalid for this server.',
      });
      callback({ error: 'Room token is invalid for this server.' });
      return;
    }

    if (!/^\d{4}$/.test(roomId)) {
      socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
        roomId,
        code: 'INVALID_ROOM',
        message: 'Room code must be exactly 4 digits.',
      });
      callback({ error: 'Room code must be exactly 4 digits.' });
      return;
    }

    const existingRoom = rooms.get(roomId);
    if (!existingRoom) {
      socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
        roomId,
        code: 'ROOM_NOT_FOUND',
        message: `Room ${roomId} was not found on this server. Verify codus.serverUrl and room code.`,
      });
      callback({
        error: `Room ${roomId} was not found on this server. Verify codus.serverUrl and room code.`,
      });
      return;
    }

    leaveCurrentRoom(socket);

    const room = existingRoom;
    clearRoomExpiry(room);

    if (room.users.size >= MAX_USERS_PER_ROOM) {
      callback({ error: `Room ${roomId} is full (max ${MAX_USERS_PER_ROOM} users).` });
      return;
    }

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
  touchPresence(room, socket.id);
    room.refs += 1;
  startHeartbeat(room);

    const sharedText = room.doc.getText('content');
    const docIsEmpty = sharedText.length === 0;

    if (docIsEmpty) {
      if (payload.initialState && payload.initialState.length > 0) {
        Y.applyUpdate(room.doc, payload.initialState);
      } else if (payload.initialContent && payload.initialContent.length > 0) {
        sharedText.insert(0, payload.initialContent);
      }
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
      hasDocumentState: !docIsEmpty,
      sequence: room.sequence,
      users,
      isReadOnly: room.isReadOnly,
      isCreator: room.creatorId === socket.id,
    });

    emitRoomState(room);

    socket.emit(SOCKET_EVENTS.CONNECTION_STATE, {
      status: 'connected',
      roomId,
      userCount: users.length,
    });
  });

  socket.on(SOCKET_EVENTS.LEAVE_ROOM, (_payload) => {
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

    touchPresence(room, socket.id);

    const now = Date.now();
    if ((socket.data.lastCodeChangeAt ?? 0) + CODE_CHANGE_MIN_INTERVAL_MS > now) {
      return;
    }
    socket.data.lastCodeChangeAt = now;

    if (room.isReadOnly) {
      socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
        roomId: room.id,
        code: 'READ_ONLY',
        message: 'This room is in read-only mode. The host has locked editing.',
      });
      return;
    }

    if (payload.sequence <= room.sequence) {
      return;
    }

    if (payload.sequence !== room.sequence + 1) {
      socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
        roomId: room.id,
        code: 'UNKNOWN',
        message: 'Edit sequence out of order. Resynchronizing room state.',
      });
      socket.emit(SOCKET_EVENTS.ROOM_SNAPSHOT, {
        roomId: room.id,
        documentState: Y.encodeStateAsUpdate(room.doc),
        hasDocumentState: true,
        sequence: room.sequence,
        users: serializeUsers(room),
        isReadOnly: room.isReadOnly,
        isCreator: room.creatorId === socket.id,
      });
      return;
    }

    Y.applyUpdate(room.doc, payload.update);
    room.sequence = payload.sequence;
    socket.to(payload.roomId).emit(SOCKET_EVENTS.CODE_CHANGE, payload);
  });

  socket.on(SOCKET_EVENTS.CURSOR_CHANGE, (payload) => {
    const room = rooms.get(payload.roomId);
    if (!room) {
      return;
    }

    touchPresence(room, socket.id);

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
  });

  socket.on(SOCKET_EVENTS.FILE_CHANGE, (payload) => {
    const room = rooms.get(payload.roomId);
    if (!room) {
      return;
    }

    touchPresence(room, socket.id);

    const user = room.users.get(socket.id);
    if (!user) {
      return;
    }

    const fileName = String(payload.fileName ?? '').trim().replace(/\\/g, '/');
    if (!fileName || fileName.length > 260 || fileName.includes('..') || path.isAbsolute(fileName)) {
      return;
    }

    user.currentFile = fileName;
    room.users.set(socket.id, user);
    emitRoomState(room);
  });

  socket.on(SOCKET_EVENTS.SET_READONLY, (payload) => {
    const room = rooms.get(payload.roomId);
    if (!room) {
      return;
    }

    touchPresence(room, socket.id);

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

    touchPresence(room, socket.id);

    const user = room.users.get(socket.id);
    if (!user) {
      return;
    }

    // Validate message size (max 1000 characters to prevent abuse)
    const text = (payload.text || '').trim();
    if (text.length === 0 || text.length > 1000) {
      return;
    }

    const message: ChatMessage = {
      id: uuidv4(),
      roomId: payload.roomId,
      authorId: socket.id,
      authorName: user.name,
      authorColor: user.color,
      text,
      timestamp: new Date().toISOString(),
    };

    io.to(payload.roomId).emit(SOCKET_EVENTS.CHAT_MESSAGE, message);
  });

  socket.on(SOCKET_EVENTS.HEARTBEAT_PONG, (payload) => {
    const room = rooms.get(payload.roomId);
    if (!room) {
      return;
    }

    touchPresence(room, socket.id);
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket);
  });
});

function listenWithPortFallback(startPort: number): void {
  const maxAttempts = PORT_EXPLICITLY_SET ? 1 : 20;

  const tryListen = (attempt: number): void => {
    const port = startPort + attempt;

    const onError = (error: Error & { code?: string }): void => {
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
