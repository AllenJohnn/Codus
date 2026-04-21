export const SOCKET_EVENTS = {
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