import * as fs from 'fs';
import * as net from 'net';
import { spawn } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { io, Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid';
import {
  ChatMessage,
  ConnectionStatePayload,
  CursorPosition,
  RoomSnapshotPayload,
  RoomStatePayload,
  RoomUser,
  SOCKET_EVENTS,
} from './types';

export interface RoomManagerHandlers {
  onConnectionState: (payload: ConnectionStatePayload) => void;
  onRoomState: (payload: RoomStatePayload) => void;
  onChatMessage: (message: ChatMessage) => void;
  onRemoteEdit: (roomId: string) => void;
  onRemoteCursor: (roomId: string, userId: string) => void;
}

type ServerToClientEvents = {
  [SOCKET_EVENTS.ROOM_SNAPSHOT]: (payload: RoomSnapshotPayload) => void;
  [SOCKET_EVENTS.ROOM_STATE]: (payload: { roomId: string; users: RoomUser[]; isReadOnly?: boolean }) => void;
  [SOCKET_EVENTS.CODE_CHANGE]: (payload: { roomId: string; update: Uint8Array }) => void;
  [SOCKET_EVENTS.CURSOR_CHANGE]: (payload: { roomId: string; userId: string; cursor: CursorPosition | null }) => void;
  [SOCKET_EVENTS.CHAT_MESSAGE]: (message: ChatMessage) => void;
  [SOCKET_EVENTS.CONNECTION_STATE]: (payload: ConnectionStatePayload) => void;
  [SOCKET_EVENTS.READONLY_CHANGED]: (payload: { roomId: string; isReadOnly: boolean }) => void;
  [SOCKET_EVENTS.ROOM_ERROR]: (payload: { roomId: string; code: 'READ_ONLY' | 'UNKNOWN'; message: string }) => void;
};

type ClientToServerEvents = {
  [SOCKET_EVENTS.CREATE_ROOM]: (
    payload: { userName: string },
    callback: (response: { roomId: string } | { error: string }) => void,
  ) => void;
  [SOCKET_EVENTS.JOIN_ROOM]: (
    payload: { roomId: string; userName: string; initialState?: Uint8Array; initialContent?: string },
    callback: (
      response:
        | { roomId: string; users: RoomUser[]; isReadOnly: boolean; isCreator: boolean }
        | { error: string },
    ) => void,
  ) => void;
  [SOCKET_EVENTS.LEAVE_ROOM]: (payload: { roomId: string }) => void;
  [SOCKET_EVENTS.CODE_CHANGE]: (payload: { roomId: string; update: Uint8Array }) => void;
  [SOCKET_EVENTS.CURSOR_CHANGE]: (payload: { roomId: string; cursor: CursorPosition | null }) => void;
  [SOCKET_EVENTS.CHAT_MESSAGE]: (payload: { roomId: string; text: string }) => void;
  [SOCKET_EVENTS.FILE_CHANGE]: (payload: { roomId: string; userId: string; fileName: string }) => void;
  [SOCKET_EVENTS.SET_READONLY]: (payload: { roomId: string; isReadOnly: boolean }) => void;
};

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

function toServerUnavailableMessage(serverUrl: string): string {
  return `Codus: Could not connect to server at ${serverUrl}.\nStart the Codus server and try again, or update codus.serverUrl in settings.`;
}

function shouldUsePortMessage(error: Error): boolean {
  const raw = (error.message || '').toLowerCase();
  return raw.includes('eaddrinuse') || raw.includes('econnrefused') || raw.includes('websocket') || raw.includes('transport');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isTcpPortOccupied(host: string, port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = new net.Socket();

    const done = (occupied: boolean): void => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(occupied);
    };

    socket.setTimeout(500);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

async function isHttpEndpointReachable(serverUrl: string): Promise<boolean> {
  try {
    const url = new URL('/health', serverUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    try {
      const response = await fetch(url, { signal: controller.signal });
      return response.ok;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

async function waitForEndpoint(serverUrl: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isHttpEndpointReachable(serverUrl)) {
      return true;
    }

    await delay(250);
  }

  return false;
}

function isLocalDevelopmentServerUrl(serverUrl: string): boolean {
  try {
    const url = new URL(serverUrl);
    return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

function updateKey(update: Uint8Array): string {
  return Buffer.from(update).toString('base64');
}

export class RoomManager {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

  private localServerAutoStartPromise: Promise<boolean> | null = null;

  private localServerAutoStartAttempted = false;

  private serverUrl = 'https://codus.onrender.com';

  private document: Y.Doc | null = null;

  private sharedText: Y.Text | null = null;

  private activeRoomId: string | null = null;

  private activeDocumentUri: string | null = null;

  private roomUsers: RoomUser[] = [];

  private readonly sessionId = uuidv4();

  private userName = `Guest-${this.sessionId.slice(0, 4).toUpperCase()}`;

  private isReadOnly = false;

  private isCreator = false;

  private lastReadOnlyWarnTime = 0;

  private isApplyingRemoteUpdate = false;

  private readonly suppressedDocumentUris = new Set<string>();

  // Track recently sent updates with TTL to prevent unbounded growth
  // Map from update key to timestamp of when it was sent (for auto-cleanup after 5 seconds)
  private readonly recentlySentUpdates = new Map<string, number>();

  private readonly recentlySentCleanupTimer: ReturnType<typeof setInterval>;

  private static readonly RECENTLY_SENT_TTL_MS = 5000;

  private readonly handlers: RoomManagerHandlers;

  private static readonly ACK_TIMEOUT_MS = 5000;

  private static readonly RECONNECT_ATTEMPTS = 3;

  private static readonly RECONNECT_DELAY_MS = 2000;

  private connectionState: ConnectionStatePayload = {
    status: 'disconnected',
    roomId: null,
    userCount: 0,
  };

  public constructor(handlers: RoomManagerHandlers) {
    this.handlers = handlers;
    this.recentlySentCleanupTimer = setInterval(() => this.cleanupRecentlySentUpdates(), 5000);
  }

  public getUserName(): string {
    return this.userName;
  }

  public getServerUrl(): string {
    return vscode.workspace.getConfiguration('codus').get<string>('serverUrl') ?? this.serverUrl;
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

  public getIsReadOnly(): boolean {
    return this.isReadOnly;
  }

  public getIsCreator(): boolean {
    return this.isCreator;
  }

  public async createRoom(userName: string): Promise<string> {
    const editor = vscode.window.activeTextEditor;
    this.userName = userName;

    await this.ensureSocket();
    const roomId = await this.requestCreateRoom(userName);
    const initialState = encodeText(editor?.document.getText() ?? '');
    const initialContent = editor?.document.getText() ?? '';
    await this.joinRoomInternal(roomId, userName, initialState, initialContent);
    return roomId;
  }

  public async joinRoom(roomId: string, userName: string): Promise<void> {
    this.userName = userName;
    const editor = vscode.window.activeTextEditor;
    const initialState = encodeText(editor?.document.getText() ?? '');
    const initialContent = editor?.document.getText() ?? '';

    await this.ensureSocket();
    await this.joinRoomInternal(roomId, userName, initialState, initialContent);
  }

  public async leaveRoom(): Promise<void> {
    if (!this.socket || !this.activeRoomId) {
      this.resetRoomState();
      this.emitConnectionState({ status: 'disconnected', roomId: null, userCount: 0 });
      return;
    }

    this.socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { roomId: this.activeRoomId });
    this.resetRoomState();
    this.emitConnectionState({ status: 'disconnected', roomId: null, userCount: 0 });
  }

  public async sendChatMessage(text: string): Promise<void> {
    if (!this.socket || !this.activeRoomId) {
      throw new Error('Join a room before sending chat messages.');
    }

    this.socket.emit(SOCKET_EVENTS.CHAT_MESSAGE, { roomId: this.activeRoomId, text });
  }

  public async sendCursor(cursor: CursorPosition | null): Promise<void> {
    if (!this.socket || !this.activeRoomId) {
      return;
    }

    this.socket.emit(SOCKET_EVENTS.CURSOR_CHANGE, { roomId: this.activeRoomId, cursor });
  }

  public async setReadOnly(nextValue: boolean): Promise<void> {
    if (!this.socket || !this.activeRoomId) {
      return;
    }

    this.socket.emit(SOCKET_EVENTS.SET_READONLY, {
      roomId: this.activeRoomId,
      isReadOnly: nextValue,
    });
  }

  public handleTextDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    if (!this.sharedText || !this.activeRoomId || !this.activeDocumentUri) {
      return;
    }

    if (event.document.uri.toString() !== this.activeDocumentUri) {
      return;
    }

    if (this.isReadOnly) {
      const now = Date.now();
      if (now - this.lastReadOnlyWarnTime > 3000) {
        this.lastReadOnlyWarnTime = now;
        void vscode.window.showWarningMessage('This room is in read-only mode. The host has locked editing.');
      }
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
    if (!editor || !this.activeRoomId) {
      return;
    }

    const nextUri = editor.document.uri.toString();

    // Bind a room to a single document to prevent cross-file data loss.
    // If users switch tabs, we only broadcast file presence for awareness.
    if (!this.activeDocumentUri) {
      this.activeDocumentUri = nextUri;
      void this.syncActiveEditor(editor);
    } else if (this.activeDocumentUri === nextUri) {
      void this.syncActiveEditor(editor);
    }

    void this.sendFileChange(vscode.workspace.asRelativePath(editor.document.uri, false) || path.basename(editor.document.fileName));
  }

  public clearActiveDocumentIfMatches(uri: string): void {
    if (this.activeDocumentUri === uri) {
      this.activeDocumentUri = null;
    }
  }

  /**
   * Cleanup method called on extension deactivation.
   * Disconnects from room and cleans up socket connections.
   */
  public async dispose(): Promise<void> {
    if (this.activeRoomId) {
      await this.leaveRoom();
    }

    clearInterval(this.recentlySentCleanupTimer);
    this.resetSocketConnection();
    this.resetRoomState();
  }

  private async sendFileChange(fileName: string): Promise<void> {
    if (!this.socket || !this.activeRoomId || !this.socket.id) {
      return;
    }

    this.socket.emit(SOCKET_EVENTS.FILE_CHANGE, {
      roomId: this.activeRoomId,
      userId: this.socket.id,
      fileName,
    });
  }

  private async joinRoomInternal(
    roomId: string,
    userName: string,
    initialState?: Uint8Array,
    initialContent?: string,
  ): Promise<void> {
    if (this.activeRoomId && this.activeRoomId !== roomId) {
      await this.leaveRoom();
    }

    this.initializeDocument();
    this.activeRoomId = roomId;
    if (!this.activeDocumentUri) {
      this.activeDocumentUri = vscode.window.activeTextEditor?.document.uri.toString() ?? null;
    }
    this.emitConnectionState({ status: 'connecting', roomId, userCount: this.roomUsers.length });

    const response = await this.requestJoinRoom(roomId, userName, initialState, initialContent);
    this.roomUsers = response.users;
    this.isReadOnly = response.isReadOnly;
    this.isCreator = response.isCreator;

    this.emitRoomState({
      roomId: response.roomId,
      users: response.users,
      isReadOnly: response.isReadOnly,
      isCreator: response.isCreator,
    });

    this.emitConnectionState({ status: 'connected', roomId: response.roomId, userCount: response.users.length });

    const editor = vscode.window.activeTextEditor;
    if (editor) {
      void this.sendFileChange(path.basename(editor.document.fileName));
    }
  }

  private async ensureSocket(): Promise<void> {
    const configuredServerUrl =
      vscode.workspace.getConfiguration('codus').get<string>('serverUrl') ?? 'https://codus.onrender.com';

    if (configuredServerUrl !== this.serverUrl) {
      this.serverUrl = configuredServerUrl;
      this.localServerAutoStartAttempted = false;
      this.resetSocketConnection();
    }

    if (!this.socket) {
      this.socket = io(this.serverUrl, {
        autoConnect: false,
        transports: ['websocket', 'polling'],
      });
      this.registerSocketHandlers();
    }

    if (this.socket.connected) {
      return;
    }

    await this.ensureLocalServerRunning();

    await this.connectWithRetry();
  }

  private async ensureLocalServerRunning(): Promise<void> {
    if (this.localServerAutoStartAttempted) {
      return;
    }

    if (!isLocalDevelopmentServerUrl(this.serverUrl)) {
      return;
    }

    if (await isHttpEndpointReachable(this.serverUrl)) {
      return;
    }

    this.localServerAutoStartAttempted = true;

    const embeddedServerScript = path.join(__dirname, 'codus-server.js');
    if (!fs.existsSync(embeddedServerScript)) {
      return;
    }

    if (!this.localServerAutoStartPromise) {
      this.localServerAutoStartPromise = this.startEmbeddedServer(embeddedServerScript);
    }

    const started = await this.localServerAutoStartPromise;
    if (!started) {
      throw new Error(toServerUnavailableMessage(this.serverUrl));
    }

    const serverReady = await this.waitForServerReady(3000);
    if (!serverReady) {
      const fallbackUrl = await this.tryStartOnAvailableLocalPort(embeddedServerScript, this.serverUrl);
      if (!fallbackUrl) {
        throw new Error(toServerUnavailableMessage(this.serverUrl));
      }

      await vscode.workspace.getConfiguration('codus').update('serverUrl', fallbackUrl, vscode.ConfigurationTarget.Global);
      this.serverUrl = fallbackUrl;
      this.resetSocketConnection();

      const fallbackReady = await this.waitForServerReady(5000);
      if (!fallbackReady) {
        throw new Error(toServerUnavailableMessage(this.serverUrl));
      }
    }
  }

  private async tryStartOnAvailableLocalPort(serverScriptPath: string, currentServerUrl: string): Promise<string | null> {
    try {
      const parsed = new URL(currentServerUrl);
      const host = parsed.hostname;
      const basePort = this.resolveServerPort(currentServerUrl);

      for (let offset = 1; offset <= 20; offset += 1) {
        const candidatePort = basePort + offset;
        const occupied = await isTcpPortOccupied(host, candidatePort);
        if (occupied) {
          continue;
        }

        const candidateUrl = `${parsed.protocol}//${host}:${candidatePort}`;
        const started = await this.startEmbeddedServer(serverScriptPath, candidatePort);
        if (!started) {
          continue;
        }

        const reachable = await waitForEndpoint(candidateUrl, 4000);
        if (reachable) {
          return candidateUrl;
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  private async startEmbeddedServer(serverScriptPath: string, explicitPort?: number): Promise<boolean> {
    try {
      const targetPort = explicitPort ?? this.resolveServerPort(this.serverUrl);
      const child = spawn(process.execPath, [serverScriptPath], {
        detached: true,
        env: {
          ...process.env,
          PORT: String(targetPort),
        },
        stdio: 'ignore',
      });

      child.unref();
      return true;
    } catch {
      return false;
    }
  }

  private resolveServerPort(serverUrl: string): number {
    try {
      const parsed = new URL(serverUrl);
      if (parsed.port) {
        const value = Number(parsed.port);
        if (Number.isFinite(value) && value > 0) {
          return value;
        }
      }

      return parsed.protocol === 'https:' ? 443 : 3000;
    } catch {
      return 3000;
    }
  }

  private resetSocketConnection(): void {
    if (!this.socket) {
      return;
    }

    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
  }

  private async waitForServerReady(timeoutMs = 15000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (await isHttpEndpointReachable(this.serverUrl)) {
        return true;
      }

      await delay(500);
    }

    return false;
  }

  private async connectWithRetry(): Promise<void> {
    if (!this.socket) {
      throw new Error('Socket has not been created.');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= RoomManager.RECONNECT_ATTEMPTS; attempt += 1) {
      this.emitConnectionState({
        status: attempt === 1 ? 'connecting' : 'reconnecting',
        roomId: this.activeRoomId,
        userCount: this.roomUsers.length,
      });

      this.socket.connect();

      try {
        await this.waitForSocketConnect();
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Connection failed.');
        if (attempt < RoomManager.RECONNECT_ATTEMPTS) {
          await delay(RoomManager.RECONNECT_DELAY_MS);
        }
      }
    }

    if (lastError && shouldUsePortMessage(lastError)) {
      throw new Error(toServerUnavailableMessage(this.serverUrl));
    }

    throw lastError ?? new Error('Connection failed.');
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
        status: this.activeRoomId ? 'reconnecting' : 'disconnected',
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
        void this.joinRoomInternal(this.activeRoomId, this.userName, undefined, undefined);
      }
    });

    socket.on('connect_error', (error: Error) => {
      this.emitConnectionState({
        status: 'error',
        roomId: this.activeRoomId,
        userCount: this.roomUsers.length,
        message: shouldUsePortMessage(error) ? toServerUnavailableMessage(this.serverUrl) : error.message,
      });
    });

    socket.on(SOCKET_EVENTS.ROOM_SNAPSHOT, async (payload) => {
      if (payload.roomId !== this.activeRoomId) {
        return;
      }

      this.roomUsers = payload.users;
      this.isReadOnly = payload.isReadOnly;
      this.isCreator = payload.isCreator;
      this.emitRoomState({
        roomId: payload.roomId,
        users: payload.users,
        isReadOnly: payload.isReadOnly,
        isCreator: payload.isCreator,
      });
      await this.applyRemoteUpdate(payload.documentState);
    });

    socket.on(SOCKET_EVENTS.ROOM_STATE, (payload) => {
      if (payload.roomId !== this.activeRoomId) {
        return;
      }

      this.roomUsers = payload.users;
      if (typeof payload.isReadOnly === 'boolean') {
        this.isReadOnly = payload.isReadOnly;
      }
      this.emitRoomState({
        roomId: payload.roomId,
        users: payload.users,
        isReadOnly: this.isReadOnly,
        isCreator: this.isCreator,
      });
    });

    socket.on(SOCKET_EVENTS.READONLY_CHANGED, (payload) => {
      if (payload.roomId !== this.activeRoomId) {
        return;
      }

      this.isReadOnly = payload.isReadOnly;
      this.emitRoomState({
        roomId: this.activeRoomId,
        users: [...this.roomUsers],
        isReadOnly: this.isReadOnly,
        isCreator: this.isCreator,
      });
    });

    socket.on(SOCKET_EVENTS.ROOM_ERROR, (payload) => {
      if (payload.roomId !== this.activeRoomId) {
        return;
      }

      if (payload.code === 'READ_ONLY') {
        void vscode.window.showWarningMessage('This room is in read-only mode. The host has locked editing.');
      }
    });

    socket.on(SOCKET_EVENTS.CODE_CHANGE, async (payload) => {
      if (payload.roomId !== this.activeRoomId) {
        return;
      }

      const key = updateKey(payload.update);
      const sentTime = this.recentlySentUpdates.get(key);

      if (sentTime !== undefined) {
        this.recentlySentUpdates.delete(key);
      }

      if (sentTime !== undefined) {
        return;
      }

      await this.applyRemoteUpdate(payload.update);
      this.handlers.onRemoteEdit(payload.roomId);
    });

    socket.on(SOCKET_EVENTS.CURSOR_CHANGE, (payload) => {
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
      this.emitRoomState({
        roomId: payload.roomId,
        users: [...this.roomUsers],
        isReadOnly: this.isReadOnly,
        isCreator: this.isCreator,
      });
    });

    socket.on(SOCKET_EVENTS.CHAT_MESSAGE, (message) => {
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
        reject(error);
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

      socket.emit(SOCKET_EVENTS.CREATE_ROOM, { userName }, (response) => {
        clearTimeout(timeout);
        if ('error' in response) {
          reject(new Error(response.error));
          return;
        }

        if (!response.roomId) {
          reject(new Error('Server returned an empty room id.'));
          return;
        }

        resolve(response.roomId);
      });

      socket.once('connect_error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private requestJoinRoom(
    roomId: string,
    userName: string,
    initialState?: Uint8Array,
    initialContent?: string,
  ): Promise<{ roomId: string; users: RoomUser[]; isReadOnly: boolean; isCreator: boolean }> {
    if (!this.socket) {
      return Promise.reject(new Error('Socket has not been created.'));
    }

    const socket = this.socket;

    return new Promise<{ roomId: string; users: RoomUser[]; isReadOnly: boolean; isCreator: boolean }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timed out joining room ${roomId} via ${this.serverUrl}.`));
      }, RoomManager.ACK_TIMEOUT_MS);

      socket.emit(
        SOCKET_EVENTS.JOIN_ROOM,
        {
          roomId,
          userName,
          initialState,
          initialContent,
        },
        (response) => {
          clearTimeout(timeout);
          if ('error' in response) {
            reject(new Error(response.error));
            return;
          }

          resolve(response);
        },
      );

      socket.once('connect_error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private initializeDocument(): void {
    this.document?.destroy();
    this.document = new Y.Doc();
    this.sharedText = this.document.getText('content');

    this.document.on('update', (update: Uint8Array) => {
      if (!this.socket || !this.activeRoomId || this.isApplyingRemoteUpdate || this.isReadOnly) {
        return;
      }

      const key = updateKey(update);
      this.recentlySentUpdates.set(key, Date.now());

      this.socket.emit(SOCKET_EVENTS.CODE_CHANGE, {
        roomId: this.activeRoomId,
        update,
      });
    });
  }

  private async applyRemoteUpdate(update: Uint8Array): Promise<void> {
    if (!this.document || !this.sharedText) {
      return;
    }

    this.isApplyingRemoteUpdate = true;
    try {
      try {
        Y.applyUpdate(this.document, update);
      } catch (error) {
        console.error('[Codus] Failed to apply remote Yjs update:', error);
        void vscode.window.showWarningMessage('Codus: received a corrupt update from server. Sync may be out of date.');
        return;
      }
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
    this.isReadOnly = false;
    this.isCreator = false;
    this.lastReadOnlyWarnTime = 0;
    this.document?.destroy();
    this.document = null;
    this.sharedText = null;
    this.recentlySentUpdates.clear();
  }

  private cleanupRecentlySentUpdates(): void {
    const now = Date.now();
    for (const [key, time] of this.recentlySentUpdates.entries()) {
      if (now - time > RoomManager.RECENTLY_SENT_TTL_MS) {
        this.recentlySentUpdates.delete(key);
      }
    }
  }
}
