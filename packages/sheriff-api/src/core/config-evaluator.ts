/**
 * Sheriff Config AST (Intermediate Representation)
 *
 * This module provides types and parsers that convert evaluated sheriff.config.ts
 * content into an AST representation. The AST is necessary because:
 *
 * 1. **Function preservation**: Sheriff configs can contain function references
 *    like `sameTag`, `anyTag`, `noDependencies`. When the UI mutates the config
 *    and regenerates it, we need to preserve these functions rather than
 *    expanding them to their evaluated results.
 *
 * 2. **RegExp preservation**: Similarly, RegExp literals need to be preserved
 *    rather than serialized as strings.
 *
 * The AST is used server-side only. The frontend receives simplified types
 * (e.g., `DepRulesForDisplay` which is just `Record<string, string[]>`).
 */
import vm from 'vm';
import * as sheriffCore from '@softarc/sheriff-core';

// ============================================================================
// AST Node Types - Intermediate Representation for Sheriff Config
// ============================================================================

/** Represents a RegExp literal in the config AST */
export type RegExpLiteral = { kind: 'regex'; pattern: string; flags: string };

/** Dependency rule with static tag list */
export type StaticDepRule = { kind: 'static'; tags: string[] };

/** Dependency rule using a function (e.g., sameTag, anyTag) */
export type FunctionDepRule = { kind: 'function'; source: string };

/** Dependency rule with both static tags and functions */
export type MixedDepRule = { kind: 'mixed'; tags: string[]; functions: string[] };

/** Dependency rule that couldn't be parsed */
export type UnknownDepRule = { kind: 'unknown'; type: string };

/** Union of all dependency rule node types */
export type DepRuleNode = StaticDepRule | FunctionDepRule | MixedDepRule | UnknownDepRule;

/** Map of dependency rules keyed by source tag */
export type DepRulesByTag = Record<string, DepRuleNode>;

/** Simplified dep rules for frontend display (from tag -> accessible tags) */
export type DepRulesForDisplay = Record<string, string[]>;

/**
 * Combined result from parseDepRules containing both:
 * - ast: Full AST representation for config regeneration (preserves functions)
 * - display: Simplified format for frontend display
 */
export type ParsedDepRules = {
  ast: DepRulesByTag;
  display: DepRulesForDisplay;
};

/**
 * Parsed modules configuration.
 * Separates patterns (with `<placeholder>`) from explicit paths.
 */
export type ModulesNode = {
  patterns: Record<string, string[]>;
  explicit: Record<string, string[]>;
};

/**
 * Represents the parsed v1 tagging format.
 * The v1 format uses nested structure: tagging: { basePath: { relativePath: tags[] } }
 */
export type TaggingNode = {
  basePaths: string[];
  byBasePath: Record<string, Record<string, string[]>>;
};

// ============================================================================
// Internal Helpers
// ============================================================================

const knownFunctionSignatures = new Map<string, string>([
  [sheriffCore.sameTag.toString(), 'sameTag'],
  [sheriffCore.anyTag.toString(), 'anyTag'],
  [sheriffCore.noDependencies.toString(), 'noDependencies'],
]);

function getFunctionName(fn: unknown): string {
  if (typeof fn === 'function') {
    const sig = fn.toString();
    const known = knownFunctionSignatures.get(sig);
    return known ?? sig;
  }
  return String(fn);
}

/**
 * Recursively converts VM values to AST nodes for JSON transport.
 * - RegExp → RegExpLiteral
 * - Function → FunctionDepRule-like structure
 * - Arrays/Objects → recursively converted
 * - Primitives → passed through
 */
function vmValueToAst(val: unknown): unknown {
  if (typeof val === 'object' && val !== null && Object.prototype.toString.call(val) === '[object RegExp]') {
    return { kind: 'regex', pattern: (val as RegExp).source, flags: (val as RegExp).flags } satisfies RegExpLiteral;
  }
  if (typeof val === 'function') return { kind: 'function', source: getFunctionName(val) };
  if (Array.isArray(val)) return val.map(vmValueToAst);
  if (typeof val === 'object' && val !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = vmValueToAst(v);
    }
    return out;
  }
  return val;
}

