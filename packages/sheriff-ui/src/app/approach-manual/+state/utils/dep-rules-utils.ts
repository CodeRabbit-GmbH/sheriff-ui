import type { DepRulesForDisplay } from '../../../api/models';
import type { FolderNode } from '../../../module-renderer/+state/models/folder-node';

/**
 * Collects all unique tags from a folder tree and dependency rules.
 * Uses simplified DepRulesForDisplay (from tag → [accessible tags]).
 */
export function collectTags(root: FolderNode | null, depRules: DepRulesForDisplay | null): string[] {
  const tags = new Set<string>();

  // Collect tags from tree
  const walk = (n: FolderNode) => {
    for (const t of n.tags ?? []) tags.add(t);
    for (const c of n.children) walk(c);
  };
  if (root) walk(root);

  // Collect tags from dep rules (both keys and values)
  if (depRules) {
    for (const [from, toTags] of Object.entries(depRules)) {
      tags.add(from);
      for (const t of toTags) {
        tags.add(t);
      }
    }
  }

  return [...tags].sort((a, b) => a.localeCompare(b));
}
