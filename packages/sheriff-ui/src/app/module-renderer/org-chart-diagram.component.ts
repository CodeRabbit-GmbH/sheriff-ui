import {
  Component,
  input,
  viewChild,
  afterNextRender,
  inject,
  HostListener,
  effect,
  DestroyRef,
  output,
  ElementRef,
  signal,
} from '@angular/core';
import { StageComponent, CoreShapeComponent } from 'ng2-konva';
import {
  ORG_CHART_DEFAULT_CONFIG,
  type OrgChartConfig,
} from './+state/models/org-chart-config';
import { CanvasWheelZoomDirective } from './canvas-wheel-zoom.directive';
import { RenderStore } from './+state/render.store';
import { FolderNode } from './+state/models/folder-node';

@Component({
  selector: 'app-org-chart-diagram',
  standalone: true,
  imports: [StageComponent, CoreShapeComponent, CanvasWheelZoomDirective],
  templateUrl: './org-chart-diagram.component.html',
  providers: [RenderStore],
  host: {
    '[style.display]': '"block"',
    '[style.width]': '"100%"',
    '[style.height]': '"100%"',
    '[style.minHeight]': '"300px"',
  },
})
export class OrgChartDiagramComponent {
  private stageCmp = viewChild(StageComponent);
  private elementRef = inject(ElementRef);
  private resizeObserver: ResizeObserver | null = null;

  tree = input<FolderNode | null>(null);
  expandDepth = input<number>(1);
  config = input<Partial<OrgChartConfig>>(ORG_CHART_DEFAULT_CONFIG);
  targetModules = input<Set<string> | null>(null);
  showToolbar = input<boolean>(true);
  showBorder = input<boolean>(true);
  selectedIdChange = output<string | null>();
  tagRemove = output<{ nodeId: string; tag: string }>();

  protected render = inject(RenderStore);
  protected hoveredNodeId = signal<string | null>(null);

  stage: { width: number; height: number; draggable: boolean } = {
    width:
      this.config().stage?.initial.width ??
      ORG_CHART_DEFAULT_CONFIG.stage.initial.width,
    height:
      this.config().stage?.initial.height ??
      ORG_CHART_DEFAULT_CONFIG.stage.initial.height,
    draggable: true,
  };

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const stage = this.stageCmp()?.getStage?.();
      if (!stage) return;

