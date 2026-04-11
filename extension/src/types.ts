export interface CursorPosition {
	line: number;
	character: number;
}

export interface RoomUser {
	id: string;
	name: string;
	color: string;
	cursor?: CursorPosition;
}

export interface ChatMessage {
	id: string;
	roomId: string;
	authorId: string;
	authorName: string;
	authorColor: string;
	text: string;
	timestamp: string;
}

export interface RoomStatePayload {
	roomId: string | null;
	users: RoomUser[];
}

export interface ConnectionStatePayload {
	status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
	roomId: string | null;
	userCount: number;
	message?: string;
}
