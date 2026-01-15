import {
  evaluateSheriffConfig,
  parseDepRules,
  parseTaggingNode,
  type TaggingNode,
  type DepRulesByTag,
} from '../../core/config-evaluator';
import { ManualConfigOptionsSchema, type ManualConfigOptions } from '../models/manual-config.models';
import type { TagsByPathRel } from '../models/manual-config.models';
import type { ModulesConfig } from '../models/manual-preview.models';
import { quote, normalizeFunction, isSheriffHelper, toTsCode, buildImports, buildOptions } from './config-generator';

/**
 * Generates TypeScript code lines for modules config.
 * Handles both flat and nested entries in the same output:
 * - Flat (array): `'src/app/feature': ['tag1', 'tag2'],`
 * - Nested (object): `'src/app': { 'feature': ['tag'], },`
 */
function buildModulesConfigLines(nested: ModulesConfig): string[] {
  const lines: string[] = [];
  for (const basePath of Object.keys(nested).sort()) {
    const entries = nested[basePath];

    if (Array.isArray(entries)) {
      // Flat entry: full path → tags array
      lines.push(`    ${quote(basePath)}: ${toTsCode(entries)},`);
    } else {
      // Nested entry: base path → { relative paths → tags }
      const sortedEntries = Object.entries(entries).sort(([a], [b]) => a.localeCompare(b));
      if (sortedEntries.length === 0) continue;

      lines.push(`    ${quote(basePath)}: {`);
      for (const [path, tags] of sortedEntries) {
        lines.push(`      ${quote(path)}: ${toTsCode(tags)},`);
      }
      lines.push('    },');
    }
  }
  return lines;
}

function buildDepRulesLines(raw: DepRulesByTag | undefined): { lines: string[]; helpers: Set<string> } {
  const helpers = new Set<string>();
  if (!raw || Object.keys(raw).length === 0) {
    return { lines: ["    'root': 'noTag',", "    'noTag': 'noTag',"], helpers };
  }

  const lines: string[] = [];
  for (const from of Object.keys(raw).sort()) {
    const rule = raw[from];
    let code: string;

    if (rule.kind === 'function') {
      code = normalizeFunction(rule.source);
      if (isSheriffHelper(code)) helpers.add(code);
    } else if (rule.kind === 'mixed') {
      const parts = rule.functions.map((f) => {
        const fn = normalizeFunction(f);
        if (isSheriffHelper(fn)) helpers.add(fn);
        return fn;
      });
      parts.push(...rule.tags.map(quote));
      code = `[${parts.join(', ')}]`;
    } else if (rule.kind === 'static') {
      if (rule.tags.length === 0) {
        code = 'noDependencies';
        helpers.add('noDependencies');
      } else if (rule.tags.length === 1) {
        code = quote(rule.tags[0]);
      } else {
        code = toTsCode(rule.tags);
      }
    } else {
      code = "'noTag'";
    }

    lines.push(`    ${quote(from)}: ${code},`);
  }

  return { lines, helpers };
}

/**
 * Handles Sheriff config format operations:
 * - v1 (tagging) → v2 (modules) migration
 * - Nested modules format detection and generation
 *
 * Config Format History:
 * - v1: Uses `tagging: { 'src/app': { 'feature': ['tag'] } }` (deprecated)
 * - v2 flat: Uses `modules: { 'src/app/feature': ['tag'] }`
 * - v2 nested: Uses `modules: { 'src/app': { 'feature': ['tag'] } }` (preserves hierarchy)
 *
 * The UI can work with both v2 formats. When editing, we preserve the original format.
 */
export class ConfigMigrator {
  /**
   * Migrates a v1 config to v2 modules format.
   * Returns the original content if it's already v2 or migration fails.
   */
  static migrateToV2(content: string): string {
    if (!content.trim()) return content;

    try {
      const evaluated = evaluateSheriffConfig(content);
      if (!ConfigMigrator.isV1Format(evaluated)) {
        return content;
      }

      const tagging = parseTaggingNode(evaluated);
      if (!tagging) return content;

      const nestedModules = ConfigMigrator.taggingToModulesConfig(tagging);
      const parsedDepRules = parseDepRules(evaluated);
      const depRulesRaw = parsedDepRules?.ast;
      const parsed = ManualConfigOptionsSchema.safeParse(evaluated);
      const options = parsed.success ? parsed.data : undefined;

      const depRulesResult = buildDepRulesLines(depRulesRaw);
      const imports = buildImports(depRulesResult.helpers, content);

      return [
        imports,
        '',
        'export const sheriffConfig: SheriffConfig = {',
        ...buildOptions(options),
        '  modules: {',
        ...buildModulesConfigLines(nestedModules),
        '  },',
        '  depRules: {',
        ...depRulesResult.lines,
        '  },',
        '};',
        '',
      ].join('\n');
    } catch {
      return content;
    }
  }

