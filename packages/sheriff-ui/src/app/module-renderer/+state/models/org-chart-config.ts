export type OrgChartConfig = {
  stage: { initial: { width: number; height: number }; padding: number };
  layout: { nodeWidth: number; hGap: number; vGap: number; safePad: number };
  nodeBox: {
    cornerRadius: number;
    paddingBottom: number;
    fill: string;
    borderColor: string;
    borderWidth: number;
    topBorderColor: string;
    topBorderInset: number;
  };
  sheriffModuleBackgroundColor: string;
  title: {
    paddingX: number;
    offsetY: number;
    offsetYWithTags: number;
    fontSize: number;
    height: number;
    fill: string;
  };
  tags: {
    paddingX: number;
    startOffsetY: number;
    lineHeight: number;
    fontSize: number;
    fill: string;
    pillPaddingX: number;
    pillPaddingXLeft?: number;
    pillPaddingXRight?: number;
    pillPaddingY: number;
    pillRadius: number;
    palette: Record<string, string>;
    defaultFill: string;
    gapY: number;
    endGap: number;
  };
  toggle: {
    radius: number;
    circleFill: string;
    circleStroke: string;
    signFill: string;
    signFontSize: number;
    signFontWeight: string;
    signOffsetX: number;
    signOffsetY: number;
  };
  link: { stroke: string; strokeWidth: number };
  wheel: { scaleBy: number };
};

export const ORG_CHART_DEFAULT_CONFIG: OrgChartConfig = {
  stage: { initial: { width: 1200, height: 1000 }, padding: 40 },
  layout: { nodeWidth: 220, hGap: 40, vGap: 30, safePad: 32 },
  nodeBox: {
    cornerRadius: 10,
    paddingBottom: 12,
    fill: '#ffffff',
    borderColor: '#9ca3af',
    borderWidth: 2,
    topBorderColor: '#4f46e5',
    topBorderInset: 8,
  },
  sheriffModuleBackgroundColor: '#f0f9ff',
  title: { paddingX: 12, offsetY: 10, offsetYWithTags: 6, fontSize: 16, height: 34, fill: '#111827' },
  tags: {
    paddingX: 12,
    startOffsetY: 40,
    lineHeight: 16,
    fontSize: 12,
    fill: '#111827',
    pillPaddingX: 6,
    pillPaddingXLeft: 6,
    pillPaddingXRight: 6,
    pillPaddingY: 2,
    pillRadius: 8,
    palette: {
      'domain': '#10b981',
      'type': '#8b5cf6',
      'shared': '#06b6d4',
      'feature': '#f43f5e',
      'scope': '#f59e0b',
      'layer': '#6366f1',
      'core': '#9333ea',
      'util': '#14b8a6',
      'api': '#3b82f6',
      'ui': '#ec4899',
      'data': '#f97316',
      'test': '#64748b',
      'lib': '#d946ef',
      'app': '#0ea5e9',
      'config': '#65a30d',
      'root': '#3f3f46',
      'noTag': '#9ca3af',
    },
    defaultFill: '#8b5cf6',
    gapY: 4,
    endGap: 6,
  },
  toggle: {
    radius: 10,
    circleFill: '#ffffff',
    circleStroke: '#9ca3af',
    signFill: '#111827',
    signFontSize: 14,
    signFontWeight: '700',
    signOffsetX: -5,
    signOffsetY: -1,
  },
  link: { stroke: '#9ca3af', strokeWidth: 2 },
  wheel: { scaleBy: 1.1 },
};

export const ORG_CHART_DARK_CONFIG: OrgChartConfig = {
  ...ORG_CHART_DEFAULT_CONFIG,
  nodeBox: {
    ...ORG_CHART_DEFAULT_CONFIG.nodeBox,
    fill: '#1e293b',
    borderColor: '#475569',
    topBorderColor: '#818cf8',
  },
  sheriffModuleBackgroundColor: '#1e3a5f',
  title: { ...ORG_CHART_DEFAULT_CONFIG.title, fill: '#e2e8f0' },
  tags: {
    ...ORG_CHART_DEFAULT_CONFIG.tags,
    fill: '#e2e8f0',
    palette: {
      'domain': '#34d399',
      'type': '#a78bfa',
      'shared': '#22d3ee',
      'feature': '#fb7185',
      'scope': '#fbbf24',
      'layer': '#818cf8',
      'core': '#a855f7',
      'util': '#2dd4bf',
      'api': '#60a5fa',
      'ui': '#f472b6',
      'data': '#fb923c',
      'test': '#94a3b8',
      'lib': '#e879f9',
      'app': '#38bdf8',
      'config': '#84cc16',
      'root': '#a1a1aa',
      'noTag': '#64748b',
    },
    defaultFill: '#a78bfa',
  },
  toggle: {
    ...ORG_CHART_DEFAULT_CONFIG.toggle,
    circleFill: '#1e293b',
    circleStroke: '#475569',
    signFill: '#e2e8f0',
  },
  link: { stroke: '#475569', strokeWidth: 2 },
};
