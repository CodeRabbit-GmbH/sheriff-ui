/**
 * Analysis Operations
 * Functions for analyzing project structure and dependencies
 */
import { getProjectData, type ProjectData } from '@softarc/sheriff-core';
import type { DirNode, FileNode } from './types';
import { buildFolderTree } from './tree-operations';

type ProjectDataEntry = ProjectData[string];

function buildFileIdMapping(tree: DirNode): Record<string, string> {
  const fileIdByRel: Record<string, string> = {};
  const stack: Array<DirNode | FileNode> = [tree];
  while (stack.length) {
    const node = stack.pop();
    if (!node) break;
    if (node.type === 'dir') {
      for (const child of node.children) stack.push(child);
    } else {
      fileIdByRel[node.pathRel] = node.id;
    }
  }
  return fileIdByRel;
}

function mergeAnalysisWithIds(
  analysis: Record<string, ProjectDataEntry>,
  fileIdByRel: Record<string, string>,
): Record<string, ProjectDataEntry & { fileId?: string }> {
  const analysisWithIds: Record<string, ProjectDataEntry & { fileId?: string }> = {};
  for (const [relPath, entry] of Object.entries(analysis)) {
    analysisWithIds[relPath] = { ...entry, fileId: fileIdByRel[relPath] };
  }
  return analysisWithIds;
}

function annotateModules(tree: DirNode, moduleDirs: Set<string>): void {
  const annotateDir = (dir: DirNode): void => {
    dir.isSheriffModule = moduleDirs.has(dir.pathRel);
    for (const child of dir.children) {
      if (child.type === 'dir') annotateDir(child);
    }
  };
  annotateDir(tree);
}

function annotateTags(
  tree: DirNode,
  analysisWithIds: Record<string, ProjectDataEntry & { fileId?: string }>,
): void {
  const annotateDir = (dir: DirNode): void => {
    for (const child of dir.children) {
      if (child.type === 'dir') annotateDir(child);
    }

    const tagSet = new Set<string>();
    for (const child of dir.children) {
      if (child.type === 'file') {
        const analysis = analysisWithIds[child.pathRel];
        if (analysis?.tags && Array.isArray(analysis.tags)) {
          for (const tag of analysis.tags) tagSet.add(tag);
        }
      }
    }

    if (tagSet.size > 0) {
      dir.tags = Array.from(tagSet).sort();
    } else {
      delete dir.tags;
    }
  };
  annotateDir(tree);
}

/**
 * Analyzes project and merges results with folder tree structure.
 * Annotates tree nodes with module information and tags.
 *
 * @param entry - Entry file path (relative to cwd)
 * @param cwd - Working directory of the project
 * @returns Tree structure with analysis data, file ID mappings, and annotations
 */
export function analyzeAndMerge(
  entry: string,
  cwd: string,
): {
  tree: DirNode;
  analysis: Record<string, ProjectData[string] & { fileId?: string }>;
  fileIdByPathRel: Record<string, string>;
} {
  const tree = buildFolderTree(cwd, cwd, false);
  const analysis = getProjectData(entry, cwd, {
    includeExternalLibraries: true,
    projectName: 'default',
  });

  const fileIdByRel = buildFileIdMapping(tree);
  const analysisWithIds = mergeAnalysisWithIds(analysis, fileIdByRel);

  const moduleDirs = new Set<string>();
  for (const value of Object.values(analysis)) {
    moduleDirs.add(value.module);
  }

  annotateModules(tree, moduleDirs);
  annotateTags(tree, analysisWithIds);

  return {
    tree,
    analysis: analysisWithIds,
    fileIdByPathRel: fileIdByRel,
  };
}
