import * as vscode from 'vscode';
import { ApiProcessManager } from './api-process';
import { SheriffWebviewProvider, SheriffInitialSettings } from './webview';
import { WorkspaceStateManager } from './workspace-state';

let apiManager: ApiProcessManager | undefined;
let currentPanel: vscode.WebviewPanel | undefined;
let currentRootPath: string | undefined;
let stateManager: WorkspaceStateManager | undefined;
let outputChannel: vscode.OutputChannel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  stateManager = new WorkspaceStateManager(context);
  outputChannel = vscode.window.createOutputChannel('Sheriff');

  const openUiCommand = vscode.commands.registerCommand('sheriff.openUi', async () => {
    await openSheriffUi(context, stateManager?.getLastRootFolder());
  });

  const openUiFromFolderCommand = vscode.commands.registerCommand(
    'sheriff.openUiFromFolder',
    async (uri: vscode.Uri) => {
      await openSheriffUi(context, uri.fsPath);
    }
  );

  context.subscriptions.push(openUiCommand, openUiFromFolderCommand);
}

export function deactivate(): void {
  apiManager?.stop();
  apiManager = undefined;
  currentPanel?.dispose();
  currentPanel = undefined;
  currentRootPath = undefined;
  outputChannel = undefined;
}

async function openSheriffUi(context: vscode.ExtensionContext, folderPath?: string): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Sheriff: Please open a workspace folder first.');
    return;
  }

  const rootPath = folderPath || workspaceFolder.uri.fsPath;

  if (currentPanel && currentRootPath && currentRootPath !== rootPath) {
    currentPanel.dispose();
    currentPanel = undefined;
  }

  if (currentPanel) {
    currentPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  if (!apiManager) {
    outputChannel!.show(true);
    apiManager = new ApiProcessManager(context.extensionUri, outputChannel!);
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Sheriff: Starting...', cancellable: false },
    async () => {
      try {
        const port = await apiManager!.ensureRunning(workspaceFolder.uri.fsPath, rootPath);

        const initialSettings: SheriffInitialSettings = {
          cwd: rootPath,
          entry: stateManager?.getLastEntryFile() || stateManager?.getDefaultEntryFile() || 'src/main.ts',
        };

        const webviewProvider = new SheriffWebviewProvider(context.extensionUri, port, initialSettings);
        outputChannel?.appendLine(`[Sheriff] Webview created apiBase=http://127.0.0.1:${port} cwd=${initialSettings.cwd} entry=${initialSettings.entry}`);
        currentPanel = webviewProvider.createPanel();
        currentRootPath = rootPath;

        await stateManager?.setLastRootFolder(rootPath);

        currentPanel.webview.onDidReceiveMessage(
          async (message: { type: string; payload?: Record<string, unknown> }) => {
            if (message.type === 'saveSettings' && message.payload) {
              if (typeof message.payload.cwd === 'string') {
                await stateManager?.setLastRootFolder(message.payload.cwd);
              }
              if (typeof message.payload.entry === 'string') {
                await stateManager?.setLastEntryFile(message.payload.entry);
              }
            }
          },
          undefined,
          context.subscriptions
        );

        currentPanel.onDidDispose(() => {
          currentPanel = undefined;
          currentRootPath = undefined;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Sheriff: Failed to start - ${message}`);
        throw error;
      }
    }
  );
}
