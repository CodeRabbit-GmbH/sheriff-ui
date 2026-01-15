import { SheriffConfig } from '@softarc/sheriff-core';

export const config: SheriffConfig = {
  enableBarrelLess: true,
  modules: {},
  depRules: {
    'root': 'noTag',
    'noTag': 'noTag',
  },
  entryFile: 'packages/sheriff-ui/src/main.ts',
};
