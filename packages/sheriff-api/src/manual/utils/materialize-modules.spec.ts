import { describe, expect, it } from 'vitest';
import type { DirNode } from '../../core/types';
import {
  matchPatternAndResolveTags,
  applyModulesToTree,
  materializeModulesByPathRel,
} from './materialize-modules';

describe('matchPatternAndResolveTags', () => {
  it('returns null when path does not match pattern', () => {
    const result = matchPatternAndResolveTags(
      'libs/feature-auth/src',
      'libs/ui-<name>/src',
      ['type:ui'],
    );
    expect(result).toBeNull();
  });

  it('matches exact patterns without placeholders', () => {
    const result = matchPatternAndResolveTags(
      'libs/ui-button/src',
      'libs/ui-button/src',
      ['type:ui'],
    );
    expect(result).toEqual(['type:ui']);
  });

  it('matches pattern with single placeholder', () => {
    const result = matchPatternAndResolveTags(
      'libs/ui-button/src',
      'libs/ui-<name>/src',
      ['type:ui', 'name:<name>'],
    );
    expect(result).toEqual(['type:ui', 'name:button']);
  });

  it('matches pattern with multiple placeholders', () => {
    const result = matchPatternAndResolveTags(
      'libs/auth/feature',
      'libs/<domain>/<type>',
      ['domain:<domain>', 'type:<type>'],
    );
    expect(result).toEqual(['domain:auth', 'type:feature']);
  });

  it('matches pattern with placeholder containing dash', () => {
    const result = matchPatternAndResolveTags(
      'libs/ui-components/src',
      'libs/<lib-name>/src',
      ['lib:<lib-name>'],
    );
    expect(result).toEqual(['lib:ui-components']);
  });

  it('matches pattern with placeholder containing underscore', () => {
    const result = matchPatternAndResolveTags(
      'apps/main/src',
      'apps/<app_name>/src',
      ['app:<app_name>'],
    );
    expect(result).toEqual(['app:main']);
  });

  it('does not match partial paths', () => {
    const result = matchPatternAndResolveTags(
      'libs/ui-button/src/components',
      'libs/ui-<name>/src',
      ['type:ui'],
    );
    expect(result).toBeNull();
  });

  it('does not match shorter paths', () => {
    const result = matchPatternAndResolveTags(
      'libs/ui-button',
      'libs/ui-<name>/src',
      ['type:ui'],
    );
    expect(result).toBeNull();
  });

  it('preserves tags without placeholders', () => {
    const result = matchPatternAndResolveTags(
      'libs/shared/src',
      'libs/<name>/src',
      ['domain:shared', 'type:util'],
    );
    expect(result).toEqual(['domain:shared', 'type:util']);
  });
});

describe('applyModulesToTree', () => {
  function createDirNode(
    pathRel: string,
    children: DirNode[] = [],
    overrides: Partial<DirNode> = {},
  ): DirNode {
    return {
      type: 'dir',
      name: pathRel.split('/').pop() ?? pathRel,
      pathRel,
      children,
      isSheriffModule: false,
      tags: [],
      ...overrides,
    };
  }

  it('applies explicit module tags', () => {
    const tree = createDirNode('libs', [
      createDirNode('libs/auth'),
      createDirNode('libs/shared'),
    ]);

    applyModulesToTree(tree, {
      'libs/auth': ['domain:auth'],
      'libs/shared': ['domain:shared'],
    });

    expect(tree.children[0].tags).toEqual(['domain:auth']);
    expect(tree.children[0].isSheriffModule).toBe(true);
    expect(tree.children[1].tags).toEqual(['domain:shared']);
    expect(tree.children[1].isSheriffModule).toBe(true);
  });

  it('applies pattern modules when no explicit match', () => {
    const tree = createDirNode('libs', [
      createDirNode('libs/ui-button', [
        createDirNode('libs/ui-button/src'),
      ]),
      createDirNode('libs/ui-input', [
        createDirNode('libs/ui-input/src'),
      ]),
    ]);

    applyModulesToTree(
      tree,
      {}, // no explicit modules
      { 'libs/ui-<name>/src': ['type:ui', 'name:<name>'] },
    );

    const buttonSrc = tree.children[0].children[0];
    const inputSrc = tree.children[1].children[0];

    expect(buttonSrc.tags).toEqual(['type:ui', 'name:button']);
    expect(buttonSrc.isSheriffModule).toBe(true);
    expect(inputSrc.tags).toEqual(['type:ui', 'name:input']);
    expect(inputSrc.isSheriffModule).toBe(true);
  });

  it('explicit modules take precedence over patterns', () => {
    const tree = createDirNode('libs', [
      createDirNode('libs/ui-button', [
        createDirNode('libs/ui-button/src'),
      ]),
    ]);

    applyModulesToTree(
      tree,
      { 'libs/ui-button/src': ['explicit:tag'] },
      { 'libs/ui-<name>/src': ['type:ui'] },
    );

    const buttonSrc = tree.children[0].children[0];
    expect(buttonSrc.tags).toEqual(['explicit:tag']);
  });

  it('handles nested patterns', () => {
    const tree = createDirNode('libs', [
      createDirNode('libs/auth', [
        createDirNode('libs/auth/feature'),
        createDirNode('libs/auth/data'),
      ]),
      createDirNode('libs/shared', [
        createDirNode('libs/shared/feature'),
        createDirNode('libs/shared/util'),
      ]),
    ]);

    applyModulesToTree(
      tree,
      {},
      { 'libs/<domain>/<type>': ['domain:<domain>', 'type:<type>'] },
    );

    expect(tree.children[0].children[0].tags).toEqual(['domain:auth', 'type:feature']);
    expect(tree.children[0].children[1].tags).toEqual(['domain:auth', 'type:data']);
    expect(tree.children[1].children[0].tags).toEqual(['domain:shared', 'type:feature']);
    expect(tree.children[1].children[1].tags).toEqual(['domain:shared', 'type:util']);
  });
});

describe('materializeModulesByPathRel', () => {
  function createDirNode(
    pathRel: string,
    children: DirNode[] = [],
    overrides: Partial<DirNode> = {},
  ): DirNode {
    return {
      type: 'dir',
      name: pathRel.split('/').pop() ?? pathRel,
      pathRel,
      children,
      isSheriffModule: false,
      tags: [],
      ...overrides,
    };
  }

  it('extracts modules with tags', () => {
    const tree = createDirNode('libs', [
      createDirNode('libs/auth', [], { isSheriffModule: true, tags: ['domain:auth'] }),
      createDirNode('libs/shared', [], { isSheriffModule: true, tags: ['domain:shared'] }),
    ]);

    const result = materializeModulesByPathRel(tree);

    expect(result).toEqual({
      'libs/auth': ['domain:auth'],
      'libs/shared': ['domain:shared'],
    });
  });

  it('ignores nodes without tags', () => {
    const tree = createDirNode('libs', [
      createDirNode('libs/auth', [], { isSheriffModule: true, tags: [] }),
      createDirNode('libs/shared', [], { isSheriffModule: false }),
    ]);

    const result = materializeModulesByPathRel(tree);

    expect(result).toEqual({});
  });
});
