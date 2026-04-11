import { RoomUser, ChatMessage, RoomStatePayload, ConnectionStatePayload } from './types';

export class RoomManager {
	private roomId: string | null = null;
	private users: RoomUser[] = [];
	private isReadOnly = false;
	private isCreator = false;
	private chatMessages: ChatMessage[] = [];

	async createRoom(userName?: string) {
		// Implement room creation logic
	}

	async joinRoom(roomId: string, userName?: string) {
		// Implement join logic
	}

	async copyRoomId(roomId: string | null) {
		// Implement copy logic
	}

	async copyRoomLink(roomId: string | null) {
		// Implement copy link logic
	}

	async leaveRoom() {
		// Implement leave logic
	}

	async sendChatMessage(text: string) {
		// Implement chat logic
	}

	async insertSelectionAsCode() {
		// Implement code insert logic
	}

	async copyCode(text: string) {
		// Implement code copy logic
	}

	async setReadOnly(isReadOnly: boolean) {
		this.isReadOnly = isReadOnly;
		// Implement read-only logic
	}

	async followUser(userId: string | null) {
		// Implement follow logic
	}
}