      this.setupResizeObserver();
      this.updateStageSize();
      this.render.load(this.config(), this.tree(), this.expandDepth());
      this.setupHoverCursor(stage);
      setTimeout(() => this.fit(), 100);
    });

    const stop = effect(() => {
      const cfg = this.config();
      const tr = this.tree();
      const exp = this.expandDepth();
      this.render.load(cfg, tr, exp);
    });
    const stopSelection = effect(() => {
      this.selectedIdChange.emit(this.render.selectedId());
    });
    const stopTargetModules = effect(() => {
      const tm = this.targetModules();
      if (tm !== null) {
        this.render.setTargetModules(tm);
      }
    });
    destroyRef.onDestroy(() => {
      stop.destroy();
      stopSelection.destroy();
      stopTargetModules.destroy();
      this.resizeObserver?.disconnect();
    });
  }

  private resizeTimeout: ReturnType<typeof setTimeout> | null = null;

  private setupResizeObserver(): void {
    const element = this.elementRef.nativeElement;
    if (!element || typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => this.updateStageSize(), 50);
    });
    this.resizeObserver.observe(element);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private setupHoverCursor(stage: any): void {
    const container = stage.container();

    stage.on('mouseover', (e: { target: { id?: () => string; getClassName?: () => string } }) => {
      const target = e.target;
      const className = target?.getClassName?.() ?? '';
      if (className === 'Rect' || className === 'Text' || className === 'Circle') {
        container.style.cursor = 'pointer';
      }
    });

    stage.on('mouseout', () => {
      container.style.cursor = 'default';
    });
  }

  private updateStageSize(): void {
    const stage = this.stageCmp()?.getStage?.();
    if (!stage) return;

    const element = this.elementRef.nativeElement;
    const rect = element.getBoundingClientRect();
    const buttonBarHeight = this.showToolbar() ? 40 : 0;
    const width = Math.max(rect.width, 200);
    const height = Math.max(rect.height - buttonBarHeight, 200);

    if (width !== stage.width() || height !== stage.height()) {
      stage.size({ width, height });
      stage.batchDraw();
    }
  }

  getStage() {
    return this.stageCmp()?.getStage?.() ?? null;
  }

  setPointersPositions(evt: DragEvent | MouseEvent): void {
    const stage = this.getStage();
    stage?.setPointersPositions?.(evt as unknown as Event);
  }

  getNodeIdAtPointer(): string | null {
    const stage = this.getStage();
    if (!stage) return null;
    const pointer = stage.getPointerPosition?.();
    if (!pointer) return null;
    return this.getNodeIdAtPoint(pointer.x, pointer.y);
  }

  getNodeIdAtPoint(x: number, y: number): string | null {
    const stage = this.getStage();
    if (!stage) return null;

    const shape = stage.getIntersection({ x, y });
    if (shape) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let node: any = shape;
      while (node) {
        const id = node.id?.();
        if (id) {
          return id;
        }
        node = node.parent;
      }
    }

    const { pos, lw, heightById, baseH } = this.render.layout();
    for (const [id, p] of pos.entries()) {
      const h = heightById.get(id) ?? baseH;
      if (x >= p.x && x <= p.x + lw && y >= p.y && y <= p.y + h) {
        return id;
      }
    }
    return null;
  }

  onBackgroundClick(e: unknown) {
    const evt = e as { target?: { getClassName?: () => string } };
    const className = evt.target?.getClassName?.() ?? '';
    if (className === 'Stage' || className === 'Layer') {
      this.render.clearSelection();
      const stage = this.stageCmp()?.getStage?.();
      stage?.batchDraw();
    }
  }

  onSelectNode(e: unknown, id: string) {
    const evt = e as { cancelBubble?: boolean };
    if (evt) evt.cancelBubble = true;
    this.render.toggleSelected(id);
    const stage = this.stageCmp()?.getStage?.();
    stage?.batchDraw();
  }

  onNodeMouseEnter(e: unknown, id: string): void {
    this.hoveredNodeId.set(id);
    const evt = e as { target?: { getStage?: () => { container: () => HTMLDivElement } } };
    const stage = evt?.target?.getStage?.();
    if (stage) {
      stage.container().style.cursor = 'pointer';
    }
  }

  onNodeMouseLeave(e: unknown, id: string): void {
    this.hoveredNodeId.set(null);
    const evt = e as { target?: { getStage?: () => { container: () => HTMLDivElement } } };
    const stage = evt?.target?.getStage?.();
    if (stage) {
      stage.container().style.cursor = 'default';
    }
  }

  onRemoveTag(e: unknown, nodeId: string, tag: string): void {
    const evt = e as { cancelBubble?: boolean };
    if (evt) evt.cancelBubble = true;
    this.tagRemove.emit({ nodeId, tag });
  }

  onToggle(e: unknown, id: string) {
    const evt = e as { cancelBubble?: boolean };
    if (evt) evt.cancelBubble = true;
    const stage = this.stageCmp()?.getStage?.();
    const pointer = stage?.getPointerPosition?.();

    this.render.toggleCollapsed(id);
    stage?.batchDraw();

    if (stage && pointer) {
      const { pos, lw, heightById, baseH } = this.render.layout();
      const p = pos.get(id);
      if (p) {
        const h = heightById.get(id) ?? baseH;
        const toggle = { x: p.x + lw / 2, y: p.y + h };
        const scale = stage.scaleX() || 1;
        const newX = pointer.x - toggle.x * scale;
        const newY = pointer.y - toggle.y * scale;
        stage.position({ x: newX, y: newY });
        stage.batchDraw();
      }
    }
  }

  fit(): void {
    const stage = this.stageCmp()?.getStage?.();
    if (!stage) return;
    this.onWindowResize();
    const { pos, lw, heightById, baseH } = this.render.layout();
    const ids = [...pos.keys()];
    if (ids.length === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const id of ids) {
      const p = pos.get(id)!;
      const h = heightById.get(id) ?? baseH;
      const x1 = p.x,
        y1 = p.y;
      const x2 = p.x + lw,
        y2 = p.y + h;
      if (x1 < minX) minX = x1;
      if (y1 < minY) minY = y1;
      if (x2 > maxX) maxX = x2;
      if (y2 > maxY) maxY = y2;
    }
    const padding =
      this.config().stage?.padding ?? ORG_CHART_DEFAULT_CONFIG.stage.padding;
    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;
    const viewW = stage.width();
    const viewH = stage.height();
    const scale = Math.min(viewW / contentW, viewH / contentH);
    stage.scale({ x: scale, y: scale });
    const offsetX = (viewW - (maxX - minX) * scale) / 2 - minX * scale;
    const offsetY = (viewH - (maxY - minY) * scale) / 2 - minY * scale;
    stage.position({ x: offsetX, y: offsetY });
    stage.batchDraw();
  }

  zoom(factor: number): void {
    const stage = this.stageCmp()?.getStage?.();
    if (!stage) return;
    const oldScale = stage.scaleX() || 1;
    const pointer = stage.getPointerPosition() || {
      x: (stage.width() ?? 1200) / 2,
      y: (stage.height() ?? 700) / 2,
    };
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const newScale = oldScale * factor;
    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
    stage.batchDraw();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateStageSize();
  }
}
