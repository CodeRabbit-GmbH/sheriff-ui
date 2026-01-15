/**
 * Utilities for extracting and applying module tags to the folder tree.
 *
 * Key concepts:
 * - "Materialize" = extract module tags from tree nodes into a flat map
 * - "Apply" = write tags from a flat map back to tree nodes
 * - Patterns use <placeholder> syntax (e.g., 'src/<domain>' → 'src/orders' gets tag 'orders')
 */
import type { DirNode } from '../../core/types';
import type { TagsByPathRel } from '../models/manual-config.models';

const PLACEHOLDER_REGEX = /<[a-zA-Z-_]+>/g;

export function matchPatternAndResolveTags(
  path: string,
  pattern: string,
  tags: string[],
): string[] | null {
  PLACEHOLDER_REGEX.lastIndex = 0;

  const placeholderMatches = pattern.match(PLACEHOLDER_REGEX);
  if (!placeholderMatches) {
    return path === pattern ? [...tags] : null;
  }

  const placeholderNames = placeholderMatches.map((p) => p.slice(1, -1));
  const regexPattern = pattern.replace(PLACEHOLDER_REGEX, '([^/]+)');
  const regex = new RegExp(`^${regexPattern}$`);
  const match = path.match(regex);

  if (!match) {
    return null;
  }

  const placeholders: Record<string, string> = {};
  placeholderNames.forEach((name, index) => {
    placeholders[name] = match[index + 1];
  });

  return tags.map((tag) => {
    let resolvedTag = tag;
    for (const [name, value] of Object.entries(placeholders)) {
      resolvedTag = resolvedTag.replace(new RegExp(`<${name}>`, 'g'), value);
    }
    return resolvedTag;
  });
}

export function materializeModulesByPathRel(root: DirNode): TagsByPathRel {
  const out: TagsByPathRel = {};

  const walk = (node: DirNode): void => {
    if (node.isSheriffModule && (node.tags?.length ?? 0) > 0) {
      out[node.pathRel] = [...(node.tags ?? [])];
    }
    for (const child of node.children) {
      if (child.type === 'dir') walk(child);
    }
  };

  walk(root);
  return out;
}

export function applyModulesToTree(
  root: DirNode,
  modulesByPathRel: TagsByPathRel,
  patterns?: TagsByPathRel,
): void {
  const walk = (node: DirNode): void => {
    const explicitTags = modulesByPathRel[node.pathRel];
    if (explicitTags !== undefined) {
      node.tags = explicitTags;
      node.isSheriffModule = node.isSheriffModule || explicitTags.length > 0;
    } else if (patterns) {
      for (const [pattern, tags] of Object.entries(patterns)) {
        const resolvedTags = matchPatternAndResolveTags(node.pathRel, pattern, tags);
        if (resolvedTags !== null) {
          node.tags = resolvedTags;
          node.isSheriffModule = true;
          break;
        }
      }
    }

    for (const child of node.children) {
      if (child.type === 'dir') walk(child);
    }
  };
  walk(root);
}

