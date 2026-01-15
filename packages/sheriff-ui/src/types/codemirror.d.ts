declare module 'codemirror' {
  // Minimal typings for our usage; CodeMirror v5 doesn't ship TS types.
  export type Editor = {
    getValue(): string;
    setValue(value: string): void;
    setOption(option: string, value: unknown): void;
    setSize(width: string, height: string): void;
    refresh(): void;
    on(event: 'change', handler: () => void): void;
    off(event: 'change', handler: () => void): void;
    getWrapperElement(): HTMLElement;
  };

  export default function CodeMirror(
    element: HTMLElement,
    options: Record<string, unknown>,
  ): Editor;
}

