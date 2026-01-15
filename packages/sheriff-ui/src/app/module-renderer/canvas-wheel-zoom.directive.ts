import { Directive, input, afterNextRender, DestroyRef, inject } from '@angular/core';
import { StageComponent } from 'ng2-konva';
import type { Stage } from 'konva/lib/Stage';

export type CanvasWheelZoomOptions = {
  scaleBy?: number;
  requireCtrl?: boolean;
};

@Directive({
  selector: '[appCanvasWheelZoom]',
  standalone: true,
})
export class CanvasWheelZoomDirective {
  opts = input<CanvasWheelZoomOptions | '' | undefined>();

  private stageCmp = inject(StageComponent);
  private destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const stage = this.stageCmp?.getStage?.() as Stage | undefined;
      if (!stage) return;
      const options = this.normalizeOptions(this.opts());
      const handler = (e: { evt: WheelEvent }) => {
        const evt = e.evt;
        if (options.requireCtrl && !evt.ctrlKey && !evt.metaKey) return;
        evt.preventDefault();
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const mousePointTo = {
          x: (pointer.x - stage.x()) / oldScale,
          y: (pointer.y - stage.y()) / oldScale,
        };
        const direction = evt.deltaY > 0 ? -1 : 1;
        const newScale = direction > 0 ? oldScale * options.scaleBy : oldScale / options.scaleBy;
        stage.scale({ x: newScale, y: newScale });
        stage.position({
          x: pointer.x - mousePointTo.x * newScale,
          y: pointer.y - mousePointTo.y * newScale,
        });
        stage.batchDraw();
      };
      stage.on('wheel', handler);
      this.destroyRef.onDestroy(() => stage.off('wheel', handler));
    });
  }

  private normalizeOptions(opts: CanvasWheelZoomOptions | '' | undefined): Required<CanvasWheelZoomOptions> {
    return {
      scaleBy: (opts && typeof opts === 'object' && opts.scaleBy) ? opts.scaleBy : 1.1,
      requireCtrl: !(opts && typeof opts === 'object') || opts.requireCtrl !== false,
    };
  }
}



