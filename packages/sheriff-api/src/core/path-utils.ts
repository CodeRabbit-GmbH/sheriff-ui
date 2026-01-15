import * as path from 'path';

/**
 * Resolve the working directory for analysis/config operations.
 * If `cwdParam` is omitted, falls back to `process.env.SHERIFF_ROOT` and finally `process.cwd()`.
 */
export function resolveCwd(cwdParam?: unknown): string {
  const trimmed = typeof cwdParam === 'string' ? cwdParam.trim() : '';
  if (trimmed) {
    return path.isAbsolute(trimmed) ? trimmed : path.join(process.cwd(), trimmed);
  }

  const envRoot = process.env.SHERIFF_ROOT;
  if (envRoot && path.isAbsolute(envRoot)) return envRoot;

  return process.cwd();
}

