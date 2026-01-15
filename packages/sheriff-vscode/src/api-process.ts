import * as vscode from 'vscode';
import * as path from 'path';
import * as net from 'net';
import { ChildProcess, spawn } from 'child_process';
import * as http from 'http';

const READY_TIMEOUT_MS = 15000;
const READY_POLL_MS = 200;

/**
 * Manages the Sheriff API server process lifecycle for the VS Code extension.
 * Spawns, monitors, and terminates the minimal Express backend that powers the webview UI.
 */
export class ApiProcessManager {
  private process: ChildProcess | undefined;
  private port: number | undefined;
  private workspaceRoot: string | undefined;
  private sheriffRoot: string | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly out: vscode.OutputChannel = vscode.window.createOutputChannel('Sheriff')
  ) {}

  async ensureRunning(workspaceRoot: string, sheriffRoot = workspaceRoot): Promise<number> {
    if (this.process && this.port && this.workspaceRoot === workspaceRoot && this.sheriffRoot === sheriffRoot) {
      return this.port;
    }

    this.stop();
    this.workspaceRoot = workspaceRoot;
    this.sheriffRoot = sheriffRoot;
    this.port = await getAvailablePort();

    await this.startServer();
    return this.port;
  }

  stop(): void {
    this.process?.kill();
    this.process = this.port = this.workspaceRoot = this.sheriffRoot = undefined;
  }

  private async startServer(): Promise<void> {
    const serverPath = vscode.Uri.joinPath(this.extensionUri, 'server', 'main-minimal.cjs').fsPath;
    const nodePath = [
      path.join(path.dirname(serverPath), 'node_modules'),
      path.join(this.workspaceRoot!, 'node_modules'),
      process.env.NODE_PATH,
    ].filter(Boolean).join(path.delimiter);

    this.log(`Starting server on port ${this.port}...`);

    this.process = spawn(process.execPath, [serverPath], {
      cwd: this.sheriffRoot,
      env: { ...process.env, HOST: '127.0.0.1', PORT: String(this.port), SHERIFF_ROOT: this.sheriffRoot!, NODE_PATH: nodePath },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (d: Buffer) => this.out.appendLine(`[stdout] ${d.toString().trim()}`));
    this.process.stderr?.on('data', (d: Buffer) => this.out.appendLine(`[stderr] ${d.toString().trim()}`));
    this.process.on('error', (e) => { this.log(`Error: ${e.message}`); this.out.show(); });
    this.process.on('exit', (code) => { if (code) this.out.show(); this.process = undefined; });

    await this.waitForReady();
    this.log(`✓ Server ready at http://127.0.0.1:${this.port}`);
  }

  private async waitForReady(): Promise<void> {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (await checkServerReady(this.port!)) return;
      await new Promise((r) => setTimeout(r, READY_POLL_MS));
    }
    throw new Error(`Server timeout after ${READY_TIMEOUT_MS}ms`);
  }

  private log(msg: string): void {
    this.out.appendLine(`[Sheriff] ${msg}`);
  }
}

export async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function checkServerReady(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/env`, (res) => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}
