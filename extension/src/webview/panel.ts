import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ChatMessage, ConnectionStatePayload, RoomStatePayload } from '../types';

type WebviewCommand =
  | { type: 'createRoom'; userName?: string }
  | { type: 'joinRoom'; roomId: string; userName?: string }
  | { type: 'copyRoomId' }
  | { type: 'copyRoomLink' }
  | { type: 'leaveRoom' }
  | { type: 'sendChatMessage'; text: string }
  | { type: 'insertSelectionAsCode' }
  | { type: 'copyCode'; text: string }
  | { type: 'setReadOnly'; isReadOnly: boolean }
  | { type: 'followUser'; userId: string | null };

type WebviewState = {
  connectionState: ConnectionStatePayload;
  roomState: RoomStatePayload;
  chatMessages: ChatMessage[];
  localUserName: string;
  followedUserId: string | null;
};

export interface PanelBridge {
  onCreateRoom: (userName?: string) => Promise<void>;
  onJoinRoom: (roomId: string, userName?: string) => Promise<void>;
  onCopyRoomId: (roomId: string | null) => Promise<void>;
  onCopyRoomLink: (roomId: string | null) => Promise<void>;
  onLeaveRoom: () => Promise<void>;
  onSendChatMessage: (text: string) => Promise<void>;
  onInsertSelectionAsCode: () => Promise<void>;
  onCopyCode: (text: string) => Promise<void>;
  onSetReadOnly: (isReadOnly: boolean) => Promise<void>;
  onFollowUser: (userId: string | null) => Promise<void>;
}

export class CollaborativePanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codus.sidebarView';

  private view: vscode.WebviewView | null = null;

  private readonly state: WebviewState = {
    connectionState: {
      status: 'disconnected',
      roomId: null,
      userCount: 0,
    },
    roomState: {
      roomId: null,
      users: [],
      isReadOnly: false,
    },
    chatMessages: [],
    localUserName: 'Guest',
    followedUserId: null,
  };

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly bridge: PanelBridge,
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webview.html = this.getHtml(webview);

    webview.onDidReceiveMessage(async (message: WebviewCommand) => {
      try {
        switch (message.type) {
          case 'createRoom':
            await this.bridge.onCreateRoom(message.userName);
            return;
          case 'joinRoom':
            await this.bridge.onJoinRoom(message.roomId, message.userName);
            return;
          case 'copyRoomId':
            await this.bridge.onCopyRoomId(this.state.roomState.roomId);
            return;
          case 'copyRoomLink':
            await this.bridge.onCopyRoomLink(this.state.roomState.roomId);
            return;
          case 'leaveRoom':
            await this.bridge.onLeaveRoom();
            return;
          case 'sendChatMessage':
            await this.bridge.onSendChatMessage(message.text);
            return;
          case 'insertSelectionAsCode':
            await this.bridge.onInsertSelectionAsCode();
            return;
          case 'copyCode':
            await this.bridge.onCopyCode(message.text);
            return;
          case 'setReadOnly':
            await this.bridge.onSetReadOnly(message.isReadOnly);
            return;
          case 'followUser':
            this.state.followedUserId = message.userId;
            this.pushState();
            await this.bridge.onFollowUser(message.userId);
            return;
          default:
            return;
        }
      } catch (error) {
        const messageText = error instanceof Error ? error.message : 'Unknown error';
        void vscode.window.showErrorMessage(messageText);
      }
    });

    this.pushState();
  }

  public setLocalUserName(localUserName: string): void {
    this.state.localUserName = localUserName;
    this.pushState();
  }

  public setFollowedUserId(userId: string | null): void {
    this.state.followedUserId = userId;
    this.pushState();
  }

  public updateConnectionState(connectionState: ConnectionStatePayload): void {
    this.state.connectionState = connectionState;
    this.pushState();
  }

  public updateRoomState(roomState: RoomStatePayload): void {
    this.state.roomState = {
      ...this.state.roomState,
      ...roomState,
    };

    this.state.connectionState = {
      ...this.state.connectionState,
      roomId: roomState.roomId,
      userCount: roomState.users.length,
    };

    this.pushState();
  }

  public pushChatMessage(message: ChatMessage): void {
    this.state.chatMessages = [...this.state.chatMessages, message].slice(-200);
    this.pushState();
  }

  public pushSystemMessage(text: string): void {
    const roomId = this.state.roomState.roomId ?? '';
    const systemMessage: ChatMessage = {
      id: `system-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      roomId,
      authorId: 'system',
      authorName: 'system',
      authorColor: '#333',
      text,
      timestamp: new Date().toISOString(),
      system: true,
    };

    this.pushChatMessage(systemMessage);
  }

  public insertComposerText(text: string): void {
    if (!this.view) {
      return;
    }

    this.view.webview.postMessage({
      type: 'insertComposerText',
      text,
    });
  }

  private pushState(): void {
    if (!this.view) {
      return;
    }

    this.view.webview.postMessage({
      type: 'state',
      payload: this.state,
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const templatePath = path.join(this.extensionUri.fsPath, 'src', 'webview', 'index.html');
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Webview HTML file not found. Expected: ${templatePath}`);
    }

    const template = fs.readFileSync(templatePath, 'utf8');
    const nonce = createNonce();

    return template.replace(/{{cspSource}}/g, webview.cspSource).replace(/{{nonce}}/g, nonce);
  }
}

function createNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let index = 0; index < 32; index += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}
