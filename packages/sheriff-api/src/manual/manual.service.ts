import { resolveCwd, readConfig, writeConfig, applyConfigPreview, previewWriteConfig } from '../core';
import {
  evaluateSheriffConfig,
  parseDepRules,
  parseModulesNode,
  parseTaggingNode,
  parseEntryPoints,
  type DepRulesByTag,
  type DepRulesForDisplay,
} from '../core/config-evaluator';
import { optimizeModuleTags, generateManualSheriffConfig } from './utils/config-generator';
import { materializeModulesByPathRel, applyModulesToTree } from './utils/materialize-modules';
import { ConfigMigrator } from './utils/config-migrator';
import type {
  InitRequestDto,
  InitResponseDto,
  PreviewRequestDto,
  SaveRequestDto,
  SaveResponseDto,
  AddTagRequestDto,
  RemoveTagRequestDto,
  DeleteTagRequestDto,
  ToggleDepRuleRequestDto,
  MutationResponseDto,
} from './models/dtos';
import { ManualConfigOptionsSchema, type ManualConfigOptions, type TagsByPathRel } from './models/manual-config.models';
import { toPreviewResponse, type PreviewContext, type PreviewContextResponse, type ModulesConfig } from './models/manual-preview.models';

export { ConfigMigrator } from './utils/config-migrator';

const DEFAULT_ENTRY = 'src/main.ts';

export class ManualService {
  private static deriveStaticDepRules(raw: DepRulesByTag | null | undefined): Record<string, string[]> {
    if (!raw) return {};
    const result: Record<string, string[]> = {};
    for (const [from, rule] of Object.entries(raw)) {
      result[from] = rule.kind === 'static' || rule.kind === 'mixed' ? rule.tags : [];
    }
    return result;
  }

  init(input: InitRequestDto): InitResponseDto {
    const cwd = resolveCwd(input.cwd);

    let missingConfig = false;
    let activeConfigContent = '';
    try {
      activeConfigContent = readConfig(cwd).content ?? '';
    } catch {
      missingConfig = true;
    }

    const draft = ConfigMigrator.migrateToV2(activeConfigContent);

    const inputEntry = input.entry?.trim();
    let entry = inputEntry || DEFAULT_ENTRY;
    let availableEntries: string[] = [entry];

    if (draft.trim()) {
      try {
        const evaluated = evaluateSheriffConfig(draft);
        const configEntries = parseEntryPoints(evaluated);
        if (configEntries && Object.keys(configEntries).length > 0) {
          // Extract paths from entryPoints config (values are paths)
          availableEntries = Object.values(configEntries);

          if (inputEntry) {
            if (!availableEntries.includes(inputEntry)) {
              availableEntries = [...availableEntries, inputEntry];
            }
            entry = inputEntry;
          } else {
            // Default to first available entry
            entry = availableEntries[0];
          }
        }
      } catch {
        // Config evaluation failed, use defaults
      }
    }
    const fullPreview = draft.trim() ? this.buildPreviewContext({ draft, entry, cwd }) : undefined;
    const preview = fullPreview ? toPreviewResponse(fullPreview) : undefined;

    return { cwd, entry, missingConfig, activeConfigContent, draft, preview, availableEntries };
  }

  initDefault(input: InitRequestDto): InitResponseDto {
    const cwd = resolveCwd(input.cwd);
    const entry = input.entry?.trim() || DEFAULT_ENTRY;

    const defaultConfig = `import { SheriffConfig } from '@softarc/sheriff-core';\n\nexport const config: SheriffConfig = {\n  enableBarrelLess: true,\n  modules: {},\n  depRules: {\n    'root': 'noTag',\n    'noTag': 'noTag',\n  },\n  ${entry ? `entryFile: '${entry}',` : ''}\n};\n`;

    writeConfig(cwd, defaultConfig);

    const draft = readConfig(cwd).content ?? '';
    const fullPreview = this.buildPreviewContext({ draft, entry, cwd });

    return {
      cwd,
      entry,
      missingConfig: false,
      activeConfigContent: draft,
      draft,
      preview: toPreviewResponse(fullPreview),
      availableEntries: [entry],
    };
  }

