export {};

/**
 * Global variables injected by the VS Code extension before Angular loads.
 * These enable the Sheriff UI to work in both browser and VS Code webview contexts.
 */
declare global {
  /**
   * Base URL for the Sheriff UI assets.
   * In VS Code webview: vscode-resource URL pointing to bundled UI.
   * In browser: undefined (uses relative paths).
   */
  // eslint-disable-next-line no-var
  var __SHERIFF_UI_BASE__: string | undefined;

  /**
   * Base URL for Sheriff API requests.
   * In VS Code webview: absolute URL like "http://127.0.0.1:3012".
   * In browser: undefined (uses relative URLs).
   */
  // eslint-disable-next-line no-var
  var __SHERIFF_API_BASE__: string | undefined;

  /**
   * Initial working directory path.
   * Set when user opens Sheriff from a specific folder in VS Code.
   */
  // eslint-disable-next-line no-var
  var __SHERIFF_INITIAL_CWD__: string | undefined;

  /**
   * Initial entry file path.
   * Default entry point for analysis in VS Code.
   */
  // eslint-disable-next-line no-var
  var __SHERIFF_INITIAL_ENTRY__: string | undefined;
}
