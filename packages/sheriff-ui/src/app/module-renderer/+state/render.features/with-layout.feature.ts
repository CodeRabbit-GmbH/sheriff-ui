import {
  signalStoreFeature,
  type,
  withComputed,
} from '@ngrx/signals';
import { computed } from '@angular/core';
import {
  ORG_CHART_DEFAULT_CONFIG,
  OrgChartConfig,
} from '../models/org-chart-config';
import type { FolderNode } from '../models/folder-node';
import { hierarchy, tree } from 'd3-hierarchy';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const withLayout = <_>() =>
  signalStoreFeature(
    {
      state: type<{
        config: OrgChartConfig;
        tree: FolderNode | null;
        collapsed: Set<string>;
      }>(),
    },
    withComputed((store) => ({
      layout: computed(() => {
        const cfg = store.config();
        const root = store.tree();
        const BASE_H_EMPTY =
          (cfg.title?.height ?? ORG_CHART_DEFAULT_CONFIG.title.height) +
          (cfg.nodeBox?.paddingBottom ??
            ORG_CHART_DEFAULT_CONFIG.nodeBox.paddingBottom);
        if (!root)
          return {
            pos: new Map<string, { x: number; y: number }>(),
            lw:
              cfg.layout?.nodeWidth ??
              ORG_CHART_DEFAULT_CONFIG.layout.nodeWidth,
            baseH: BASE_H_EMPTY,
            heightById: new Map<string, number>(),
          };
        const collapsed = store.collapsed();
        const h = hierarchy(root, (d) =>
          collapsed.has(d.id) ? [] : d.children,
        );
        const nodeWidth = cfg.layout.nodeWidth;
        const H_GAP = cfg.layout.hGap;
        const V_GAP = cfg.layout.vGap;
        const TOGGLE_RADIUS = cfg.toggle.radius;
        const SAFE = cfg.layout.safePad;
        const layoutAlgo = tree<FolderNode>().nodeSize([nodeWidth + H_GAP, 0]);
        layoutAlgo(h);
        let minX = Infinity;
        let maxX = -Infinity;
        const BASE_H = cfg.title.height + cfg.nodeBox.paddingBottom;
        const heightById = new Map<string, number>();
        const depthMax = new Map<number, number>();
        h.each((d) => {
          const x = d.x ?? 0;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          const id = d.data.id;
          const n = d.data;
          const tagCount = n.tags?.length ?? 0;
          const lineH = cfg.tags.lineHeight;
          const gapY = cfg.tags.gapY;
          const endGap = cfg.tags.endGap;
          // Calculate height: for n tags, there are n lineHeights and (n-1) gaps
          const tagsHeight = tagCount > 0 
            ? tagCount * lineH + (tagCount - 1) * gapY 
            : 0;
          const hgtContent = tagsHeight + BASE_H + (tagCount > 0 ? endGap : 0);
          heightById.set(id, hgtContent);
          const levelMax = depthMax.get(d.depth) ?? 0;
          const hgtWithToggle = hgtContent + TOGGLE_RADIUS + SAFE;
          if (hgtWithToggle > levelMax) depthMax.set(d.depth, hgtWithToggle);
        });
        const offsetX = -minX;
        const maxDepth = Math.max(0, ...Array.from(depthMax.keys()));
        const cumulative: number[] = new Array(maxDepth + 1).fill(0);
        for (let d = 1; d <= maxDepth; d++) {
          cumulative[d] =
            cumulative[d - 1] + (depthMax.get(d - 1) ?? BASE_H) + V_GAP;
        }
        const pos = new Map<string, { x: number; y: number }>();
        h.each((d) => {
          const y = SAFE + cumulative[d.depth];
          const x = (d.x ?? 0) + offsetX;
          pos.set(d.data.id, { x, y });
        });
        return { pos, lw: nodeWidth, baseH: BASE_H, heightById };
      }),
    })),
  );
