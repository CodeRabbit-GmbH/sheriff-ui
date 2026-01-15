import { ChangeDetectionStrategy, Component, input, output, viewChild, signal, inject, computed } from '@angular/core';

import type { FolderNode } from '../module-renderer/+state/models/folder-node';
import { OrgChartDiagramComponent } from '../module-renderer/org-chart-diagram.component';
import { ThemeService } from '../core/theme.service';
import { ORG_CHART_DEFAULT_CONFIG, ORG_CHART_DARK_CONFIG } from '../module-renderer/+state/models/org-chart-config';

@Component({
  selector: 'app-module-chart-panel',
  standalone: true,
  imports: [OrgChartDiagramComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'contents',
  },
  templateUrl: './module-chart-panel.component.html',
})
export class ModuleChartPanelComponent {
  private themeService = inject(ThemeService);
  protected chartConfig = computed(() =>
    this.themeService.theme() === 'dark' ? ORG_CHART_DARK_CONFIG : ORG_CHART_DEFAULT_CONFIG
  );

  tree = input<FolderNode | null>(null);
  targetModules = input.required<Set<string>>();
  draggingTag = input<string | null>(null);
  collapsed = input.required<boolean>();
  matrixCollapsed = input.required<boolean>();

  toggleCollapsed = output<void>();
  fit = output<void>();
  refresh = output<void>();
  selectionChange = output<string | null>();
  tagRemove = output<{ nodeId: string; tag: string }>();
  tagDropped = output<{ nodeId: string | null; tag: string }>();
  dragOver = output<void>();
  dragLeave = output<void>();

  protected isOverDropZone = signal(false);
  private chart = viewChild(OrgChartDiagramComponent);

  protected onDrop(evt: DragEvent): void {
    evt.preventDefault();
    evt.stopPropagation();

    const tag = this.draggingTag() || evt.dataTransfer?.getData('text/plain');
    if (!tag) {
      this.isOverDropZone.set(false);
      return;
    }

    const chart = this.chart();
    let nodeId: string | null = null;

    if (chart) {
      chart.setPointersPositions(evt);
      nodeId = chart.getNodeIdAtPointer();
    }

    this.tagDropped.emit({ nodeId, tag });
    this.isOverDropZone.set(false);
  }

  protected onDragOver(evt: DragEvent): void {
    evt.preventDefault();
    this.isOverDropZone.set(true);
    if (evt.dataTransfer) {
      evt.dataTransfer.dropEffect = 'copy';
    }
    this.dragOver.emit();
  }

  protected onDragLeave(): void {
    this.isOverDropZone.set(false);
    this.dragLeave.emit();
  }

  fitChart(): void {
    this.chart()?.fit();
  }
}
