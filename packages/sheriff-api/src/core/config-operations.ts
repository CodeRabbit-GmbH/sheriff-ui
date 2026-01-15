import * as fs from 'fs';
import * as path from 'path';
import * as sheriffCore from '@softarc/sheriff-core';
import { computeChecksum } from './crypto-utils';
import { resolveCwd } from './path-utils';
import { analyzeAndMerge } from './analysis-operations';
import { buildFolderTree } from './tree-operations';
import { evaluateSheriffConfig } from './config-evaluator';
import type { DirNode } from './types';

function validateSemantic(content: string): string[] {
  const errors: string[] = [];
  const hasModules = content.includes('modules:');
  const hasTagging = content.includes('tagging:');
  const autoTaggingFalse = /autoTagging:\s*false/.test(content);

  if (autoTaggingFalse && !hasModules && !hasTagging) {
    errors.push('If autoTagging is false, modules or tagging property is required');
  }
  if (hasTagging && hasModules) {
    errors.push('Cannot use both tagging and modules properties (tagging is deprecated, use modules)');
  }

  const hasEntryFile = content.includes('entryFile:');
  const hasEntryPoints = content.includes('entryPoints:');
  if (hasEntryFile && hasEntryPoints) {
    errors.push('Cannot use both entryFile and entryPoints properties (use only one)');
  }

  return errors;
}

function validateConfigObject(config: unknown): string[] {
  if (typeof config !== 'object' || config === null) return ['Config must export an object'];
  const configObj = config as sheriffCore.SheriffConfig;

  if (!configObj.depRules || typeof configObj.depRules !== 'object') {
    return ['Config must have a depRules property that is an object'];
  }

  return [];
}

function validateRuntime(content: string): string[] {
  if (!content.trim()) return ['Config content cannot be empty'];

  try {
    const config = evaluateSheriffConfig(content);
    return validateConfigObject(config);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return [`Config evaluation error: ${msg}`];
  }
}

export function readConfig(cwd: string): { content: string; checksum: string } {
  const configPath = path.join(cwd, 'sheriff.config.ts');
  if (!fs.existsSync(configPath)) {
    throw new Error('sheriff.config.ts not found');
  }
  const content = fs.readFileSync(configPath, { encoding: 'utf-8' });
  const checksum = computeChecksum(content);
  return { content, checksum };
}

export function writeConfig(cwd: string, content: string): { checksum: string; path: string } {
  const configPath = path.join(cwd, 'sheriff.config.ts');
  fs.writeFileSync(configPath, content, { encoding: 'utf-8' });
  const checksum = computeChecksum(content);
  return { checksum, path: configPath };
}

export function previewWriteConfig(content: string): { valid: boolean; errors?: string[]; checksum: string } {
  const errors = [...validateSemantic(content), ...validateRuntime(content)];
  const checksum = computeChecksum(content);
  return { valid: errors.length === 0, errors: errors.length ? errors : undefined, checksum };
}

export type ConfigApplyPreviewResult = {
  cwd: string;
  tree: DirNode;
  analysis: unknown;
  fileIdByPathRel: Record<string, string>;
  configValid: boolean;
  errors?: string[];
};

/**
 * Applies a draft config temporarily and runs sheriff-core analysis.
 *
 * Mechanism:
 * 1. Validates config syntax and semantics
 * 2. Backs up existing sheriff.config.ts (if present)
 * 3. Writes draft config to disk temporarily
 * 4. Runs sheriff-core analysis (which reads config from disk)
 * 5. Restores original config (or removes temp file if none existed)
 *
 * This "write-analyze-restore" pattern is required because sheriff-core
 * reads config from the filesystem, not from memory.
 *
 * @param content - Draft config content to preview
 * @param entry - Entry file path for analysis
 * @param cwdParam - Optional working directory override
 */
export function applyConfigPreview(content: string, entry: string, cwdParam?: string): ConfigApplyPreviewResult {
  const targetCwd = resolveCwd(cwdParam);

  // Step 1: Validate before writing
  const validation = previewWriteConfig(content);
  if (!validation.valid) {
    const tree = buildFolderTree(targetCwd, targetCwd, true);
    return {
      cwd: targetCwd,
      tree,
      analysis: {},
      fileIdByPathRel: {},
      configValid: false,
      errors: validation.errors,
    };
  }

  // Step 2: Backup existing config if present
  const configPath = path.join(targetCwd, 'sheriff.config.ts');
  const backupPath = `${configPath}.backup.${Date.now()}`;
  let originalConfig: string | null = null;
  let configExists = false;

  if (fs.existsSync(configPath)) {
    originalConfig = fs.readFileSync(configPath, { encoding: 'utf-8' });
    configExists = true;
    fs.writeFileSync(backupPath, originalConfig, { encoding: 'utf-8' });
  }

  try {
    // Step 3: Write temp config and analyze
    fs.writeFileSync(configPath, content, { encoding: 'utf-8' });
    const { tree, analysis, fileIdByPathRel } = analyzeAndMerge(entry, targetCwd);
    return {
      cwd: targetCwd,
      tree,
      analysis,
      fileIdByPathRel,
      configValid: true,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const tree = buildFolderTree(targetCwd, targetCwd, true);
    return {
      cwd: targetCwd,
      tree,
      analysis: {},
      fileIdByPathRel: {},
      configValid: false,
      errors: [`Analysis error: ${msg}`],
    };
  } finally {
    // Step 4: Always restore original config state
    try {
      if (configExists && originalConfig !== null) {
        fs.writeFileSync(configPath, originalConfig, { encoding: 'utf-8' });
      } else if (!configExists && fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    } catch {
      // Ignore restore errors
    }
  }
}
