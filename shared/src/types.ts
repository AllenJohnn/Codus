export type RoomErrorCode = 'READ_ONLY' | 'UNKNOWN' | 'ROOM_NOT_FOUND' | 'INVALID_ROOM' | 'RATE_LIMITED';

export interface CodeChangePayload {
  roomId: string;
  update: Uint8Array;
  sequence: number;
}

export interface HeartbeatPayload {
  roomId: string;
  timestamp: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface CursorPosition {
  line: number;
  character: number;
}

export interface RoomUser {
  id: string;
  name: string;
  color: string;
  cursor?: CursorPosition;
  currentFile?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  text: string;
  timestamp: string;
  system?: boolean;
}

export interface RoomStatePayload {
  roomId: string | null;
  users: RoomUser[];
  isReadOnly?: boolean;
  isCreator?: boolean;
}

export interface RoomSnapshotPayload {
  roomId: string;
  documentState: Uint8Array;
  hasDocumentState: boolean;
  sequence: number;
  users: RoomUser[];
  isReadOnly: boolean;
  isCreator: boolean;
}

export interface ConnectionStatePayload {
  status: ConnectionStatus;
  roomId: string | null;
  userCount: number;
  message?: string;
}