  preview(input: PreviewRequestDto): PreviewContextResponse {
    const cwd = resolveCwd(input.cwd);
    const fullPreview = this.buildPreviewContext({ draft: input.draft, entry: input.entry, cwd });
    return toPreviewResponse(fullPreview);
  }

  save(input: SaveRequestDto): SaveResponseDto {
    const cwd = resolveCwd(input.cwd);
    const validation = previewWriteConfig(input.draft);
    if (!validation.valid) {
      return { ok: false, errors: validation.errors ?? ['Validation failed'] };
    }
    const { checksum } = writeConfig(cwd, input.draft);
    return { ok: true, checksum };
  }

  addTag(input: AddTagRequestDto): MutationResponseDto {
    const cwd = resolveCwd(input.cwd);
    const { draft, entry, pathRel, tag } = input;
    const preview = this.buildPreviewContext({ draft, entry, cwd });
    const currentModules = this.mergeModules(preview.explicitModulesConfig, preview.inferredModulesByPathRel);

    const currentTags = currentModules[pathRel] ?? [];
    const filteredTags = currentTags.filter((t) => t !== 'noTag');
    const newTags = [...new Set([...filteredTags, tag])];

    const modulesConfig = preview.modulesConfig
      ? ConfigMigrator.updateModulesConfig(preview.modulesConfig, pathRel, newTags)
      : undefined;

    return this.regenerateFromMutation({
      cwd,
      entry,
      originalDraft: draft,
      options: preview.options,
      originalModulesConfig: preview.originalModulesConfig,
      modulesByPathRel: { ...currentModules, [pathRel]: newTags },
      inferredModulesByPathRel: preview.inferredModulesByPathRel,
      depRulesRaw: preview.depRulesRaw,
      modulesConfig,
    });
  }

  removeTag(input: RemoveTagRequestDto): MutationResponseDto {
    const cwd = resolveCwd(input.cwd);
    const { draft, entry, pathRel, tag } = input;
    const preview = this.buildPreviewContext({ draft, entry, cwd });
    const currentModules = this.mergeModules(preview.explicitModulesConfig, preview.inferredModulesByPathRel);

    const currentTags = currentModules[pathRel] ?? [];
    const newTags = currentTags.filter((t) => t !== tag);

    const modulesConfig = preview.modulesConfig
      ? ConfigMigrator.updateModulesConfig(preview.modulesConfig, pathRel, newTags)
      : undefined;

    return this.regenerateFromMutation({
      cwd,
      entry,
      originalDraft: draft,
      options: preview.options,
      originalModulesConfig: preview.originalModulesConfig,
      modulesByPathRel: { ...currentModules, [pathRel]: newTags },
      inferredModulesByPathRel: preview.inferredModulesByPathRel,
      depRulesRaw: preview.depRulesRaw,
      modulesConfig,
    });
  }

  deleteTagEverywhere(input: DeleteTagRequestDto): MutationResponseDto {
    const cwd = resolveCwd(input.cwd);
    const { draft, entry, tag } = input;
    const preview = this.buildPreviewContext({ draft, entry, cwd });
    const currentModules = this.mergeModules(preview.explicitModulesConfig, preview.inferredModulesByPathRel);

    const updatedModules: TagsByPathRel = {};
    for (const [p, tags] of Object.entries(currentModules)) {
      updatedModules[p] = tags.filter((t) => t !== tag);
    }

    let modulesConfig = preview.modulesConfig;
    if (modulesConfig) {
      modulesConfig = JSON.parse(JSON.stringify(modulesConfig)) as ModulesConfig;
      for (const basePath of Object.keys(modulesConfig)) {
        const entry = modulesConfig[basePath];
        if (Array.isArray(entry)) {
          modulesConfig[basePath] = entry.filter((t) => t !== tag);
        } else {
          for (const [relPath, tags] of Object.entries(entry)) {
            entry[relPath] = tags.filter((t) => t !== tag);
          }
        }
      }
    }

    return this.regenerateFromMutation({
      cwd,
      entry,
      originalDraft: draft,
      options: preview.options,
      originalModulesConfig: preview.originalModulesConfig,
      modulesByPathRel: updatedModules,
      inferredModulesByPathRel: preview.inferredModulesByPathRel,
      depRulesRaw: this.removeTagFromDepRules(preview.depRulesRaw, tag),
      modulesConfig,
    });
  }

