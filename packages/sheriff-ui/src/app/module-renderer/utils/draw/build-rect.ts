import type { RectConfig } from 'konva/lib/shapes/Rect';
import type { OrgChartConfig } from '../../+state/models/org-chart-config';
import type { FolderNode } from '../../+state/models/folder-node';

type RectCfg = Required<Pick<OrgChartConfig, 'nodeBox' | 'sheriffModuleBackgroundColor'>> & {
  nodeBox: Pick<OrgChartConfig['nodeBox'], 'cornerRadius' | 'fill' | 'borderColor' | 'borderWidth'>;
};

export function buildRect(args: {
  node: FolderNode;
  position: { x: number; y: number };
  width: number;
  height: number;
  cfg: RectCfg;
}): RectConfig {
  const { node, position, width, height, cfg } = args;
  return {
    id: node.id,
    x: position.x,
    y: position.y,
    width,
    height,
    cornerRadius: cfg.nodeBox.cornerRadius,
    fill: node.isSheriffModule ? cfg.sheriffModuleBackgroundColor : cfg.nodeBox.fill,
    stroke: cfg.nodeBox.borderColor,
    strokeWidth: cfg.nodeBox.borderWidth,
  };
}


