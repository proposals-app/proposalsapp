#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import process from 'node:process';

const result = spawnSync(
  'pnpm',
  [
    'exec',
    'boneyard-js',
    'build',
    'http://localhost:3000/boneyard-capture',
    '--breakpoints',
    '375,475,768,1024,1280,1536',
    '--out',
    './app/bones',
  ],
  {
    stdio: 'inherit',
    cwd: process.cwd(),
  }
);

process.exit(result.status ?? 1);