  /** Converts v1 tagging to nested modules format */
  static taggingToModulesConfig(tagging: TaggingNode): ModulesConfig {
    const result: ModulesConfig = {};
    for (const basePath of tagging.basePaths) {
      result[basePath] = tagging.byBasePath[basePath] ?? {};
    }
    return result;
  }

  /** Converts v1 tagging to flat modules format (for service merging) */
  static taggingToModules(tagging: TaggingNode): { patterns: TagsByPathRel; explicit: TagsByPathRel } {
    const patterns: TagsByPathRel = {};
    const explicit: TagsByPathRel = {};

    for (const basePath of tagging.basePaths) {
      const pathsUnderBase = tagging.byBasePath[basePath] ?? {};
      for (const [relativePath, tags] of Object.entries(pathsUnderBase)) {
        const fullPath = `${basePath}/${relativePath}`;
        if (relativePath.includes('<') && relativePath.includes('>')) {
          patterns[fullPath] = tags;
        } else {
          explicit[fullPath] = tags;
        }
      }
    }

    return { patterns, explicit };
  }

  /** Detects if config uses v1 format (has tagging but no modules) */
  static isV1Format(evaluated: unknown): boolean {
    if (typeof evaluated !== 'object' || evaluated === null) return false;
    const config = evaluated as Record<string, unknown>;
    return 'tagging' in config && !('modules' in config);
  }

  /** Detects if config uses v2 format (has modules) */
  static isV2Format(evaluated: unknown): boolean {
    if (typeof evaluated !== 'object' || evaluated === null) return false;
    return 'modules' in (evaluated as Record<string, unknown>);
  }

  /**
   * Detects if modules config contains any nested entries.
   * A config can mix flat and nested entries:
   * - Flat: `'src/app/feature': ['tag']`
   * - Nested: `'src/app': { 'feature': ['tag'] }`
   * Returns true if at least one nested entry exists (triggers structure-preserving code path).
   */
  static isModulesConfigFormat(modules: unknown): modules is ModulesConfig {
    if (typeof modules !== 'object' || modules === null) return false;
    const entries = Object.values(modules as Record<string, unknown>);
    return entries.some((v) => typeof v === 'object' && v !== null && !Array.isArray(v));
  }

  /**
   * Extract modules from evaluated config.
   * Supports mixed flat and nested entries in the same config.
   */
  static extractModulesConfig(content: string): ModulesConfig | undefined {
    try {
      const evaluated = evaluateSheriffConfig(content);
      if (!ConfigMigrator.isV2Format(evaluated)) return undefined;

      const modules = (evaluated as Record<string, unknown>).modules;
      if (!ConfigMigrator.isModulesConfigFormat(modules)) return undefined;

      const result: ModulesConfig = {};
      for (const [basePath, entries] of Object.entries(modules)) {
        if (Array.isArray(entries)) {
          result[basePath] = entries.filter((t): t is string => typeof t === 'string');
        } else if (typeof entries === 'object' && entries !== null) {
          result[basePath] = { ...(entries as Record<string, string[]>) };
        }
      }
      return Object.keys(result).length > 0 ? result : undefined;
    } catch {
      return undefined;
    }
  }

  /** Generate config with modules format */
  static generateWithModulesConfig(input: {
    options?: ManualConfigOptions;
    modulesConfig: ModulesConfig;
    depRulesRaw?: DepRulesByTag;
    originalConfig: string;
  }): string {
    const { options, modulesConfig, depRulesRaw, originalConfig } = input;

    const depRulesResult = buildDepRulesLines(depRulesRaw);
    const imports = buildImports(depRulesResult.helpers, originalConfig);

    return [
      imports,
      '',
      'export const sheriffConfig: SheriffConfig = {',
      ...buildOptions(options),
      '  modules: {',
      ...buildModulesConfigLines(modulesConfig),
      '  },',
      '  depRules: {',
      ...depRulesResult.lines,
      '  },',
      '};',
      '',
    ].join('\n');
  }

  static updateModulesConfig(
    nested: ModulesConfig,
    fullPath: string,
    newTags: string[]
  ): ModulesConfig {
    const result = JSON.parse(JSON.stringify(nested)) as ModulesConfig;

    if (fullPath in result && Array.isArray(result[fullPath])) {
      if (newTags.length > 0) {
        result[fullPath] = newTags;
      } else {
        delete result[fullPath];
      }
      return result;
    }

    for (const basePath of Object.keys(result)) {
      const entry = result[basePath];
      if (Array.isArray(entry)) continue;

      if (fullPath.startsWith(basePath + '/')) {
        const relativePath = fullPath.slice(basePath.length + 1);
        if (newTags.length > 0) {
          entry[relativePath] = newTags;
        } else {
          delete entry[relativePath];
        }
        return result;
      }
    }

    if (newTags.length === 0) return result;

    result[fullPath] = newTags;
    return result;
  }
}
