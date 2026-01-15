import * as fs from 'fs';
import * as path from 'path';
import type { DirNode } from './types';
import { computeChecksum } from './crypto-utils';

const IGNORED_DIRECTORIES = new Set<string>(['node_modules', 'dist']);

export function buildFolderTree(
  rootAbs: string,
  currentAbs: string = rootAbs,
  directoriesOnly: boolean = false,
): DirNode {
  const name = currentAbs === rootAbs ? path.basename(rootAbs) || '.' : path.basename(currentAbs);
  const pathRel = path.relative(rootAbs, currentAbs) || '.';
  const node: DirNode = {
    id: computeChecksum(currentAbs),
    name,
    pathRel,
    pathAbs: currentAbs,
    type: 'dir',
    children: [],
    isSheriffModule: false,
  };

  const entries = fs.readdirSync(currentAbs, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(e.name)) continue;
      if (e.name.startsWith('.')) continue;
      if (e.name.toLowerCase().includes('test')) continue;
      const childAbs = path.join(currentAbs, e.name);
      node.children.push(buildFolderTree(rootAbs, childAbs, directoriesOnly));
    } else if (!directoriesOnly && e.isFile()) {
      const childAbs = path.join(currentAbs, e.name);
      const fileRel = path.relative(rootAbs, childAbs);
      node.children.push({
        id: computeChecksum(childAbs),
        name: e.name,
        pathRel: fileRel,
        pathAbs: childAbs,
        type: 'file',
      });
    }
  }

  return node;
}

