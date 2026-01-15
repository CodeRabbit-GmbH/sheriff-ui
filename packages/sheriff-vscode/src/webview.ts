import * as vscode from 'vscode';
import * as fs from 'fs';

export interface SheriffInitialSettings {
  cwd: string;
  entry: string;
}

/**
 * Creates and configures VS Code webview panels to host the Sheriff UI.
 * Handles HTML asset rewriting, CSP injection, and API configuration for the embedded Angular app.
 */
export class SheriffWebviewProvider {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly apiPort: number,
    private readonly initialSettings?: SheriffInitialSettings
  ) {}

  createPanel(): vscode.WebviewPanel {
    const uiDistUri = vscode.Uri.joinPath(this.extensionUri, 'media', 'ui');

    const panel = vscode.window.createWebviewPanel(
      'sheriff',
      'Sheriff',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri, uiDistUri],
      }
    );

    panel.webview.html = this.getWebviewContent(panel.webview, uiDistUri);
    return panel;
  }

  private getWebviewContent(webview: vscode.Webview, uiDistUri: vscode.Uri): string {
    const indexPath = vscode.Uri.joinPath(uiDistUri, 'index.html').fsPath;
    let html = fs.readFileSync(indexPath, 'utf-8');

    html = rewriteAssetUrls(html, webview, uiDistUri);
    html = injectCspAndConfig(html, webview, uiDistUri, getNonce(), `http://127.0.0.1:${this.apiPort}`, this.initialSettings);

    return html;
  }
}

function toWebviewUri(webview: vscode.Webview, baseUri: vscode.Uri, url: string): string {
  if (/^(?:https?:|data:|blob:)/.test(url)) return url;
  const assetUri = vscode.Uri.joinPath(baseUri, url.replace(/^\/+/, ''));
  return webview.asWebviewUri(assetUri).toString();
}

function rewriteAttr(html: string, tag: string, attr: string, rewrite: (url: string) => string): string {
  const regex = new RegExp(`(<${tag}[^>]*\\s+${attr}=["'])([^"']+)(["'][^>]*>)`, 'gi');
  return html.replace(regex, (_, pre, url, post) => `${pre}${rewrite(url)}${post}`);
}

export function rewriteAssetUrls(html: string, webview: vscode.Webview, baseUri: vscode.Uri): string {
  html = html.replace(/<base\s+href=["'][^"']*["']\s*\/?>/gi, '');

  html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag) =>
    tag.replace(/\smedia=["']print["']/gi, ' media="all"').replace(/\sonload=["'][^"']*["']/gi, '')
  );

  const rewrite = (url: string) => toWebviewUri(webview, baseUri, url);

  html = rewriteAttr(html, 'script', 'src', rewrite);
  html = rewriteAttr(html, 'link', 'href', rewrite);
  html = rewriteAttr(html, '(?:img|audio|video|source|track|iframe|embed|object)', 'src', rewrite);

  return html;
}

export function injectCspAndConfig(
  html: string,
  webview: vscode.Webview,
  baseUri: vscode.Uri,
  nonce: string,
  apiBase: string,
  initialSettings?: SheriffInitialSettings
): string {
  const csp = webview.cspSource;
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src ${csp}; script-src ${csp} 'unsafe-inline' 'unsafe-eval' blob:; style-src ${csp} 'unsafe-inline'; img-src ${csp} data: blob:; font-src ${csp} data:; connect-src ${apiBase} ws: wss: http: https:; worker-src ${csp} blob: data:; frame-src ${csp};">`;

  const globals: Record<string, string> = {
    __SHERIFF_API_BASE__: apiBase,
    __SHERIFF_UI_BASE__: webview.asWebviewUri(baseUri).toString(),
  };

  if (initialSettings) {
    globals.__SHERIFF_INITIAL_CWD__ = initialSettings.cwd;
    globals.__SHERIFF_INITIAL_ENTRY__ = initialSettings.entry;
  }

  const assignments = Object.entries(globals)
    .map(([k, v]) => `window.${k}=${JSON.stringify(v)};`)
    .join('\n');

  const configScript = `<script>\n(function(){\n${assignments}\n})();\n</script>`;

  html = html.replace(/<head>/i, `<head>\n    ${cspMeta}\n    ${configScript}`);
  html = html.replace(/<script(?![^>]*\s(?:src|nonce)=)([^>]*)>/gi, `<script nonce="${nonce}"$1>`);

  return html;
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
