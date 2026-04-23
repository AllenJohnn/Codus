import * as vscode from 'vscode';
import { RoomUser } from 'codus-shared';

type UserDecoration = {
  decoration: vscode.TextEditorDecorationType;
  color: string;
  label: string;
  offset: number;
};

export class CursorManager implements vscode.Disposable {
  private readonly decorations = new Map<string, UserDecoration>();

  private followedUserId: string | null = null;

  private followPromptKey: string | null = null;

  private isSwitchPromptOpen = false;

  public render(editor: vscode.TextEditor, users: RoomUser[], localPeerId: string | null): void {
    const remoteUsers = users.filter((user) => user.id !== localPeerId && user.cursor);
    const activeIds = new Set(remoteUsers.map((user) => user.id));
    const lineUsage = new Map<number, number>();

    for (const [userId, decoration] of Array.from(this.decorations.entries())) {
      if (!activeIds.has(userId)) {
        editor.setDecorations(decoration.decoration, []);
        this.removeUser(userId);
      }
    }

    for (const user of remoteUsers) {
      if (!user.cursor) {
        continue;
      }

      const currentIndex = lineUsage.get(user.cursor.line) ?? 0;
      lineUsage.set(user.cursor.line, currentIndex + 1);
      const decoration = this.ensureDecoration(user.id, user.color, user.name, currentIndex);

      const position = new vscode.Position(user.cursor.line, user.cursor.character);
      const range = new vscode.Range(position, position);
      editor.setDecorations(decoration.decoration, [range]);

      if (this.followedUserId === user.id) {
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        void this.maybePromptSwitchFile(user, editor.document.fileName);
      }
    }
  }

  public removeUser(userId: string): void {
    const decoration = this.decorations.get(userId);
    if (decoration) {
      decoration.decoration.dispose();
      this.decorations.delete(userId);
    }

    if (this.followedUserId === userId) {
      this.followedUserId = null;
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
      decoration.decoration.dispose();
    }

    this.decorations.clear();
  }

  public dispose(): void {
    this.clear();
  }

  private async maybePromptSwitchFile(user: RoomUser, currentPath: string): Promise<void> {
    if (this.isSwitchPromptOpen) {
      return;
    }

    if (!user.currentFile) {
      return;
    }

    const currentRelativePath = vscode.workspace.asRelativePath(currentPath, false);
    if (user.currentFile === currentRelativePath) {
      this.followPromptKey = null;
      return;
    }

    const nextKey = `${user.id}:${user.currentFile}`;
    if (this.followPromptKey === nextKey) {
      return;
    }
    this.followPromptKey = nextKey;

    this.isSwitchPromptOpen = true;
    try {
      const picked = await vscode.window.showQuickPick(['Yes', 'No'], {
        title: `${user.name} is editing ${user.currentFile} - switch to that file?`,
        ignoreFocusOut: true,
      });

      if (picked !== 'Yes') {
        return;
      }

      const target = await this.findWorkspaceFileByRelativePath(user.currentFile);
      if (!target) {
        void vscode.window.showWarningMessage(`Could not find ${user.currentFile} in workspace.`);
        return;
      }

      const doc = await vscode.workspace.openTextDocument(target);
      await vscode.window.showTextDocument(doc, { preview: false });
    } finally {
      this.isSwitchPromptOpen = false;
    }
  }

  private async findWorkspaceFileByRelativePath(relativePath: string): Promise<vscode.Uri | undefined> {
    const normalized = relativePath.replace(/\\/g, '/');
    const matches = await vscode.workspace.findFiles(`**/${normalized}`, '**/node_modules/**', 20);

    if (matches.length === 0) {
      return undefined;
    }

    if (matches.length === 1) {
      return matches[0];
    }

    const picked = await vscode.window.showQuickPick(
      matches.map((uri) => ({
        label: vscode.workspace.asRelativePath(uri, false),
        uri,
      })),
      {
        title: 'Multiple matching files found. Pick one to open.',
        ignoreFocusOut: true,
      },
    );

    return picked?.uri;
  }

  private ensureDecoration(userId: string, color: string, label: string, lineStackIndex: number): UserDecoration {
    const offset = lineStackIndex * 60;
    const existing = this.decorations.get(userId);
    if (existing && existing.color === color && existing.label === label && existing.offset === offset) {
      return existing;
    }

    existing?.decoration.dispose();

    const next: UserDecoration = {
      decoration: this.createDecoration(color, label, offset),
      color,
      label,
      offset,
    };
    this.decorations.set(userId, next);
    return next;
  }

  private createDecoration(color: string, label: string, offset: number): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
      borderWidth: '0 0 0 2px',
      borderStyle: 'solid',
      borderColor: color,
      after: {
        contentText: ` ${label}`,
        color,
        margin: `0 0 0 ${2 + offset}px`,
      },
    });
  }
}
