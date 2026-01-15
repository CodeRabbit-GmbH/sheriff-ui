import type { LineConfig } from 'konva/lib/shapes/Line';
import type { OrgChartConfig } from '../../+state/models/org-chart-config';

type TitleSeparatorCfg = {
  title: Pick<OrgChartConfig['title'], 'height' | 'paddingX'>;
  nodeBox: Pick<OrgChartConfig['nodeBox'], 'borderColor'>;
};

export function buildTitleSeparator(
  hasTags: boolean,
  position: { x: number; y: number },
  width: number,
  cfg: TitleSeparatorCfg,
): LineConfig | undefined {
  if (!hasTags) return undefined;
  const sepY = position.y + cfg.title.height - 4;
  return {
    points: [position.x + cfg.title.paddingX, sepY, position.x + width - cfg.title.paddingX, sepY],
    stroke: cfg.nodeBox.borderColor,
    strokeWidth: 1,
    dash: [4, 4],
  };
}


