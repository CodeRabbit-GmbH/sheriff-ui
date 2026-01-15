import { signalStoreFeature, type, withMethods } from '@ngrx/signals';
import type { OrgChartConfig } from '../models/org-chart-config';
import { patchState } from '@ngrx/signals';
import { FolderNode } from '../models/folder-node';
import { visitFolderTree } from '../../../shared/visit-folder-tree';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const withInputs = <_>() =>
  signalStoreFeature(
    {
      state: type<{
        config: Partial<OrgChartConfig>;
        tree: FolderNode | null;
        expandDepth: number;
        collapsed: Set<string>;
      }>(),
    },
    withMethods((store) => ({
      load(cfg: Partial<OrgChartConfig>, tree: FolderNode | null, expandDepth: number) {
        const prevCfg = store.config();
        const prevTree = store.tree();
        const prevExp = store.expandDepth();
        let nextCollapsed = store.collapsed();
        if (!nextCollapsed || nextCollapsed.size === 0) {
          const init = new Set<string>();
          if (tree) {
            const depthExpand = Math.max(0, expandDepth ?? 0);
            visitFolderTree(tree, (n, _p, depth) => {
              if ((depth ?? 0) > depthExpand) init.add(n.id);
            });
          }
          if (!nextCollapsed || nextCollapsed.size !== init.size) nextCollapsed = init;
        }
        const unchanged = prevCfg === cfg && prevTree === tree && prevExp === expandDepth && nextCollapsed === store.collapsed();
        if (unchanged) return;
        patchState(store, { config: cfg, tree, expandDepth, collapsed: nextCollapsed });
      },
    })),
  );
