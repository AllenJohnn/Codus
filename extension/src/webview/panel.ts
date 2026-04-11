import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ChatMessage, ConnectionStatePayload, RoomStatePayload } from '../types';

type WebviewCommand =
  | { type: 'createRoom'; userName?: string }
  | { type: 'joinRoom'; roomId: string; userName?: string }
  | { type: 'copyRoomId' }
  | { type: 'leaveRoom' }
  | { type: 'sendChatMessage'; text: string }
  | { type: 'insertSelectionAsCode' }
  | { type: 'copyCode'; text: string };

type WebviewState = {
  connectionState: ConnectionStatePayload;
  roomState: RoomStatePayload;
  chatMessages: ChatMessage[];
  localUserName: string;
};

export interface PanelBridge {
  onCreateRoom: (userName?: string) => Promise<void>;
  onJoinRoom: (roomId: string, userName?: string) => Promise<void>;
  onCopyRoomId: (roomId: string | null) => Promise<void>;
  onLeaveRoom: () => Promise<void>;
  onSendChatMessage: (text: string) => Promise<void>;
  onInsertSelectionAsCode: () => Promise<void>;
  onCopyCode: (text: string) => Promise<void>;
}

export class CollaborativePanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'collab.sidebarView';

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
    },
    chatMessages: [],
    localUserName: 'Guest',
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

  public updateConnectionState(connectionState: ConnectionStatePayload): void {
    this.state.connectionState = connectionState;
    this.pushState();
  }

  public updateRoomState(roomState: RoomStatePayload): void {
    this.state.roomState = roomState;
    this.state.connectionState = {
      ...this.state.connectionState,
      roomId: roomState.roomId,
      userCount: roomState.users.length,
    };
    this.pushState();
  }

  public pushChatMessage(message: ChatMessage): void {
    this.state.chatMessages = [...this.state.chatMessages, message].slice(-100);
    this.pushState();
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
