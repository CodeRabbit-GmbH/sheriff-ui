import type { FolderNode } from '../../../module-renderer/+state/models/folder-node';
import type { NodeIndex } from '../models/node-index';

/**
 * Builds an index for efficient node lookups.
 */
export function buildIdIndex(root: FolderNode | null): NodeIndex {
  const byId = new Map<string, FolderNode>();
  const parentById = new Map<string, string | null>();
  if (!root) return { byId, parentById };

  const walk = (n: FolderNode, parent: string | null) => {
    byId.set(n.id, n);
    parentById.set(n.id, parent);
    for (const c of n.children) walk(c, n.id);
  };
  walk(root, null);
  return { byId, parentById };
}
