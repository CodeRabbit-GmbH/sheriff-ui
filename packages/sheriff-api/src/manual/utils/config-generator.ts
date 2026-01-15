import type { ManualConfigOptions, TagsByPathRel } from '../models/manual-config.models';
import type { DepRuleNode, DepRulesByTag, RegExpLiteral } from '../../core/config-evaluator';

const PLACEHOLDER_TAGS = new Set(['noTag', 'root']);

export function quote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function toTsCode(value: unknown, indent = 0): string {
  if (value === undefined || value === null) return String(value);
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'object' && value !== null && (value as RegExpLiteral).kind === 'regex') {
    return `/${(value as RegExpLiteral).pattern}/${(value as RegExpLiteral).flags}`;
  }
  if (typeof value === 'object' && value !== null && (value as { kind?: string }).kind === 'function') {
    return normalizeFunction((value as { source: string }).source);
  }
  if (Array.isArray(value)) return `[${value.map((v) => toTsCode(v)).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    const pad = '  '.repeat(indent + 2);
    const closePad = '  '.repeat(indent + 1);
    const lines = entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${pad}${quote(k)}: ${toTsCode(v, indent + 1)},`);
    return `{\n${lines.join('\n')}\n${closePad}}`;
  }
  return String(value);
}

export function normalizeTags(tags: readonly string[], removePlaceholders = false): string[] {
  const cleaned = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  if (removePlaceholders) {
    const real = cleaned.filter((t) => !PLACEHOLDER_TAGS.has(t));
    return (real.length ? real : cleaned).sort((a, b) => a.localeCompare(b));
  }
  return cleaned.sort((a, b) => a.localeCompare(b));
}

export function optimizeModuleTags(desired: TagsByPathRel, inferred: TagsByPathRel): TagsByPathRel {
  const result: TagsByPathRel = {};
  for (const [p, desiredTags] of Object.entries(desired)) {
    const inferredTags = inferred[p] ?? [];
    const normDesired = normalizeTags(desiredTags, true);
    const normInferred = normalizeTags(inferredTags, true);
    const tagsMatch = normDesired.length === normInferred.length && normDesired.every((tag, i) => tag === normInferred[i]);
    if (!tagsMatch) {
      result[p] = normDesired;
    }
  }
  return result;
}

export const SHERIFF_HELPERS = ['sameTag', 'anyTag', 'noDependencies'] as const;
export type SheriffHelper = (typeof SHERIFF_HELPERS)[number];

export function normalizeFunction(source: string): string {
  if (source === 'sameTag' || source.includes('from === to') || source.includes('from==to')) return 'sameTag';
  if (source === 'noDependencies' || source.includes('=> false') || source === '() => false') return 'noDependencies';
  if (source === 'noTag') return 'noTag';
  return source;
}

export function isSheriffHelper(name: string): name is SheriffHelper {
  return (SHERIFF_HELPERS as readonly string[]).includes(name);
}

interface FormattedDepRule {
  code: string;
  usedHelpers: Set<SheriffHelper>;
}

function formatDepRule(tags: string[], raw?: DepRuleNode): FormattedDepRule {
  const normalized = normalizeTags(tags);
  const usedHelpers = new Set<SheriffHelper>();

  if (raw?.kind === 'function') {
    const fn = normalizeFunction(raw.source);
    if (isSheriffHelper(fn)) usedHelpers.add(fn);
    return { code: fn, usedHelpers };
  }

  if (raw?.kind === 'mixed' && raw.functions.length > 0) {
    const parts: string[] = [];
    for (const f of raw.functions) {
      const fn = normalizeFunction(f);
      if (isSheriffHelper(fn)) usedHelpers.add(fn);
      parts.push(fn);
    }
    parts.push(...normalized.map(quote));
    return { code: `[${parts.join(', ')}]`, usedHelpers };
  }

  if (normalized.length === 0) {
    usedHelpers.add('noDependencies');
    return { code: 'noDependencies', usedHelpers };
  }

  return { code: toTsCode(normalized), usedHelpers };
}

