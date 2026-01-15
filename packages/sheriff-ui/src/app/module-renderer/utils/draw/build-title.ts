import type { TextConfig } from 'konva/lib/shapes/Text';
import type { OrgChartConfig } from '../../+state/models/org-chart-config';
import type { FolderNode } from '../../+state/models/folder-node';

type TitleCfg = {
  title: Pick<OrgChartConfig['title'], 'paddingX' | 'offsetYWithTags' | 'fontSize' | 'fill'>;
};

export function buildTitle(
  node: FolderNode,
  position: { x: number; y: number },
  height: number,
  cfg: TitleCfg,
): TextConfig {
  const tags = node.tags || [];
  const hasTags = tags.length > 0;
  const titleOffsetY = hasTags ? cfg.title.offsetYWithTags : Math.max(0, (height - cfg.title.fontSize) / 2);
  return {
    x: position.x + cfg.title.paddingX,
    y: position.y + titleOffsetY,
    text: node.name,
    fill: cfg.title.fill,
    fontSize: cfg.title.fontSize,
  };
}