// ============================================================================
// Config Evaluation
// ============================================================================

/**
 * Evaluates a sheriff.config.ts file content by transpiling TypeScript to JavaScript
 * and executing it in a sandboxed VM context.
 *
 * Security model:
 * - Only @softarc/sheriff-core can be imported (sandboxRequire restriction)
 * - Code runs in isolated VM context with limited globals
 * - Functions/RegExps in config are converted to AST nodes for UI display
 *
 * @param content - Raw TypeScript config file content
 * @returns Config object with functions/RegExps converted to AST nodes
 * @throws Error if content is empty or evaluation fails
 */
export function evaluateSheriffConfig(content: string): unknown {
  if (!content.trim()) throw new Error('Config content cannot be empty');

  // Step 1: Transpile TypeScript to CommonJS JavaScript
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ts = require('typescript');
  const { outputText } = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });

  // Step 2: Create sandboxed module scope to capture exports
  const moduleScope: { exports: Record<string, unknown> } = { exports: {} };

  // Step 3: Create restricted require function - only sheriff-core allowed
  const sandboxRequire = (id: string): unknown => {
    if (id === '@softarc/sheriff-core') return sheriffCore;
    throw new Error(`Cannot require '${id}' in sheriff.config.ts - only @softarc/sheriff-core is allowed`);
  };

  // Step 4: Create VM sandbox with minimal globals
  const sandbox = vm.createContext({
    module: moduleScope,
    exports: moduleScope.exports,
    require: sandboxRequire,
    console,
    process,
    Buffer,
  });

  // Step 5: Execute transpiled code in sandbox
  vm.runInContext(outputText, sandbox, { filename: 'sheriff.config.ts' });

  // Step 6: Extract config from common export patterns
  const exported = moduleScope.exports ?? {};
  const config =
    (exported as Record<string, unknown>).config ??
    (exported as Record<string, unknown>).sheriffConfig ??
    (exported as Record<string, unknown>).default ??
    exported;

  // Step 7: Convert VM values (functions, RegExp) to AST nodes
  return vmValueToAst(config);
}

// ============================================================================
// Type Guards
// ============================================================================

/** Type guard for FunctionDepRule */
function isFunctionDepRule(val: unknown): val is FunctionDepRule {
  return (
    typeof val === 'object' &&
    val !== null &&
    (val as { kind?: string }).kind === 'function' &&
    typeof (val as { source?: string }).source === 'string'
  );
}

// ============================================================================
// Config Parsers - Convert evaluated config to typed AST nodes
// ============================================================================

const toStringArray = (arr: unknown[]): string[] => arr.filter((t): t is string => typeof t === 'string');

/**
 * Parses v2 modules config into a ModulesNode.
 * Handles mixed flat and nested entries in the same config:
 * - Flat: `'src/app/feature': ['tag']` → stored as-is
 * - Nested: `'src/app': { 'feature': ['tag'] }` → flattened to `'src/app/feature': ['tag']`
 *
 * Separates results into patterns (contain `<placeholder>`) and explicit paths.
 */
export function parseModulesNode(config: unknown): ModulesNode | undefined {
  if (typeof config !== 'object' || config === null || !('modules' in config)) return undefined;

  const modules = (config as { modules?: unknown }).modules;
  if (typeof modules !== 'object' || modules === null || Array.isArray(modules)) return undefined;

  const patterns: Record<string, string[]> = {};
  const explicit: Record<string, string[]> = {};

  const addEntry = (path: string, tags: string[]): void => {
    (path.includes('<') && path.includes('>') ? patterns : explicit)[path] = tags;
  };

  for (const [key, value] of Object.entries(modules as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      // Flat entry: key is full path, value is tags array
      addEntry(key, toStringArray(value));
    } else if (typeof value === 'object' && value !== null) {
      // Nested entry: key is base path, value is { relativePath: tags }
      for (const [relativePath, tags] of Object.entries(value as Record<string, unknown>)) {
        if (Array.isArray(tags)) {
          addEntry(`${key}/${relativePath}`, toStringArray(tags));
        }
      }
    }
  }

  return { patterns, explicit };
}