function buildDepRules(rules: Record<string, string[]>, raw: DepRulesByTag = {}): { lines: string[]; usedHelpers: Set<SheriffHelper> } {
  const usedHelpers = new Set<SheriffHelper>();
  const allKeys = new Set([...Object.keys(rules), ...Object.keys(raw)]);
  const sortedKeys = Array.from(allKeys).filter((k) => k.trim()).sort((a, b) => a.localeCompare(b));

  if (sortedKeys.length === 0) {
    return { lines: ["    'root': 'noTag',", "    'noTag': 'noTag',"], usedHelpers };
  }

  const lines = sortedKeys.map((from) => {
    const tos = rules[from] ?? [];
    const formatted = formatDepRule(tos, raw[from]);
    formatted.usedHelpers.forEach((h) => usedHelpers.add(h));
    return `    ${quote(from)}: ${formatted.code},`;
  });

  return { lines, usedHelpers };
}

export function buildImports(usedHelpers: Iterable<string>, originalConfig?: string): string {
  const helpers = new Set<string>(usedHelpers);
  if (originalConfig) {
    const importMatch = originalConfig.match(/import\s*\{([^}]+)\}\s*from\s*['"]@softarc\/sheriff-core['"]/);
    if (importMatch) {
      const imported = importMatch[1].split(',').map((s) => s.trim());
      for (const name of imported) {
        if (isSheriffHelper(name)) helpers.add(name);
      }
    }
  }
  const importList = ['SheriffConfig', ...Array.from(helpers).sort()];
  return `import { ${importList.join(', ')} } from '@softarc/sheriff-core';`;
}

export function buildOptions(opts?: ManualConfigOptions): string[] {
  if (!opts) return [];
  const lines: string[] = [];
  const simpleKeys = ['autoTagging', 'barrelFileName', 'enableBarrelLess', 'entryFile', 'excludeRoot', 'log'] as const;
  for (const key of simpleKeys) {
    const value = opts[key];
    if (value !== undefined) lines.push(`  ${key}: ${toTsCode(value)},`);
  }
  if (opts.encapsulationPattern !== undefined) lines.push(`  encapsulationPattern: ${toTsCode(opts.encapsulationPattern)},`);
  if (opts.entryPoints !== undefined) lines.push(`  entryPoints: ${toTsCode(opts.entryPoints)},`);
  if (opts.ignoreFileExtensions !== undefined) lines.push(`  ignoreFileExtensions: ${toTsCode(opts.ignoreFileExtensions)},`);
  return lines.sort();
}

function buildModules(original: TagsByPathRel = {}, concrete: TagsByPathRel): Record<string, string[]> {
  const merged = { ...original, ...concrete };
  const result: Record<string, string[]> = {};
  for (const [p, tags] of Object.entries(merged)) {
    if (p.trim() && tags.length > 0) result[p] = normalizeTags(tags);
  }
  return result;
}

export interface GenerateConfigInput {
  options?: ManualConfigOptions;
  originalModulesConfig?: TagsByPathRel;
  modulesByPathRel: TagsByPathRel;
  depRules: Record<string, string[]>;
  depRulesRaw?: DepRulesByTag | null;
  originalConfig?: string;
}

/**
 * Generates a v2 modules format Sheriff config (flat structure).
 */
export function generateManualSheriffConfig(input: GenerateConfigInput): string {
  const { options, originalModulesConfig, modulesByPathRel, depRules, depRulesRaw, originalConfig } = input;

  const depRulesResult = buildDepRules(depRules, depRulesRaw ?? undefined);
  const imports = buildImports(depRulesResult.usedHelpers, originalConfig);

  const modules = buildModules(originalModulesConfig, modulesByPathRel);
  const modulesLines =
    Object.keys(modules).length > 0
      ? Object.entries(modules)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([p, tags]) => `    ${quote(p)}: ${toTsCode(tags)},`)
      : ['    // add module tags via the UI'];

  return [
    imports,
    '',
    'export const sheriffConfig: SheriffConfig = {',
    ...buildOptions(options),
    '  modules: {',
    ...modulesLines,
    '  },',
    '  depRules: {',
    ...depRulesResult.lines,
    '  },',
    '};',
    '',
  ].join('\n');
}