  toggleDepRule(input: ToggleDepRuleRequestDto): MutationResponseDto {
    const cwd = resolveCwd(input.cwd);
    const { draft, entry, from, to } = input;
    const preview = this.buildPreviewContext({ draft, entry, cwd });

    return this.regenerateFromMutation({
      cwd,
      entry,
      originalDraft: draft,
      options: preview.options,
      originalModulesConfig: preview.originalModulesConfig,
      modulesByPathRel: this.mergeModules(preview.explicitModulesConfig, preview.inferredModulesByPathRel),
      inferredModulesByPathRel: preview.inferredModulesByPathRel,
      depRulesRaw: this.toggleDepRuleInRaw(preview.depRulesRaw, from, to),
      modulesConfig: preview.modulesConfig,
    });
  }

  /**
   * Builds a complete preview context by combining:
   * 1. Sheriff-core analysis (folder tree + dependency data)
   * 2. Evaluated config (depRules, options, modules)
   * 3. Merged module tags (explicit from config + inferred from analysis)
   *
   * Data flow:
   * - applyConfigPreview() → writes temp config, runs sheriff-core, restores original
   * - evaluateSheriffConfig() → extracts depRules, options, modules from draft
   * - Module merging: explicit config tags override inferred tags
   *
   * @param options.draft - Current config content to preview
   * @param options.entry - Entry file path for analysis
   * @param options.cwd - Working directory
   */
  private buildPreviewContext(options: { draft: string; entry: string; cwd: string }): PreviewContext {
    const { draft, entry, cwd } = options;

    // Step 1: Run sheriff-core analysis with temp config (writes, analyzes, restores)
    const previewRes = applyConfigPreview(draft, entry, cwd);

    // Step 2: Extract structured data from evaluated config
    let depRulesRaw: DepRulesByTag | undefined;
    let depRulesDisplay: DepRulesForDisplay = {};
    let configOptions: ManualConfigOptions | undefined;
    let originalModulesConfig: TagsByPathRel = {};   // Pattern-based modules (e.g., src/<domain>)
    let explicitModulesConfig: TagsByPathRel = {};   // Explicit path modules (e.g., src/app/feature)
    let modulesConfig: ModulesConfig | undefined;    // Raw nested modules structure (if present)

    try {
      const evaluated = evaluateSheriffConfig(draft);
      const parsedDepRules = parseDepRules(evaluated);
      if (parsedDepRules) {
        depRulesRaw = parsedDepRules.ast;
        depRulesDisplay = parsedDepRules.display;
      }

      // Extract config options (enableBarrelLess, autoTagging, etc.)
      const parsed = ManualConfigOptionsSchema.safeParse(evaluated);
      configOptions = parsed.success && Object.values(parsed.data).some((v) => v !== undefined)
        ? parsed.data
        : undefined;

      // Try to extract nested modules format (for preserving structure)
      modulesConfig = ConfigMigrator.extractModulesConfig(draft);

      // Extract modules: try v2 format first, then fall back to v1 tagging
      const modulesFromConfig = parseModulesNode(evaluated);
      if (modulesFromConfig) {
        originalModulesConfig = modulesFromConfig.patterns;
        explicitModulesConfig = modulesFromConfig.explicit;
      } else {
        const taggingFromConfig = parseTaggingNode(evaluated);
        if (taggingFromConfig) {
          const migrated = ConfigMigrator.taggingToModules(taggingFromConfig);
          originalModulesConfig = migrated.patterns;
          explicitModulesConfig = migrated.explicit;
        }
      }
    } catch {
      // Config evaluation failed - continue with empty config data
      depRulesRaw = undefined;
      configOptions = undefined;
    }

    // Step 3: Merge explicit config tags with inferred tags from analysis
    const inferredModulesByPathRel = materializeModulesByPathRel(previewRes.tree);
    const mergedModules = this.mergeModules(explicitModulesConfig, inferredModulesByPathRel);

    // Step 4: Apply merged modules and patterns to tree (updates tree nodes in-place)
    applyModulesToTree(previewRes.tree, mergedModules, originalModulesConfig);

    // Step 5: Re-extract modules after pattern resolution
    const allModulesByPathRel = materializeModulesByPathRel(previewRes.tree);

    return {
      ...previewRes,
      depRulesRaw,
      depRulesDisplay,
      options: configOptions,
      inferredModulesByPathRel: allModulesByPathRel,
      originalModulesConfig,
      explicitModulesConfig,
      modulesConfig,
    };
  }

