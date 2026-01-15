/**
 * Returns a URL to an asset that works both:
 * - in the normal web build (served from "/")
 * - in the VS Code webview (served from a vscode-resource URL)
 */
export function getSheriffAssetUrl(assetPath: string): string {
  const normalizedPath = assetPath.replace(/^\/+/, '');

  const base = globalThis.__SHERIFF_UI_BASE__;
  if (!base) {
    return `/${normalizedPath}`;
  }

  const normalizedBase = base.replace(/\/+$/, '');
  return `${normalizedBase}/${normalizedPath}`;
}
