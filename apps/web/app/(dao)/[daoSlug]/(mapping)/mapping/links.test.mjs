import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function readSource(relativePath) {
  return readFile(path.join(__dirname, relativePath), 'utf8');
}

test('mapping page links to delegates without duplicating the dao slug', async () => {
  const source = await readSource('page.tsx');

  assert.match(source, /href:\s*`\/mapping\/delegates`/);
});

test('delegates page links back to proposal mapping without duplicating the dao slug', async () => {
  const source = await readSource(path.join('delegates', 'page.tsx'));

  assert.match(source, /href:\s*`\/mapping`/);
});
