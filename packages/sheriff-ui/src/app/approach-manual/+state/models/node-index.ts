import type { FolderNode } from '../../../module-renderer/+state/models/folder-node';

/**
 * Index structure for efficient node lookups.
 */
export type NodeIndex = {
  byId: Map<string, FolderNode>;
  parentById: Map<string, string | null>;
};
