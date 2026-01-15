import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, lineNumbers, keymap } from '@codemirror/view';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-code-editor',
  standalone: true,
  template: `<div #container class="editor-root w-full"></div>`,
  styles: [`
    :host {
      display: block;
      flex: 1 1 0;
      min-height: 0;
      width: 100%;
      height: 100%;
      position: relative;
    }
    .editor-root {
      position: absolute;
      inset: 0;
    }
    .editor-root :global(.cm-editor) {
      height: 100% !important;
      font-size: 14px;
    }
    .editor-root :global(.cm-scroller) {
      overflow: auto;
    }
  `],
})
export class CodeEditorComponent {
  private container = viewChild.required<ElementRef<HTMLElement>>('container');
  private themeService = inject(ThemeService);

  value = input<string>('');
  language = input<string>('typescript');
  valueChange = output<string>();

  private editorView = signal<EditorView | null>(null);
  private themeCompartment = new Compartment();
  private resizeObserver: ResizeObserver | null = null;
  private isDestroyed = false;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      setTimeout(() => {
        if (!this.isDestroyed) this.initEditor();
      }, 100);
    });

    effect(() => {
      const view = this.editorView();
      if (!view || this.isDestroyed) return;
      const next = this.value() ?? '';
      const current = view.state.doc.toString();
      if (next !== current) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: next },
        });
      }
    });

    effect(() => {
      const view = this.editorView();
      if (!view || this.isDestroyed) return;
      const isDark = this.themeService.theme() === 'dark';
      view.dispatch({
        effects: this.themeCompartment.reconfigure(isDark ? vscodeDark : vscodeLight),
      });
    });

    destroyRef.onDestroy(() => {
      this.isDestroyed = true;
      this.teardown();
    });
  }

  private initEditor(): void {
    if (this.isDestroyed || this.editorView()) return;

    const el = this.container()?.nativeElement;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      const observer = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0 && !this.editorView() && !this.isDestroyed) {
          observer.disconnect();
          this.createEditor(el);
        }
      });
      observer.observe(el);
      return;
    }

    this.createEditor(el);
  }

  private createEditor(el: HTMLElement): void {
    if (this.isDestroyed || this.editorView()) return;

    const isDark = this.themeService.theme() === 'dark';

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !this.isDestroyed) {
        const newValue = update.state.doc.toString();
        if (newValue !== this.value()) {
          this.valueChange.emit(newValue);
        }
      }
    });

    const state = EditorState.create({
      doc: this.value() ?? '',
      extensions: [
        lineNumbers(),
        javascript({ typescript: true }),
        keymap.of([...defaultKeymap, indentWithTab]),
        EditorView.lineWrapping,
        EditorState.tabSize.of(2),
        this.themeCompartment.of(isDark ? vscodeDark : vscodeLight),
        updateListener,
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: el,
    });

    this.resizeObserver = new ResizeObserver(() => {
      if (!this.isDestroyed) {
        view.requestMeasure();
      }
    });
    this.resizeObserver.observe(el);

    this.editorView.set(view);
  }

  private teardown(): void {
    this.resizeObserver?.disconnect();
    this.editorView()?.destroy();
    this.resizeObserver = null;
    this.editorView.set(null);
  }
}
