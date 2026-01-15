import { signalStoreFeature, type, withComputed } from '@ngrx/signals';
import { computed } from '@angular/core';
import type { LineConfig } from 'konva/lib/shapes/Line';
import type { RectConfig } from 'konva/lib/shapes/Rect';
import type { TextConfig } from 'konva/lib/shapes/Text';
import type { CircleConfig } from 'konva/lib/shapes/Circle';
import { ORG_CHART_DEFAULT_CONFIG, OrgChartConfig } from '../models/org-chart-config';
import { DrawNode } from '../models/draw-node';
import { FolderNode } from '../models/folder-node';
import { buildRect } from '../../utils/draw/build-rect';
import { buildTitle } from '../../utils/draw/build-title';
import { buildTitleSeparator } from '../../utils/draw/build-title-separator';
import { buildTags } from '../../utils/draw/build-tags';
import { flattenFolderNodes } from '../../../shared/flatten-folder-nodes';

export type LayoutData = {
  pos: Map<string, { x: number; y: number }>;
  lw: number;
  baseH: number;
  heightById: Map<string, number>;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const withNodeRenderer = <_>() =>
  signalStoreFeature(
    {
      state: type<{
        config: Partial<OrgChartConfig>;
        tree: FolderNode | null;
        collapsed: Set<string>;
        selectedId: string | null;
        targetModules: Set<string>;
      }>(),
    },
    withComputed((store) => ({
      links: computed((): LineConfig[] => {
        const ns = flattenFolderNodes(store.tree());
        const { pos, lw, heightById, baseH } = (store as unknown as { layout: () => LayoutData }).layout();
        const cfg = store.config();
        const out = ns
          .filter((n: FolderNode) => n.parentId && pos.has(n.id) && pos.has(n.parentId!))
          .map((n: FolderNode) => {
            const p = pos.get(n.parentId!)!;
            const c = pos.get(n.id)!;
            const parentHeight = heightById.get(n.parentId!) ?? baseH;
            const startX = p.x + lw / 2,
              startY = p.y + parentHeight;
            const endX = c.x + lw / 2,
              endY = c.y;
            const cfgLine: LineConfig = {
              points: [
                startX,
                startY,
                startX,
                (startY + endY) / 2,
                endX,
                (startY + endY) / 2,
                endX,
                endY,
              ],
              stroke: cfg.link?.stroke ?? ORG_CHART_DEFAULT_CONFIG.link.stroke,
              strokeWidth: cfg.link?.strokeWidth ?? ORG_CHART_DEFAULT_CONFIG.link.strokeWidth,
            };
            return cfgLine;
          });
        const selectedId = store.selectedId();
        const targetModules = store.targetModules();
        if (selectedId && targetModules instanceof Set && targetModules.size > 0) {

          for (const l of out) {
            (l as LineConfig).opacity = 0.5;
          }
          if (pos.has(selectedId)) {
            const sp = pos.get(selectedId)!;
            const sHeight = heightById.get(selectedId) ?? baseH;
            const sx = sp.x + lw / 2;
            const sy = sp.y + sHeight / 2;
            for (const tid of targetModules) {
              if (!pos.has(tid)) continue;
              const tp = pos.get(tid)!;
              const tHeight = heightById.get(tid) ?? baseH;
              const tx = tp.x + lw / 2;
              const ty = tp.y + tHeight / 2;
              const midY = (sy + ty) / 2;
              out.push({
                points: [sx, sy, sx, midY, tx, midY, tx, ty],
                stroke: '#2e7d32',
                strokeWidth: (cfg.link?.strokeWidth ?? ORG_CHART_DEFAULT_CONFIG.link.strokeWidth) + 1,
                tension: 0.4,
              });
            }
          }
        }
        return out;
      }),
      drawNodes: computed((): DrawNode[] => {
        const ns = flattenFolderNodes(store.tree());
        const { pos, lw, heightById, baseH } = (store as unknown as { layout: () => LayoutData }).layout();
        const cfg = store.config();
        const collapsed = store.collapsed();
        const selectedId = store.selectedId();
        const targetModules = store.targetModules();
        const fullCfg: OrgChartConfig = {
          ...ORG_CHART_DEFAULT_CONFIG,
          ...cfg,
          stage: { ...ORG_CHART_DEFAULT_CONFIG.stage, ...(cfg.stage ?? {}) },
          layout: { ...ORG_CHART_DEFAULT_CONFIG.layout, ...(cfg.layout ?? {}) },
          nodeBox: { ...ORG_CHART_DEFAULT_CONFIG.nodeBox, ...(cfg.nodeBox ?? {}) },
          title: { ...ORG_CHART_DEFAULT_CONFIG.title, ...(cfg.title ?? {}) },
          tags: { ...ORG_CHART_DEFAULT_CONFIG.tags, ...(cfg.tags ?? {}) },
          toggle: { ...ORG_CHART_DEFAULT_CONFIG.toggle, ...(cfg.toggle ?? {}) },
          link: { ...ORG_CHART_DEFAULT_CONFIG.link, ...(cfg.link ?? {}) },
          wheel: { ...ORG_CHART_DEFAULT_CONFIG.wheel, ...(cfg.wheel ?? {}) },
        };
        const out = ns
          .filter((n: FolderNode) => pos.has(n.id))
          .map((n: FolderNode) => {
            const p = pos.get(n.id)!;
            const height = heightById.get(n.id) ?? baseH;
            const rect: RectConfig = buildRect({ node: n, position: p, width: lw, height, cfg: fullCfg });
            if (selectedId === n.id) {
              rect.stroke = '#2e7d32';
              rect.strokeWidth = (typeof rect.strokeWidth === 'number' ? rect.strokeWidth : 2) + 1;
              rect.shadowBlur = 8;
              rect.shadowColor = '#2e7d32';
            } else if (targetModules instanceof Set && targetModules.size > 0 && targetModules.has(n.id)) {
              rect.stroke = '#81c784';
              rect.strokeWidth = (typeof rect.strokeWidth === 'number' ? rect.strokeWidth : 2);
            } else if (selectedId && targetModules instanceof Set && targetModules.size > 0) {
              (rect as RectConfig).opacity = 0.5;
            }
            const borderTop: LineConfig | undefined = undefined;
            const hasTags = (n.tags?.length ?? 0) > 0;
            const title: TextConfig = buildTitle(n, p, height, fullCfg);
            const titleSeparator: LineConfig | undefined = buildTitleSeparator(hasTags, p, lw, fullCfg);
            const tagsCfg = buildTags(n, p, fullCfg);
            const toggleBuilt = ((): { circle: CircleConfig; horiz: LineConfig; vert?: LineConfig } | null => {
              if (!n.hasChildren) return null;
              const cx = p.x + lw / 2;
              const cy = p.y + height;
              return {
                circle: {
                  x: cx,
                  y: cy,
                  radius: cfg.toggle?.radius ?? ORG_CHART_DEFAULT_CONFIG.toggle.radius,
                  fill: cfg.toggle?.circleFill ?? ORG_CHART_DEFAULT_CONFIG.toggle.circleFill,
                  stroke: cfg.toggle?.circleStroke ?? ORG_CHART_DEFAULT_CONFIG.toggle.circleStroke,
                  strokeWidth: 1,
                },
                horiz: { points: [cx - 5, cy, cx + 5, cy], stroke: cfg.toggle?.signFill ?? ORG_CHART_DEFAULT_CONFIG.toggle.signFill, strokeWidth: 2 },
                vert: collapsed.has(n.id) ? { points: [cx, cy - 5, cx, cy + 5], stroke: cfg.toggle?.signFill ?? ORG_CHART_DEFAULT_CONFIG.toggle.signFill, strokeWidth: 2 } : undefined,
              };
            })();
            return new DrawNode({ id: n.id, rect, title, titleSeparator, borderTop, tags: tagsCfg, toggle: toggleBuilt });
          });
        return out;
      }),
    })),
  );
