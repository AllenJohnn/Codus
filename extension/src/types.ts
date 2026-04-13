export type CursorPosition = {
	line: number;
	character: number;
};

export type RoomUser = {
	id: string;
	name: string;
	color: string;
	cursor?: CursorPosition;
	currentFile?: string;
};

export type ChatMessage = {
	id: string;
	roomId: string;
	authorId: string;
	authorName: string;
	authorColor: string;
	text: string;
	timestamp: string;
	system?: boolean;
};

export type RoomStatePayload = {
	roomId: string | null;
	users: RoomUser[];
	isReadOnly: boolean;
};

export type ConnectionStatePayload = {
	status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
	roomId: string | null;
	userCount: number;
	message?: string;
};
