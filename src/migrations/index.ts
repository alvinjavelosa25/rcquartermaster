import * as migration_20261120_145638_initial from './20261120_145638_initial';

export const migrations = [
  {
    up: migration_20261120_145638_initial.up,
    down: migration_20261120_145638_initial.down,
    name: '20261120_145638_initial'
  },
];
