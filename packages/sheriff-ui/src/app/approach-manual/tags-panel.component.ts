import { ChangeDetectionStrategy, Component, input, output, signal, computed } from '@angular/core';

import type { FolderNode } from '../module-renderer/+state/models/folder-node';
import { tagBadgeClass } from './utils/tag-utils';
import { PanelResizeDirective } from '../shared/panel-resize.directive';

@Component({
  selector: 'app-tags-panel',
  standalone: true,
  imports: [PanelResizeDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'contents',
  },
  templateUrl: './tags-panel.component.html',
})
export class TagsPanelComponent {
  tags = input.required<string[]>();
  tagUsageCounts = input.required<Map<string, number>>();
  collapsed = input.required<boolean>();
  selectedNode = input<FolderNode | null>(null);

  tagDragStart = output<{ event: DragEvent; tag: string }>();
  tagDragEnd = output<void>();
  filterChange = output<string>();
  toggleCollapsed = output<void>();
  openNewTagModal = output<void>();

  protected filterValue = signal('');

  protected filteredTags = computed(() => {
    const q = this.filterValue().trim().toLowerCase();
    const allTags = this.tags();
    if (!q) return allTags;
    return allTags.filter((t) => t.toLowerCase().includes(q));
  });

  protected getTagBadgeClass(tag: string): string {
    return tagBadgeClass(tag);
  }

  protected onFilterInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value || '';
    this.filterValue.set(value);
    this.filterChange.emit(value);
  }

  protected onDragStart(event: DragEvent, tag: string): void {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', tag);
    }
    this.tagDragStart.emit({ event, tag });
  }
}
