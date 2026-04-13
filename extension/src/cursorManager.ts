import * as vscode from 'vscode';
import { RoomUser } from './types';

export class CursorManager {
	private decorations: Map<string, vscode.TextEditorDecorationType> = new Map();

	public updateCursors(editor: vscode.TextEditor, users: RoomUser[], localUserId: string): void {
		users.forEach(user => {
			if (user.id === localUserId || !user.cursor) return;
			const decoration = this.getOrCreateDecoration(user);
			const range = new vscode.Range(
				user.cursor.line,
				user.cursor.character,
				user.cursor.line,
				user.cursor.character
			);
			editor.setDecorations(decoration, [range]);
		});
	}

	private getOrCreateDecoration(user: RoomUser): vscode.TextEditorDecorationType {
		if (!this.decorations.has(user.id)) {
			const decoration = vscode.window.createTextEditorDecorationType({
				border: `2px solid ${user.color}`,
				borderRadius: '2px',
				isWholeLine: false,
			});
			this.decorations.set(user.id, decoration);
		}
		return this.decorations.get(user.id)!;
	}

	public dispose(): void {
		this.decorations.forEach(decoration => decoration.dispose());
		this.decorations.clear();
	}
}
