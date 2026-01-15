import {
  Directive,
  ElementRef,
  input,
  afterNextRender,
  DestroyRef,
  inject,
  HostListener,
  Renderer2,
  DOCUMENT,
} from '@angular/core';

export type PanelResizeOptions = {
  /** Default width in pixels */
  defaultWidth: number;
  /** Minimum width in pixels */
  minWidth: number;
  /** Maximum width in pixels */
  maxWidth: number;
  /** Storage key for persisting width */
  storageKey: string;
  /** Edge to place resize handle: 'left' or 'right' */
  handleEdge: 'left' | 'right';
};

@Directive({
  selector: '[appPanelResize]',
  standalone: true,
})
export class PanelResizeDirective {
  private elementRef = inject(ElementRef<HTMLElement>);
  private destroyRef = inject(DestroyRef);
  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);

  /** Configuration options (required) */
  options = input.required<PanelResizeOptions>();

  private resizeHandle: HTMLElement | null = null;
  private currentWidth = 0;
  private isResizing = false;
  private startX = 0;
  private startWidth = 0;

  constructor() {
    afterNextRender(() => {
      this.initializeResize();
    });

    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });
  }

  private initializeResize(): void {
    const element = this.elementRef.nativeElement;
    const options = this.options();
    if (!element || this.resizeHandle) return;

    // Load saved width or use default
    let initialWidth = options.defaultWidth;
    if (options.storageKey) {
      const saved = localStorage.getItem(options.storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) {
          initialWidth = Math.max(
            options.minWidth,
            Math.min(options.maxWidth, parsed),
          );
        }
      }
    }

    // Set initial width directly
    this.currentWidth = initialWidth;
    this.renderer.setStyle(element, 'width', `${initialWidth}px`);

    // Create resize handle
    this.resizeHandle = this.renderer.createElement('div');
    this.renderer.addClass(this.resizeHandle, 'panel-resize-handle');
    this.renderer.addClass(this.resizeHandle, `panel-resize-handle--${options.handleEdge}`);

    // Make sure parent has relative positioning
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.position === 'static') {
      this.renderer.setStyle(element, 'position', 'relative');
    }

    // Append handle to element
    this.renderer.appendChild(element, this.resizeHandle);

    // Mouse down handler
    this.renderer.listen(this.resizeHandle, 'mousedown', (e: MouseEvent) => this.onMouseDown(e));
  }

  private onMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    this.isResizing = true;
    this.startX = event.clientX;
    this.startWidth = this.currentWidth;

    // Update handle style during resize
    if (this.resizeHandle) {
      this.renderer.addClass(this.resizeHandle, 'panel-resize-handle--active');
    }

    // Prevent text selection during resize
    this.renderer.setStyle(this.document.body, 'userSelect', 'none');
    this.renderer.setStyle(this.document.body, 'cursor', 'ew-resize');
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isResizing) return;

    const options = this.options();
    const deltaX = event.clientX - this.startX;
    let newWidth: number;

    if (options.handleEdge === 'right') {
      newWidth = this.startWidth + deltaX;
    } else {
      newWidth = this.startWidth - deltaX;
    }

    // Clamp to min/max
    newWidth = Math.max(options.minWidth, Math.min(options.maxWidth, newWidth));
    this.currentWidth = newWidth;

    // Update DOM via Renderer2
    this.renderer.setStyle(this.elementRef.nativeElement, 'width', `${newWidth}px`);
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    if (!this.isResizing) return;

    const options = this.options();
    this.isResizing = false;

    // Restore handle style
    if (this.resizeHandle) {
      this.renderer.removeClass(this.resizeHandle, 'panel-resize-handle--active');
    }

    // Restore body styles
    this.renderer.removeStyle(this.document.body, 'userSelect');
    this.renderer.removeStyle(this.document.body, 'cursor');

    // Save to localStorage if storage key is provided
    if (options.storageKey) {
      localStorage.setItem(options.storageKey, this.currentWidth.toString());
    }
  }

  private cleanup(): void {
    if (this.resizeHandle) {
      this.renderer.removeChild(this.elementRef.nativeElement, this.resizeHandle);
    }
    this.resizeHandle = null;
  }
}
