import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

async function readSource(relativePath: string): Promise<string> {
  return readFile(path.join(currentDirectory, relativePath), 'utf8');
}

describe('mapping navigation', () => {
  it('links to delegates without duplicating the DAO slug', async () => {
    const source = await readSource('page.tsx');

    expect(source).toMatch(/href:\s*`\/mapping\/delegates`/);
  });

  it('links back to proposal mapping without duplicating the DAO slug', async () => {
    const source = await readSource(path.join('delegates', 'page.tsx'));

    expect(source).toMatch(/href:\s*`\/mapping`/);
  });
});
