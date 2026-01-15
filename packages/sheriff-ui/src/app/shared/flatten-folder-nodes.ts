import type { FolderNode } from '../module-renderer/+state/models/folder-node';
import { visitFolderTree } from './visit-folder-tree';

/**
 * Convenience: flatten a Konva tree into flat KonvaNode[]
 */
export function flattenFolderNodes(root: FolderNode | null | undefined): FolderNode[] {
  const out: FolderNode[] = [];
  visitFolderTree(root, (n, parent) => {
    out.push({ id: n.id, parentId: parent?.id, name: n.name, pathRel: n.pathRel, tags: n.tags, hasChildren: !!(n.children && n.children.length), isSheriffModule: !!n.isSheriffModule, children: [] });
  });
  return out;
}


