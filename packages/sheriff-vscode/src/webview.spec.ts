/**
 * Unit tests for webview utility functions
 */
import { describe, it, expect, vi } from 'vitest';
import { rewriteAssetUrls, injectCspAndConfig } from './webview';
import type * as vscode from 'vscode';

/**
 * Creates a mock webview for testing
 */
function createMockWebview(): vscode.Webview {
  return {
    cspSource: 'https://file+.vscode-resource.vscode-cdn.net',
    asWebviewUri: (uri: vscode.Uri) => ({
      toString: () => `vscode-webview://test/${uri.path}`,
    }),
  } as unknown as vscode.Webview;
}

/**
 * Creates a mock URI for testing
 */
function createMockUri(path: string): vscode.Uri {
  return {
    path,
    fsPath: path,
    scheme: 'file',
  } as unknown as vscode.Uri;
}

vi.mock('vscode', () => ({
  Uri: {
    joinPath: (base: vscode.Uri, ...pathSegments: string[]) => ({
      path: `${base.path}/${pathSegments.join('/')}`,
      fsPath: `${base.path}/${pathSegments.join('/')}`,
      scheme: 'file',
    }),
  },
}));

describe('rewriteAssetUrls', () => {
  it('should rewrite relative script src attributes', () => {
    const html = '<script src="main.js"></script>';
    const webview = createMockWebview();
    const baseUri = createMockUri('/ext/media/ui');

    const result = rewriteAssetUrls(html, webview, baseUri);

    expect(result).toContain('vscode-webview://test/');
    expect(result).not.toContain('src="main.js"');
  });

  it('should preserve absolute URLs', () => {
    const html = '<script src="https://cdn.example.com/lib.js"></script>';
    const webview = createMockWebview();
    const baseUri = createMockUri('/ext/media/ui');

    const result = rewriteAssetUrls(html, webview, baseUri);

    expect(result).toContain('https://cdn.example.com/lib.js');
  });

  it('should rewrite relative link href attributes', () => {
    const html = '<link rel="stylesheet" href="styles.css">';
    const webview = createMockWebview();
    const baseUri = createMockUri('/ext/media/ui');

    const result = rewriteAssetUrls(html, webview, baseUri);

    expect(result).toContain('vscode-webview://test/');
    expect(result).not.toContain('href="styles.css"');
  });

  it('should preserve data: URLs', () => {
    const html = '<script src="data:text/javascript,console.log()"></script>';
    const webview = createMockWebview();
    const baseUri = createMockUri('/ext/media/ui');

    const result = rewriteAssetUrls(html, webview, baseUri);

    expect(result).toContain('data:text/javascript');
  });

  it('should eagerly enable Angular async stylesheet links (media=print + onload)', () => {
    const html =
      '<link rel="stylesheet" href="styles.css" media="print" onload="this.media=\'all\'">';
    const webview = createMockWebview();
    const baseUri = createMockUri('/ext/media/ui');

    const result = rewriteAssetUrls(html, webview, baseUri);

    expect(result).not.toContain('media="print"');
    expect(result).not.toContain('onload=');
    expect(result).toContain('media="all"');
    expect(result).toContain('vscode-webview://test/');
  });

  it('should rewrite img src attributes', () => {
    const html = '<img src="logo.png">';
    const webview = createMockWebview();
    const baseUri = createMockUri('/ext/media/ui');

    const result = rewriteAssetUrls(html, webview, baseUri);

    expect(result).toContain('vscode-webview://test/');
    expect(result).not.toContain('src="logo.png"');
  });

  it('should remove base href tag', () => {
    const html = '<html><head><base href="/"></head><body></body></html>';
    const webview = createMockWebview();
    const baseUri = createMockUri('/ext/media/ui');

    const result = rewriteAssetUrls(html, webview, baseUri);

    expect(result).not.toContain('<base');
  });

  it('should rewrite leading-slash asset URLs', () => {
    const html = '<link rel="icon" href="/logo.png">';
    const webview = createMockWebview();
    const baseUri = createMockUri('/ext/media/ui');

    const result = rewriteAssetUrls(html, webview, baseUri);

    expect(result).toContain('vscode-webview://test/');
    expect(result).not.toContain('href="/logo.png"');
  });
});

describe('injectCspAndConfig', () => {
  it('should inject CSP meta tag', () => {
    const html = '<html><head></head><body></body></html>';
    const webview = createMockWebview();
    const baseUri = createMockUri('/ext/media/ui');

    const result = injectCspAndConfig(html, webview, baseUri, 'test-nonce', 'http://127.0.0.1:3011');

    expect(result).toContain('Content-Security-Policy');
    expect(result).toContain('nonce="test-nonce"');
  });

  it('should inject API base configuration', () => {
    const html = '<html><head></head><body></body></html>';
    const webview = createMockWebview();
    const baseUri = createMockUri('/ext/media/ui');

    const result = injectCspAndConfig(html, webview, baseUri, 'test-nonce', 'http://127.0.0.1:3011');

    expect(result).toContain('window.__SHERIFF_API_BASE__="http://127.0.0.1:3011"');
    expect(result).toContain('window.__SHERIFF_UI_BASE__');
  });

  it('should include connect-src with API base', () => {
    const html = '<html><head></head><body></body></html>';
    const webview = createMockWebview();
    const baseUri = createMockUri('/ext/media/ui');

    const result = injectCspAndConfig(html, webview, baseUri, 'test-nonce', 'http://127.0.0.1:3011');

    expect(result).toContain('connect-src http://127.0.0.1:3011');
  });

  it('should add nonce to existing inline scripts', () => {
    const html = '<html><head></head><body><script>console.log("test")</script></body></html>';
    const webview = createMockWebview();
    const baseUri = createMockUri('/ext/media/ui');

    const result = injectCspAndConfig(html, webview, baseUri, 'test-nonce', 'http://127.0.0.1:3011');

    expect(result).toContain('<script nonce="test-nonce">');
  });

  it('should not include external CDNs in CSP', () => {
    const html = '<html><head></head><body></body></html>';
    const webview = createMockWebview();
    const baseUri = createMockUri('/ext/media/ui');

    const result = injectCspAndConfig(html, webview, baseUri, 'test-nonce', 'http://127.0.0.1:3011');

    expect(result).not.toContain('cdn.jsdelivr.net');
    expect(result).toContain('script-src');
    expect(result).toContain('style-src');
  });

  it('should inject initial settings when provided', () => {
    const html = '<html><head></head><body></body></html>';
    const webview = createMockWebview();
    const baseUri = createMockUri('/ext/media/ui');

    const result = injectCspAndConfig(
      html,
      webview,
      baseUri,
      'test-nonce',
      'http://127.0.0.1:3011',
      { cwd: '/project', entry: 'src/main.ts' }
    );

    expect(result).toContain('window.__SHERIFF_INITIAL_CWD__="/project"');
    expect(result).toContain('window.__SHERIFF_INITIAL_ENTRY__="src/main.ts"');
  });
});
