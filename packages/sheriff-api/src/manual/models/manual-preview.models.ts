import type { DirNode } from '../../core/types';
import type { DepRulesByTag, DepRulesForDisplay } from '../../core/config-evaluator';
import type { ManualConfigOptions, TagsByPathRel } from './manual-config.models';

/**
 * Modules configuration - supports both flat and nested entries:
 * - Flat: `{ 'src/app/feature': ['tag1', 'tag2'] }`
 * - Nested: `{ 'src/app': { 'feature1': ['tag1'], 'feature2': ['tag2'] } }`
 */
export type ModulesConfig = Record<string, Record<string, string[]> | string[]>;

/** Response sent to frontend for preview rendering. */
export type PreviewContextResponse = {
  cwd: string;
  tree: DirNode;
  configValid: boolean;
  errors?: string[];
  depRules: DepRulesForDisplay;
};

/** Full internal context used by backend for mutations and regeneration. */
export type PreviewContext = {
  cwd: string;
  tree: DirNode;
  analysis: unknown;
  fileIdByPathRel: Record<string, string>;
  configValid: boolean;
  errors?: string[];
  depRulesRaw?: DepRulesByTag;
  depRulesDisplay: DepRulesForDisplay;
  options?: ManualConfigOptions;
  inferredModulesByPathRel: TagsByPathRel;
  originalModulesConfig: TagsByPathRel;
  explicitModulesConfig: TagsByPathRel;
  modulesConfig?: ModulesConfig;
};

/** Converts PreviewContext to PreviewContextResponse for frontend. */
export function toPreviewResponse(ctx: PreviewContext): PreviewContextResponse {
  return {
    cwd: ctx.cwd,
    tree: ctx.tree,
    configValid: ctx.configValid,
    errors: ctx.errors,
    depRules: ctx.depRulesDisplay,
  };
}
