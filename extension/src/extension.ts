import * as vscode from 'vscode';
import { CollaborativePanelProvider } from './webview/panel';
import { CursorManager } from './cursorManager';
import { RoomManager } from './roomManager';

let panelProvider: CollaborativePanelProvider | undefined;
let roomManager: RoomManager | undefined;
let cursorManager: CursorManager | undefined;

export function activate(context: vscode.ExtensionContext) {
	cursorManager = new CursorManager();
	roomManager = new RoomManager();

	panelProvider = new CollaborativePanelProvider(context.extensionUri, {
		onCreateRoom: async (userName?: string) => roomManager!.createRoom(userName),
		onJoinRoom: async (roomId: string, userName?: string) => roomManager!.joinRoom(roomId, userName),
		onCopyRoomId: async (roomId: string | null) => roomManager!.copyRoomId(roomId),
		onCopyRoomLink: async (roomId: string | null) => roomManager!.copyRoomLink(roomId),
		onLeaveRoom: async () => roomManager!.leaveRoom(),
		onSendChatMessage: async (text: string) => roomManager!.sendChatMessage(text),
		onInsertSelectionAsCode: async () => roomManager!.insertSelectionAsCode(),
		onCopyCode: async (text: string) => roomManager!.copyCode(text),
		onSetReadOnly: async (isReadOnly: boolean) => roomManager!.setReadOnly(isReadOnly),
		onFollowUser: async (userId: string | null) => roomManager!.followUser(userId),
	});

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(
			CollaborativePanelProvider.viewType,
			panelProvider
		)
	);
}

export function deactivate() {
	// Clean up if needed
}
