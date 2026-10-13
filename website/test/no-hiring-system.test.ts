import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The website, Studio, and Content API launch with no connection to the old
 * hiring system. These three strings are that connection. The allow-list is
 * the one-off importer and the tools that read the old site for comparison.
 */
const needles = ['CAREERS_APPLICATION_ENDPOINT', '/api/careers', '/api/booking'];

const skipDirs = new Set(['node_modules', 'out', 'public', '.content', '.next', 'dist', 'bin', 'obj']);

/** Paths relative to the repo root. A prefix match keeps the whole tree. */
const allow = [
  'website/test/no-hiring-system.test.ts',
  'api/tools/DigitalHub.ContentImport',
  'website/tools',
];

const roots = ['website', 'studio', 'api', '.github/workflows/ci.yml'];

const repo = path.resolve(import.meta.dirname, '../..');

function walk(rel: string, hits: string[]) {
  const normalized = rel.replaceAll('\\', '/');
  if (allow.some((prefix) => normalized === prefix || normalized.startsWith(prefix + '/'))) return;
  const abs = path.join(repo, rel);
  const info = statSync(abs);
  if (info.isDirectory()) {
    if (skipDirs.has(path.basename(abs))) return;
    for (const name of readdirSync(abs)) walk(path.join(rel, name), hits);
    return;
  }
  const text = readFileSync(abs);
  if (text.includes(0)) return;
  const source = text.toString('utf8');
  for (const needle of needles) {
    if (source.includes(needle)) hits.push(`${normalized} contains ${needle}`);
  }
}

describe('no hiring system', () => {
  it('keeps the careers endpoint, /api/careers, and /api/booking out of the product and CI', () => {
    const hits: string[] = [];
    for (const root of roots) walk(root, hits);
    expect(hits).toEqual([]);
  });
});
