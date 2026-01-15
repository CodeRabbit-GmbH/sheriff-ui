import { describe, expect, it } from 'vitest';
import { generateManualSheriffConfig, optimizeModuleTags } from './config-generator';

describe('generateManualSheriffConfig', () => {
  it('includes sameTag import when depRulesRaw contains sameTag function', () => {
    const content = generateManualSheriffConfig({
      options: { enableBarrelLess: true },
      originalModulesConfig: { 'libs/<domain>': ['domain:<domain>'] },
      modulesByPathRel: { 'libs/a': ['domain:auth'] },
      depRules: { 'domain:auth': ['domain:auth'] },
      depRulesRaw: { 'domain:auth': { kind: 'function', source: 'sameTag' } },
    });

    expect(content).toContain(`import { SheriffConfig, sameTag } from '@softarc/sheriff-core';`);
    expect(content).toContain(`'domain:auth': sameTag,`);
  });

  it('includes anyTag import when used in mixed rules', () => {
    const content = generateManualSheriffConfig({
      options: { enableBarrelLess: true },
      modulesByPathRel: {},
      depRules: { a: ['b', 'c'] },
      depRulesRaw: { a: { kind: 'mixed', tags: ['b'], functions: ['anyTag'] } },
    });

    expect(content).toContain(`import { SheriffConfig, anyTag } from '@softarc/sheriff-core';`);
    expect(content).toContain(`'a': [anyTag, 'b', 'c'],`);
  });

  it('converts empty depRules arrays to noDependencies helper', () => {
    const content = generateManualSheriffConfig({
      options: { enableBarrelLess: false },
      modulesByPathRel: {},
      depRules: { 'type:model': [] },
    });

    expect(content).toContain(`enableBarrelLess: false,`);
    expect(content).toContain(`import { SheriffConfig, noDependencies } from '@softarc/sheriff-core';`);
    expect(content).toContain(`'type:model': noDependencies,`);
  });

  it('preserves helper imports from original config', () => {
    const originalConfig = `import { SheriffConfig, anyTag, sameTag } from '@softarc/sheriff-core';\nexport const sheriffConfig: SheriffConfig = { modules: {}, depRules: { 'root': anyTag } };`;

    const content = generateManualSheriffConfig({
      modulesByPathRel: {},
      depRules: { root: ['type:feature'] },
      originalConfig,
    });

    expect(content).toContain(`import { SheriffConfig, anyTag, sameTag } from '@softarc/sheriff-core';`);
  });
});

describe('optimizeModuleTags', () => {
  it('normalizes tags (removes root, noTag, duplicates) and removes entries matching inferred', () => {
    expect(optimizeModuleTags({ 'libs/a': ['noTag', 'domain:auth'] }, { 'libs/a': ['domain:auth'] })).toEqual({});

    expect(optimizeModuleTags({ 'libs/a': ['root', 'domain:auth', 'domain:auth'] }, { 'libs/a': [] })).toEqual({
      'libs/a': ['domain:auth'],
    });
  });

  it('keeps explicit noTag entries not present in inferred', () => {
    expect(optimizeModuleTags({ 'libs/a': ['noTag'] }, {})).toEqual({ 'libs/a': ['noTag'] });
  });
});

