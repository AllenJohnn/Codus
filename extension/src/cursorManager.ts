import * as path from 'path';
import * as vscode from 'vscode';
import { RoomUser } from './types';

export class CursorManager implements vscode.Disposable {
  private readonly decorations = new Map<string, vscode.TextEditorDecorationType>();

  private followedUserId: string | null = null;

  private followPromptKey: string | null = null;

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

      if (this.followedUserId === user.id) {
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        void this.maybePromptSwitchFile(user, editor.document.fileName);
      }
    }
  }

  public setFollowedUser(userId: string | null): void {
    this.followedUserId = userId;
  }

  public getFollowedUserId(): string | null {
    return this.followedUserId;
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

  private async maybePromptSwitchFile(user: RoomUser, currentPath: string): Promise<void> {
    if (!user.currentFile) {
      return;
    }

    const currentName = path.basename(currentPath);
    if (user.currentFile === currentName) {
      this.followPromptKey = null;
      return;
    }

    const nextKey = `${user.id}:${user.currentFile}`;
    if (this.followPromptKey === nextKey) {
      return;
    }
    this.followPromptKey = nextKey;

    const picked = await vscode.window.showQuickPick(['Yes', 'No'], {
      title: `${user.name} is editing ${user.currentFile} - switch to that file?`,
      ignoreFocusOut: true,
    });

    if (picked !== 'Yes') {
      return;
    }

    const target = await this.findWorkspaceFileByName(user.currentFile);
    if (!target) {
      void vscode.window.showWarningMessage(`Could not find ${user.currentFile} in workspace.`);
      return;
    }

    const doc = await vscode.workspace.openTextDocument(target);
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  private async findWorkspaceFileByName(fileName: string): Promise<vscode.Uri | undefined> {
    const matches = await vscode.workspace.findFiles(`**/${fileName}`, '**/node_modules/**', 20);
    return matches[0];
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