/**
 * Parses the v1 tagging format from a config into a TaggingNode.
 * The v1 format uses: tagging: { 'src/app': { 'path': ['tag1', 'tag2'] } }
 */
export function parseTaggingNode(config: unknown): TaggingNode | undefined {
  if (typeof config !== 'object' || config === null) return undefined;
  if (!('tagging' in config)) return undefined;

  const tagging = (config as { tagging?: unknown }).tagging;
  if (typeof tagging !== 'object' || tagging === null || Array.isArray(tagging)) return undefined;

  const basePaths: string[] = [];
  const byBasePath: Record<string, Record<string, string[]>> = {};

  for (const [basePath, nested] of Object.entries(tagging as Record<string, unknown>)) {
    if (typeof nested !== 'object' || nested === null || Array.isArray(nested)) continue;

    basePaths.push(basePath);
    const pathsUnderBase: Record<string, string[]> = {};

    for (const [relativePath, tags] of Object.entries(nested as Record<string, unknown>)) {
      if (!Array.isArray(tags)) continue;
      const tagList = tags.filter((t): t is string => typeof t === 'string');
      pathsUnderBase[relativePath] = tagList;
    }

    byBasePath[basePath] = pathsUnderBase;
  }

  return basePaths.length > 0 ? { basePaths, byBasePath } : undefined;
}

/**
 * Extracts entry points from config.
 * Supports both single entryFile and multi-app entryPoints.
 */
export function parseEntryPoints(config: unknown): Record<string, string> | undefined {
  if (typeof config !== 'object' || config === null) return undefined;
  const c = config as Record<string, unknown>;

  if ('entryPoints' in c && typeof c.entryPoints === 'object' && c.entryPoints !== null) {
    const entries = c.entryPoints as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const [name, path] of Object.entries(entries)) {
      if (typeof path === 'string') result[name] = path;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  if ('entryFile' in c && typeof c.entryFile === 'string' && c.entryFile.trim()) {
    return { [c.entryFile]: c.entryFile };
  }

  return undefined;
}

/** Extracts display tags from a DepRuleNode */
function getDisplayTags(rule: DepRuleNode): string[] {
  if (rule.kind === 'static' || rule.kind === 'mixed') return rule.tags;
  return [];
}

/**
 * Parses dependency rules from config into both AST and display formats.
 * Returns both in a single pass for efficiency.
 */
export function parseDepRules(config: unknown): ParsedDepRules | undefined {
  if (typeof config !== 'object' || config === null) return undefined;
  if (!('depRules' in config)) return undefined;

  const depRules = (config as { depRules?: unknown }).depRules;
  if (typeof depRules !== 'object' || depRules === null || Array.isArray(depRules)) return undefined;

  const ast: DepRulesByTag = {};
  const display: DepRulesForDisplay = {};

  for (const [fromTag, raw] of Object.entries(depRules as Record<string, unknown>)) {
    let node: DepRuleNode;

    if (typeof raw === 'string') {
      node = { kind: 'static', tags: [raw] };
    } else if (typeof raw === 'function') {
      node = { kind: 'function', source: getFunctionName(raw) };
    } else if (isFunctionDepRule(raw)) {
      node = { kind: 'function', source: raw.source };
    } else if (Array.isArray(raw)) {
      const tags: string[] = [];
      const functions: string[] = [];
      for (const v of raw) {
        if (typeof v === 'string') tags.push(v);
        else if (typeof v === 'function') functions.push(getFunctionName(v));
        else if (isFunctionDepRule(v)) functions.push(v.source);
      }
      if (functions.length > 0) {
        node = { kind: 'mixed', tags, functions };
      } else {
        node = { kind: 'static', tags };
      }
    } else {
      node = { kind: 'unknown', type: typeof raw };
    }

    ast[fromTag] = node;
    display[fromTag] = getDisplayTags(node);
  }

  return { ast, display };
}
