import { Component, inject, signal, viewChild, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { ManualStore } from './+state/manual.store';
import { TagCreatedEvent } from './create-tag-modal.component';
import { TagsPanelComponent } from './tags-panel.component';
import { SelectedNodePanelComponent } from './selected-node-panel.component';
import { ModuleChartPanelComponent } from './module-chart-panel.component';
import { DependencyMatrixPanelComponent } from './dependency-matrix-panel.component';
import { CodePreviewPanelComponent } from './code-preview-panel.component';
import { ThemeService } from '../core/theme.service';
import { getSheriffAssetUrl } from '../shared/asset-url';

@Component({
  selector: 'app-approach-manual',
  standalone: true,
  imports: [
    TagsPanelComponent,
    SelectedNodePanelComponent,
    ModuleChartPanelComponent,
    DependencyMatrixPanelComponent,
    CodePreviewPanelComponent,
  ],
  templateUrl: './approach-manual.component.html',
})
export class ApproachManualComponent {
  protected store = inject(ManualStore);
  protected themeService = inject(ThemeService);
  private router = inject(Router);
  private chartPanel = viewChild(ModuleChartPanelComponent);

  // Expose Object for template
  protected Object = Object;
  protected readonly logoUrl = getSheriffAssetUrl('logo.png');

  protected matrixCollapsed = signal(true);
  protected chartCollapsed = signal(false);
  protected tagsCollapsed = signal(true);
  protected codePreviewCollapsed = signal(false);
  protected selectedCollapsed = signal(false);

  @HostListener('window:tagCreated', ['$event'])
  onTagCreated(event: CustomEvent<TagCreatedEvent>): void {
    if (event.detail?.tag) {
      this.store.modifyTag('selected', 'add', event.detail.tag);
    }
  }

  constructor() {
    this.store.init();
  }

  protected onOpenNewTagModal(): void {
    this.router.navigate([{ outlets: { popup: ['create-tag'] } }], {
      queryParams: { kinds: JSON.stringify(this.store.detectedTagKinds()) },
    });
  }

  protected onTagDropped(evt: { nodeId: string | null; tag: string }): void {
    if (evt.nodeId) {
      this.store.modifyTag(evt.nodeId, 'add', evt.tag);
    }
    this.store.setDraggingTag(null);
  }

  protected onFitChart(): void {
    this.chartPanel()?.fitChart();
  }

}
