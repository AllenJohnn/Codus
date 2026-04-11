// User in a collaborative room
export interface RoomUser {
	id: string;
	name: string;
	color: string;
	cursor?: {
		line: number;
		character: number;
	};
	currentFile?: string;
}

// Chat message structure
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

// Connection state sent to webview
export interface ConnectionStatePayload {
	status: 'connected' | 'disconnected' | 'reconnecting';
	roomId: string | null;
	userCount: number;
}

// Room state sent to webview
export interface RoomStatePayload {
	roomId: string | null;
	users: RoomUser[];
	isReadOnly: boolean;
	isCreator: boolean;
}
