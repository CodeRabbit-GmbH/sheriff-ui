import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { CodeEditorComponent } from '../shared/code-editor.component';
import { PanelResizeDirective } from '../shared/panel-resize.directive';

@Component({
  selector: 'app-code-preview-panel',
  standalone: true,
  imports: [CodeEditorComponent, PanelResizeDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'contents',
  },
  templateUrl: './code-preview-panel.component.html',
})
export class CodePreviewPanelComponent {
  draft = input.required<string>();
  validating = input.required<boolean>();
  previewValid = input.required<boolean>();
  previewErrors = input.required<string[]>();
  draftDirty = input.required<boolean>();
  collapsed = input.required<boolean>();

  toggleCollapsed = output<void>();
  draftChange = output<string>();
}
