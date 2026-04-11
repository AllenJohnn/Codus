import * as vscode from 'vscode';
import { io, Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, ConnectionStatePayload, CursorPosition, RoomStatePayload, RoomUser } from './types';

export interface RoomManagerHandlers {
	onConnectionState: (payload: ConnectionStatePayload) => void;
	onRoomState: (payload: RoomStatePayload) => void;
	onChatMessage: (message: ChatMessage) => void;
	onRemoteEdit: (roomId: string) => void;
	onRemoteCursor: (roomId: string, userId: string) => void;
}

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

function buildColor(seed: string): string {
	let hash = 0;
	for (const character of seed) {
		hash = (hash * 31 + character.charCodeAt(0)) % 360;
	}
	return `hsl(${hash}, 75%, 55%)`;
}

function getFullDocumentRange(document: vscode.TextDocument): vscode.Range {
	const lastLineIndex = Math.max(document.lineCount - 1, 0);
	const lastLine = document.lineAt(lastLineIndex);
	return new vscode.Range(0, 0, lastLineIndex, lastLine.text.length);
}

function encodeText(text: string): Uint8Array {
	const doc = new Y.Doc();
	doc.getText('content').insert(0, text);
	return Y.encodeStateAsUpdate(doc);
}

function toConnectionErrorMessage(error: Error, serverUrl: string): string {
	const raw = (error.message || '').toLowerCase();
	if (raw.includes('websocket') || raw.includes('xhr poll error') || raw.includes('transport')) {
		return `Cannot connect to collaboration server at ${serverUrl}. Start the server (cd server && npm run start) and confirm collab.serverUrl.`;
	}

	return error.message;
}

export class RoomManager {
	private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

	private serverUrl = 'http://127.0.0.1:3000';

	private document: Y.Doc | null = null;

	private sharedText: Y.Text | null = null;

	private activeRoomId: string | null = null;

	private activeDocumentUri: string | null = null;

	private roomUsers: RoomUser[] = [];

	private readonly sessionId = uuidv4();

	private userName = `Guest-${this.sessionId.slice(0, 4).toUpperCase()}`;

	private readonly userColor = buildColor(this.sessionId);

	private isApplyingRemoteUpdate = false;

	private readonly suppressedDocumentUris = new Set<string>();

	private readonly handlers: RoomManagerHandlers;

	private static readonly ACK_TIMEOUT_MS = 5000;

	private connectionState: ConnectionStatePayload = {
		status: 'disconnected',
		roomId: null,
		userCount: 0,
	};

	public constructor(handlers: RoomManagerHandlers) {
		this.handlers = handlers;
	}

	public getUserName(): string {
		return this.userName;
	}

	public getUserColor(): string {
		return this.userColor;
	}

	public getActiveRoomId(): string | null {
		return this.activeRoomId;
	}

	public getUsers(): RoomUser[] {
		return [...this.roomUsers];
	}

	public getLocalPeerId(): string | null {
		return this.socket?.id ?? null;
	}

	public async createRoom(userName: string): Promise<string> {
		const editor = vscode.window.activeTextEditor;
		this.userName = userName;

		await this.ensureSocket();
		const roomId = await this.requestCreateRoom(userName);
		const initialState = encodeText(editor?.document.getText() ?? '');
		await this.joinRoomInternal(roomId, userName, initialState);
		return roomId;
	}

	public async joinRoom(roomId: string, userName: string): Promise<void> {
		this.userName = userName;
		await this.ensureSocket();
		await this.joinRoomInternal(roomId, userName);
	}

	public async leaveRoom(): Promise<void> {
		if (!this.socket || !this.activeRoomId) {
			this.resetRoomState();
			this.emitConnectionState({ status: 'disconnected', roomId: null, userCount: 0 });
			return;
		}

		this.socket.emit('leave-room', { roomId: this.activeRoomId });
		this.resetRoomState();
		this.emitConnectionState({ status: 'disconnected', roomId: null, userCount: 0 });
	}

	public async sendChatMessage(text: string): Promise<void> {
		if (!this.socket || !this.activeRoomId) {
			throw new Error('Join a room before sending chat messages.');
		}

		this.socket.emit('chat-message', { roomId: this.activeRoomId, text });
	}

	public async sendCursor(cursor: CursorPosition | null): Promise<void> {
		if (!this.socket || !this.activeRoomId) {
			return;
		}

		this.socket.emit('cursor-change', { roomId: this.activeRoomId, cursor });
	}

