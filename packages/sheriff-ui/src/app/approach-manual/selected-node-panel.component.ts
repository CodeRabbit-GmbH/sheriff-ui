import { ChangeDetectionStrategy, Component, input, output, viewChild, ElementRef } from '@angular/core';

import type { FolderNode } from '../module-renderer/+state/models/folder-node';
import { tagBadgeClass } from './utils/tag-utils';

@Component({
  selector: 'app-selected-node-panel',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'contents',
  },
  templateUrl: './selected-node-panel.component.html',
})
export class SelectedNodePanelComponent {
  node = input<FolderNode | null>(null);
  allTags = input.required<string[]>();
  collapsed = input.required<boolean>();

  toggleCollapsed = output<void>();
  removeTag = output<string>();
  addTag = output<string>();

  private tagPickRef = viewChild<ElementRef<HTMLSelectElement>>('tagPick');

  protected getTagBadgeClass(tag: string): string {
    return tagBadgeClass(tag);
  }

  protected onAddTag(): void {
    const select = this.tagPickRef()?.nativeElement;
    if (select?.value) {
      this.addTag.emit(select.value);
    }
  }
}
