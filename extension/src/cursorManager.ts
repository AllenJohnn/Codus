import * as vscode from 'vscode';
import { RoomUser } from './types';

export class CursorManager implements vscode.Disposable {
	private readonly decorations = new Map<string, vscode.TextEditorDecorationType>();

	public render(editor: vscode.TextEditor, users: RoomUser[], localPeerId: string | null): void {
		const remoteUsers = users.filter((user) => user.id !== localPeerId && user.cursor);
		const activeIds = new Set(remoteUsers.map((user) => user.id));

		for (const [userId, decoration] of Array.from(this.decorations.entries())) {
			if (!activeIds.has(userId)) {
				editor.setDecorations(decoration, []);
				decoration.dispose();
				this.decorations.delete(userId);
			}
		}

		for (const user of remoteUsers) {
			if (!user.cursor) {
				continue;
			}

			let decoration = this.decorations.get(user.id);
			if (!decoration) {
				decoration = this.createDecoration(user.color, user.name);
				this.decorations.set(user.id, decoration);
			}

			const position = new vscode.Position(user.cursor.line, user.cursor.character);
			const range = new vscode.Range(position, position);
			editor.setDecorations(decoration, [range]);
		}
	}

	public clear(): void {
		for (const decoration of Array.from(this.decorations.values())) {
			decoration.dispose();
		}

		this.decorations.clear();
	}

	public dispose(): void {
		this.clear();
	}

	private createDecoration(color: string, label: string): vscode.TextEditorDecorationType {
		return vscode.window.createTextEditorDecorationType({
			borderWidth: '0 0 0 2px',
			borderStyle: 'solid',
			borderColor: color,
			after: {
				contentText: ` ${label}`,
				color,
				margin: '0 0 0 2px',
			},
		});
	}
}
