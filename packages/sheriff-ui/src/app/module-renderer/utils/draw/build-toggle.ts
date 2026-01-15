import type { CircleConfig } from 'konva/lib/shapes/Circle';
import type { LineConfig } from 'konva/lib/shapes/Line';
import type { OrgChartConfig } from '../../+state/models/org-chart-config';
import type { FolderNode } from '../../+state/models/folder-node';

type ToggleCfg = {
  toggle: Pick<OrgChartConfig['toggle'], 'radius' | 'circleFill' | 'circleStroke' | 'signFill'>;
};

export function buildToggle(args: {
  node: FolderNode;
  position: { x: number; y: number };
  width: number;
  height: number;
  cfg: ToggleCfg;
  isCollapsed: boolean;
}): { circle: CircleConfig; horiz: LineConfig; vert?: LineConfig } | null {
  const { node, position, width, height, cfg, isCollapsed } = args;
  if (!node.hasChildren) return null;
  const cx = position.x + width / 2;
  const cy = position.y + height;
  return {
    circle: {
      x: cx,
      y: cy,
      radius: cfg.toggle.radius,
      fill: cfg.toggle.circleFill,
      stroke: cfg.toggle.circleStroke,
      strokeWidth: 1,
    },
    horiz: {
      points: [cx - 5, cy, cx + 5, cy],
      stroke: cfg.toggle.signFill,
      strokeWidth: 2,
    },
    vert: isCollapsed
      ? {
          points: [cx, cy - 5, cx, cy + 5],
          stroke: cfg.toggle.signFill,
          strokeWidth: 2,
        }
      : undefined,
  };
}


