import { RoomUser } from './types';

export class RoomManager {
	private users: RoomUser[] = [];
	private roomId: string | null = null;

	public setRoom(roomId: string, users: RoomUser[]): void {
		this.roomId = roomId;
		this.users = users;
	}

	public getUsers(): RoomUser[] {
		return this.users;
	}

	public getRoomId(): string | null {
		return this.roomId;
	}

	public clear(): void {
		this.roomId = null;
		this.users = [];
	}
}