	public handleTextDocumentChange(event: vscode.TextDocumentChangeEvent): void {
		if (!this.sharedText || !this.activeRoomId || !this.activeDocumentUri) {
			return;
		}

		if (event.document.uri.toString() !== this.activeDocumentUri) {
			return;
		}

		if (this.isApplyingRemoteUpdate || this.suppressedDocumentUris.has(this.activeDocumentUri)) {
			return;
		}

		for (const change of event.contentChanges) {
			const offset = change.rangeOffset;
			if (change.rangeLength > 0) {
				this.sharedText.delete(offset, change.rangeLength);
			}

			if (change.text.length > 0) {
				this.sharedText.insert(offset, change.text);
			}
		}
	}

	public async syncActiveEditor(editor?: vscode.TextEditor): Promise<void> {
		const targetEditor = editor ?? vscode.window.activeTextEditor;
		if (!targetEditor || !this.sharedText || !this.activeDocumentUri) {
			return;
		}

		if (targetEditor.document.uri.toString() !== this.activeDocumentUri) {
			return;
		}

		const sharedValue = this.sharedText.toString();
		if (targetEditor.document.getText() === sharedValue) {
			return;
		}

		const documentUri = targetEditor.document.uri.toString();
		this.suppressedDocumentUris.add(documentUri);
		try {
			await targetEditor.edit((editBuilder) => {
				editBuilder.replace(getFullDocumentRange(targetEditor.document), sharedValue);
			});
		} finally {
			this.suppressedDocumentUris.delete(documentUri);
		}
	}

	public setActiveEditor(editor: vscode.TextEditor | undefined): void {
		this.activeDocumentUri = editor?.document.uri.toString() ?? null;
		if (editor) {
			void this.syncActiveEditor(editor);
		}
	}

	private async joinRoomInternal(roomId: string, userName: string, initialState?: Uint8Array): Promise<void> {
		if (this.activeRoomId && this.activeRoomId !== roomId) {
			await this.leaveRoom();
		}

		this.initializeDocument();
		this.activeRoomId = roomId;
		this.emitConnectionState({ status: 'connecting', roomId, userCount: this.roomUsers.length });

		const response = await this.requestJoinRoom(roomId, userName, initialState);
		this.roomUsers = response.users;
		this.emitRoomState({ roomId: response.roomId, users: response.users });
		this.emitConnectionState({ status: 'connected', roomId: response.roomId, userCount: response.users.length });
	}

	private async ensureSocket(): Promise<void> {
		if (this.socket) {
			if (this.socket.connected) {
				return;
			}

			this.socket.connect();
			await this.waitForSocketConnect();
			return;
		}

		this.serverUrl = vscode.workspace.getConfiguration('collab').get<string>('serverUrl') ?? 'http://127.0.0.1:3000';
		this.socket = io(this.serverUrl, {
			autoConnect: false,
			transports: ['websocket', 'polling'],
		});

		this.registerSocketHandlers();
		this.socket.connect();
		await this.waitForSocketConnect();
	}

	private registerSocketHandlers(): void {
		if (!this.socket) {
			return;
		}

		const socket = this.socket;

		socket.on('connect', () => {
			this.emitConnectionState({
				status: 'connected',
				roomId: this.activeRoomId,
				userCount: this.roomUsers.length,
			});
		});

		socket.on('disconnect', () => {
			this.emitConnectionState({
				status: 'disconnected',
				roomId: this.activeRoomId,
				userCount: this.roomUsers.length,
			});
		});

		socket.io.on('reconnect_attempt', () => {
			this.emitConnectionState({
				status: 'reconnecting',
				roomId: this.activeRoomId,
				userCount: this.roomUsers.length,
			});
		});

		socket.io.on('reconnect', () => {
			if (this.activeRoomId) {
				void this.joinRoomInternal(this.activeRoomId, this.userName);
			}
		});

		socket.on('connect_error', (error: Error) => {
			this.emitConnectionState({
				status: 'error',
				roomId: this.activeRoomId,
				userCount: this.roomUsers.length,
				message: toConnectionErrorMessage(error, this.serverUrl),
			});
		});

		socket.on('room-snapshot', async (payload) => {
			if (payload.roomId !== this.activeRoomId) {
				return;
			}

			this.roomUsers = payload.users;
			this.emitRoomState({ roomId: payload.roomId, users: payload.users });
			await this.applyRemoteUpdate(payload.documentState);
		});

		socket.on('room-state', (payload) => {
			if (payload.roomId !== this.activeRoomId) {
				return;
			}

			this.roomUsers = payload.users;
			this.emitRoomState(payload);
		});

		socket.on('code-change', async (payload) => {
			if (payload.roomId !== this.activeRoomId) {
				return;
			}

			await this.applyRemoteUpdate(payload.update);
			this.handlers.onRemoteEdit(payload.roomId);
		});

		socket.on('cursor-change', (payload) => {
			if (payload.roomId !== this.activeRoomId) {
				return;
			}

			this.roomUsers = this.roomUsers.map((user) => {
				if (user.id !== payload.userId) {
					return user;
				}

				return {
					...user,
					cursor: payload.cursor ?? undefined,
				};
			});

			this.handlers.onRemoteCursor(payload.roomId, payload.userId);
			this.emitRoomState({ roomId: payload.roomId, users: [...this.roomUsers] });
		});

		socket.on('chat-message', (message) => {
			if (message.roomId !== this.activeRoomId) {
				return;
			}

			this.handlers.onChatMessage(message);
		});
	}

