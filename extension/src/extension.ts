import * as vscode from 'vscode';
import { CursorManager } from './cursorManager';
import { RoomManager } from './roomManager';
import { ConnectionStatePayload } from './types';
import { CollaborativePanelProvider } from './webview/panel';

export function activate(context: vscode.ExtensionContext): void {
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	statusBarItem.text = 'Room: -';
	statusBarItem.show();

	const cursorManager = new CursorManager();

	let panelProvider: CollaborativePanelProvider;

	const roomManager = new RoomManager({
		onConnectionState: (payload) => {
			updateStatusBar(statusBarItem, payload);
			panelProvider?.updateConnectionState(payload);
		},
		onRoomState: (payload) => {
			panelProvider?.updateRoomState(payload);
			renderCursors();
		},
		onChatMessage: (message) => {
			panelProvider?.pushChatMessage(message);
		},
		onRemoteEdit: () => {
			renderCursors();
		},
		onRemoteCursor: () => {
			renderCursors();
		},
	});

	panelProvider = new CollaborativePanelProvider(context.extensionUri, {
		onCreateRoom: async (providedUserName?: string) => {
			try {
				const userName = await resolveUserName(providedUserName, roomManager.getUserName());
				if (!userName) {
					return;
				}

				const roomId = await roomManager.createRoom(userName);
				panelProvider.setLocalUserName(userName);
				void vscode.window.showInformationMessage(`Created room ${roomId}`);
			} catch (error) {
				void vscode.window.showErrorMessage(getErrorMessage(error));
			}
		},
		onJoinRoom: async (roomId: string, providedUserName?: string) => {
			try {
				const normalized = roomId.trim();
				const validation = validateRoomId(normalized);
				if (validation) {
					throw new Error(validation);
				}

				const userName = await resolveUserName(providedUserName, roomManager.getUserName());
				if (!userName) {
					return;
				}

				await roomManager.joinRoom(normalized, userName);
				panelProvider.setLocalUserName(userName);
				void vscode.window.showInformationMessage(`Joined room ${normalized}`);
			} catch (error) {
				void vscode.window.showErrorMessage(getErrorMessage(error));
			}
		},
		onCopyRoomId: async (roomId: string | null) => {
			if (!roomId) {
				return;
			}

			await vscode.env.clipboard.writeText(roomId);
			void vscode.window.showInformationMessage(`Copied room ${roomId}`);
		},
		onLeaveRoom: async () => {
			await roomManager.leaveRoom();
			cursorManager.clear();
		},
		onSendChatMessage: async (text: string) => {
			await roomManager.sendChatMessage(text);
		},
		onInsertSelectionAsCode: async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				void vscode.window.showWarningMessage('No active editor found to copy code from.');
				return;
			}

			const selected = editor.document.getText(editor.selection).trim();
			if (!selected) {
				void vscode.window.showWarningMessage('Select code in the editor first.');
				return;
			}

			const language = editor.document.languageId && editor.document.languageId !== 'plaintext'
				? editor.document.languageId
				: '';
			const fenced = language
				? `\n\n\`\`\`${language}\n${selected}\n\`\`\``
				: `\n\n\`\`\`\n${selected}\n\`\`\``;

			panelProvider.insertComposerText(fenced);
		},
		onCopyCode: async (text: string) => {
			await vscode.env.clipboard.writeText(text);
		},
	});

	function renderCursors(): void {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			return;
		}

		cursorManager.render(editor, roomManager.getUsers(), roomManager.getLocalPeerId());
	}

	function updateStatusBar(item: vscode.StatusBarItem, payload: ConnectionStatePayload): void {
		const roomId = payload.roomId ?? '-';
		item.text = `Room: ${roomId} (${payload.userCount} user${payload.userCount === 1 ? '' : 's'})`;
		item.tooltip = payload.message ? `Collaboration status: ${payload.message}` : 'Collaboration status';
	}

	context.subscriptions.push(
		statusBarItem,
		cursorManager,
		vscode.window.registerWebviewViewProvider(CollaborativePanelProvider.viewType, panelProvider),
		vscode.commands.registerCommand('collab.createRoom', async () => {
			try {
				const userName = await promptForUserName(roomManager.getUserName());
				if (!userName) {
					return;
				}

				const roomId = await roomManager.createRoom(userName);
				panelProvider.setLocalUserName(userName);
				void vscode.window.showInformationMessage(`Created room ${roomId}`);
			} catch (error) {
				void vscode.window.showErrorMessage(getErrorMessage(error));
			}
		}),
		vscode.commands.registerCommand('collab.joinRoom', async () => {
			try {
				const roomId = await vscode.window.showInputBox({
					title: 'Join Room',
					prompt: 'Enter the 4-digit room code',
					validateInput: (value) => validateRoomId(value),
				});

				if (!roomId) {
					return;
				}

				const userName = await promptForUserName(roomManager.getUserName());
				if (!userName) {
					return;
				}

				await roomManager.joinRoom(roomId, userName);
				panelProvider.setLocalUserName(userName);
				void vscode.window.showInformationMessage(`Joined room ${roomId}`);
			} catch (error) {
				void vscode.window.showErrorMessage(getErrorMessage(error));
			}
		}),
		vscode.commands.registerCommand('collab.leaveRoom', async () => {
			try {
				await roomManager.leaveRoom();
				cursorManager.clear();
				void vscode.window.showInformationMessage('Left the current room');
			} catch (error) {
				void vscode.window.showErrorMessage(getErrorMessage(error));
			}
		}),
		vscode.workspace.onDidChangeTextDocument((event) => roomManager.handleTextDocumentChange(event)),
		vscode.window.onDidChangeTextEditorSelection((event) => {
			if (!roomManager.getActiveRoomId()) {
				return;
			}

			const selection = event.selections[0];
			void roomManager.sendCursor({
				line: selection.active.line,
				character: selection.active.character,
			});
		}),
		vscode.window.onDidChangeActiveTextEditor((editor) => {
			roomManager.setActiveEditor(editor ?? undefined);
			renderCursors();
		}),
	);

	roomManager.setActiveEditor(vscode.window.activeTextEditor ?? undefined);
	panelProvider.setLocalUserName(roomManager.getUserName());
	panelProvider.updateConnectionState({ status: 'disconnected', roomId: null, userCount: 0 });
}

function validateRoomId(value: string): string | null {
	const normalized = value.trim();
	if (!/^\d{4}$/.test(normalized)) {
		return 'Room codes must be exactly 4 digits.';
	}

	return null;
}

async function promptForUserName(currentUserName: string): Promise<string | undefined> {
	const value = await vscode.window.showInputBox({
		title: 'Your Display Name',
		prompt: 'Enter your name for this collaboration session',
		value: currentUserName,
		ignoreFocusOut: true,
		validateInput: (input) => {
			const normalized = input.trim();
			if (!normalized) {
				return 'Name is required.';
			}

			if (normalized.length > 40) {
				return 'Name must be 40 characters or fewer.';
			}

			return null;
		},
	});

	return value?.trim();
}

async function resolveUserName(providedUserName: string | undefined, currentUserName: string): Promise<string | undefined> {
	const normalized = providedUserName?.trim();
	if (normalized) {
		return normalized;
	}

	return promptForUserName(currentUserName);
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return 'Unknown error';
}

export function deactivate(): void {}
