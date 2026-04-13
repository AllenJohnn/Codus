import * as vscode from 'vscode';
import { CollaborativePanelProvider } from './webview/panel';

export function activate(context: vscode.ExtensionContext) {
	const provider = new CollaborativePanelProvider(context.extensionUri, {
		onCreateRoom: async () => {},
		onJoinRoom: async () => {},
		onCopyRoomId: async () => {},
		onCopyRoomLink: async () => {},
		onLeaveRoom: async () => {},
		onSendChatMessage: async () => {},
		onInsertSelectionAsCode: async () => {},
		onCopyCode: async () => {},
		onSetReadOnly: async () => {},
		onFollowUser: async () => {},
	});
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(CollaborativePanelProvider.viewType, provider)
	);
}

export function deactivate() {}
