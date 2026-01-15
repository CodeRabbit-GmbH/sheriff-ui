import type { FileNode } from './file-node';

export type DirNode = {
  id: string;
  name: string;
  pathRel: string;
  pathAbs: string;
  type: 'dir';
  children: Array<DirNode | FileNode>;
  isSheriffModule: boolean;
  tags?: string[];
};

