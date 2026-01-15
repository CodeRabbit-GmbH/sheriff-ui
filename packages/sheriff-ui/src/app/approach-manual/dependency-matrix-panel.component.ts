import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import type { DepRulesForDisplay } from '../api/models';

@Component({
  selector: 'app-dependency-matrix-panel',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'contents',
  },
  templateUrl: './dependency-matrix-panel.component.html',
})
export class DependencyMatrixPanelComponent {

  tags = input.required<string[]>();
  depRules = input<DepRulesForDisplay | null>(null);
  collapsed = input.required<boolean>();

  toggleCollapsed = output<void>();
  toggleDepRule = output<{ from: string; to: string }>();

  protected hoveredMatrixTag = signal<string | null>(null);
  protected hoveredMatrixRow = signal<string | null>(null);
  protected hoveredMatrixCol = signal<string | null>(null);


  protected hasDepRule(from: string, to: string): boolean {
    const rules = this.depRules();
    return rules?.[from]?.includes(to) ?? false;
  }

  protected getAccessibleTags(tag: string): string[] {
    const rules = this.depRules();
    return rules?.[tag] ?? [];
  }

  protected onRowHover(row: string | null): void {
    this.hoveredMatrixTag.set(row);
    this.onMatrixCellHover(row, null);
  }

  protected onMatrixCellHover(row: string | null, col: string | null): void {
    this.hoveredMatrixRow.set(row);
    this.hoveredMatrixCol.set(col);
  }
}
