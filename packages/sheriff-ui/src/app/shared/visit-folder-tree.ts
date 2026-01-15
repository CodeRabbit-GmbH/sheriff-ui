import { FolderNode } from '../module-renderer/+state/models/folder-node';

/**
 * Generic depth-first visitor over a KonvaTreeNode hierarchy.
 */
export function visitFolderTree(
  root: FolderNode | null | undefined,
  visitor: (node: FolderNode, parent: FolderNode | undefined, depth?: number) => void,
): void {
  if (!root) return;
  const walk = (n: FolderNode, parent: FolderNode | undefined, depth: number) => {
    visitor(n, parent, depth);
    for (const c of n.children) walk(c, n, depth + 1);
  };
  walk(root, undefined, 0);
}


