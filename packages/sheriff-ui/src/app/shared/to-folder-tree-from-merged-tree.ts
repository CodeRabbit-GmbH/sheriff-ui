import { FolderNode } from '../module-renderer/+state/models/folder-node';
import type { DirNode } from '../api/models/dir-node';

/**
 * Convert merged analyze response to a directory-only hierarchical Konva tree.
 * Returns null if no tree is present.
 */
export function toFolderTreeFromMergedTree(merged: { tree?: DirNode } | undefined): FolderNode | null {
  if (!merged || !merged.tree) return null;

  const toTree = (node: DirNode, parentId?: string): FolderNode => {
    const dirChildren = node.children.filter((c): c is DirNode => c.type === 'dir');
    return {
      id: node.id,
      parentId,
      name: node.name,
      pathRel: node.pathRel,
      isSheriffModule: node.isSheriffModule,
      tags: node.tags,
      hasChildren: dirChildren.length > 0,
      children: dirChildren.map((d) => toTree(d, node.id)),
    };
  };

  return toTree(merged.tree);
}