  private mergeModules(explicit: TagsByPathRel, inferred: TagsByPathRel): TagsByPathRel {
    return { ...inferred, ...explicit };
  }

  private removeTagFromDepRules(raw: DepRulesByTag | undefined, tag: string): DepRulesByTag | undefined {
    if (!raw) return undefined;
    const updated: DepRulesByTag = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k === tag) continue;
      if (v.kind === 'static') updated[k] = { kind: 'static', tags: v.tags.filter((t) => t !== tag) };
      else if (v.kind === 'mixed') updated[k] = { kind: 'mixed', tags: v.tags.filter((t) => t !== tag), functions: v.functions };
      else updated[k] = v;
    }
    return updated;
  }

  private toggleDepRuleInRaw(raw: DepRulesByTag | undefined, from: string, to: string): DepRulesByTag {
    const result: DepRulesByTag = { ...(raw ?? {}) };
    const existing = result[from];
    const currentTags = existing && (existing.kind === 'static' || existing.kind === 'mixed') ? existing.tags : [];
    const tagSet = new Set(currentTags);
    if (tagSet.has(to)) tagSet.delete(to);
    else tagSet.add(to);
    const updatedTags = [...tagSet];

    if (existing?.kind === 'mixed') result[from] = { kind: 'mixed', tags: updatedTags, functions: existing.functions };
    else if (existing?.kind === 'function') result[from] = { kind: 'mixed', tags: updatedTags, functions: [existing.source] };
    else result[from] = { kind: 'static', tags: updatedTags };

    return result;
  }

  /**
   * Regenerates config after a mutation (addTag, removeTag, toggleDepRule, etc.)
   *
   * Two code paths based on config format:
   * 1. Nested modules format: preserves the original structure (src/app: { feature: ['tag'] })
   * 2. Flat modules format: uses optimized flat paths (src/app/feature: ['tag'])
   *
   * After generation, rebuilds preview to reflect the new config state.
   */
  private regenerateFromMutation(args: {
    cwd: string;
    entry: string;
    originalDraft: string;
    options: ManualConfigOptions | undefined;
    originalModulesConfig: TagsByPathRel;
    modulesByPathRel: TagsByPathRel;
    inferredModulesByPathRel: TagsByPathRel;
    depRulesRaw: DepRulesByTag | undefined;
    modulesConfig?: ModulesConfig;
  }): MutationResponseDto {
    const { cwd, entry, originalDraft, options, originalModulesConfig, modulesByPathRel, inferredModulesByPathRel, depRulesRaw, modulesConfig } = args;

    let newDraft: string;

    if (modulesConfig) {
      // Path 1: Nested modules format - preserve original structure
      newDraft = ConfigMigrator.generateWithModulesConfig({
        options,
        modulesConfig,
        depRulesRaw,
        originalConfig: originalDraft,
      });
    } else {
      // Path 2: Flat modules format - optimize by removing redundant entries
      const optimizedModules = optimizeModuleTags(modulesByPathRel, inferredModulesByPathRel);
      const depRules = ManualService.deriveStaticDepRules(depRulesRaw);

      newDraft = generateManualSheriffConfig({
        options,
        originalModulesConfig,
        modulesByPathRel: optimizedModules,
        depRules,
        depRulesRaw: depRulesRaw ?? null,
        originalConfig: originalDraft,
      });
    }

    // Rebuild preview with newly generated config
    const fullPreview = this.buildPreviewContext({ draft: newDraft, entry, cwd });
    return { draft: newDraft, preview: toPreviewResponse(fullPreview) };
  }
}