	private waitForSocketConnect(): Promise<void> {
		if (!this.socket) {
			return Promise.reject(new Error('Socket has not been created.'));
		}

		const socket = this.socket;

		if (socket.connected) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			const cleanup = (): void => {
				socket.off('connect', onConnect);
				socket.off('connect_error', onError);
			};

			const onConnect = (): void => {
				cleanup();
				resolve();
			};

			const onError = (error: Error): void => {
				cleanup();
				reject(new Error(toConnectionErrorMessage(error, this.serverUrl)));
			};

			socket.once('connect', onConnect);
			socket.once('connect_error', onError);
		});
	}

	private requestCreateRoom(userName: string): Promise<string> {
		if (!this.socket) {
			return Promise.reject(new Error('Socket has not been created.'));
		}

		const socket = this.socket;

		return new Promise<string>((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error(`Timed out creating room via ${this.serverUrl}.`));
			}, RoomManager.ACK_TIMEOUT_MS);

			socket.emit('create-room', { userName }, (response) => {
				clearTimeout(timeout);
				if (!response.roomId) {
					reject(new Error('Server returned an empty room id.'));
					return;
				}

				resolve(response.roomId);
			});

			socket.once('connect_error', (error: Error) => {
				clearTimeout(timeout);
				reject(new Error(toConnectionErrorMessage(error, this.serverUrl)));
			});
		});
	}

	private requestJoinRoom(
		roomId: string,
		userName: string,
		initialState?: Uint8Array,
	): Promise<{ roomId: string; users: RoomUser[] }> {
		if (!this.socket) {
			return Promise.reject(new Error('Socket has not been created.'));
		}

		const socket = this.socket;

		return new Promise<{ roomId: string; users: RoomUser[] }>((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error(`Timed out joining room ${roomId} via ${this.serverUrl}.`));
			}, RoomManager.ACK_TIMEOUT_MS);

			socket.emit(
				'join-room',
				{
					roomId,
					userName,
					initialState,
				},
				(response) => {
					clearTimeout(timeout);
					resolve(response);
				},
			);

			socket.once('connect_error', (error: Error) => {
				clearTimeout(timeout);
				reject(new Error(toConnectionErrorMessage(error, this.serverUrl)));
			});
		});
	}

	private initializeDocument(): void {
		this.document?.destroy();
		this.document = new Y.Doc();
		this.sharedText = this.document.getText('content');

		this.document.on('update', (update: Uint8Array) => {
			if (!this.socket || !this.activeRoomId || this.isApplyingRemoteUpdate) {
				return;
			}

			this.socket.emit('code-change', {
				roomId: this.activeRoomId,
				update,
			});
		});
	}

	private async applyRemoteUpdate(update: Uint8Array): Promise<void> {
		if (!this.document || !this.sharedText || !this.activeDocumentUri) {
			return;
		}

		this.isApplyingRemoteUpdate = true;
		try {
			Y.applyUpdate(this.document, update);
			await this.syncActiveEditor();
		} finally {
			this.isApplyingRemoteUpdate = false;
		}
	}

	private emitConnectionState(payload: ConnectionStatePayload): void {
		this.connectionState = payload;
		this.handlers.onConnectionState(payload);
	}

	private emitRoomState(payload: RoomStatePayload): void {
		this.handlers.onRoomState(payload);
		this.connectionState = {
			...this.connectionState,
			roomId: payload.roomId,
			userCount: payload.users.length,
		};
		this.handlers.onConnectionState(this.connectionState);
	}

	private resetRoomState(): void {
		this.activeRoomId = null;
		this.activeDocumentUri = null;
		this.roomUsers = [];
		this.document?.destroy();
		this.document = null;
		this.sharedText = null;
	}
}
