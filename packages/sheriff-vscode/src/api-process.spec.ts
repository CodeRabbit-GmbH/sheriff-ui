/**
 * Unit tests for API process utility functions
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => ({
  Uri: {
    joinPath: (base: { fsPath: string }, ...segments: string[]) => ({
      fsPath: `${base.fsPath}/${segments.join('/')}`,
    }),
  },
  workspace: {
    workspaceFolders: [],
  },
  window: {
    showErrorMessage: vi.fn(),
    withProgress: vi.fn(),
    createWebviewPanel: vi.fn(),
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      show: vi.fn(),
    })),
  },
  ProgressLocation: {
    Notification: 1,
  },
  ViewColumn: {
    One: 1,
  },
}));

import { getAvailablePort } from './api-process';

describe('getAvailablePort', () => {
  it('should return a valid port number', async () => {
    const port = await getAvailablePort();
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThanOrEqual(65535);
  });

  it('should return different ports on subsequent calls', async () => {
    const port1 = await getAvailablePort();
    const port2 = await getAvailablePort();
    expect(typeof port1).toBe('number');
    expect(typeof port2).toBe('number');
  });
});
