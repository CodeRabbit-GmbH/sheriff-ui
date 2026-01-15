import * as vscode from 'vscode';

const STATE_KEYS = {
  LAST_ROOT_FOLDER: 'sheriff.lastRootFolder',
  LAST_ENTRY_FILE: 'sheriff.lastEntryFile',
} as const;

export class WorkspaceStateManager {
  constructor(private readonly context: vscode.ExtensionContext) {}

  getLastRootFolder(): string | undefined {
    const config = vscode.workspace.getConfiguration('sheriff');
    if (!config.get<boolean>('rememberLastFolder', true)) {
      return undefined;
    }
    return this.context.workspaceState.get<string>(STATE_KEYS.LAST_ROOT_FOLDER);
  }

  async setLastRootFolder(folderPath: string): Promise<void> {
    await this.context.workspaceState.update(STATE_KEYS.LAST_ROOT_FOLDER, folderPath);
  }

  getLastEntryFile(): string | undefined {
    return this.context.workspaceState.get<string>(STATE_KEYS.LAST_ENTRY_FILE);
  }

  async setLastEntryFile(entryFile: string): Promise<void> {
    await this.context.workspaceState.update(STATE_KEYS.LAST_ENTRY_FILE, entryFile);
  }

  getDefaultEntryFile(): string {
    const config = vscode.workspace.getConfiguration('sheriff');
    return config.get<string>('defaultEntryFile', 'src/main.ts');
  }
}
