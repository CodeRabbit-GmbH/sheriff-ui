import { signalStore, withState } from '@ngrx/signals';
import type { FolderNode } from './models/folder-node';
import {
  ORG_CHART_DEFAULT_CONFIG,
  type OrgChartConfig,
} from './models/org-chart-config';
import { withInputs } from './render.features/with-inputs.feature';
import { withSelection } from './render.features/with-selection.feature';
import { withLayout } from './render.features/with-layout.feature';
import { withNodeRenderer } from './render.features/with-node-renderer.feature';

export interface RenderState {
  config: OrgChartConfig;
  tree: FolderNode | null;
  expandDepth: number;
  collapsed: Set<string>;
}

export const RenderStore = signalStore(
  withState<RenderState>({
    config: ORG_CHART_DEFAULT_CONFIG,
    tree: null,
    expandDepth: 1,
    collapsed: new Set<string>(),
  }),
  withInputs(),
  withSelection(),
  withLayout(),
  withNodeRenderer(),
);
