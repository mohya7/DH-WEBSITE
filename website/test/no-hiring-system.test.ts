import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The website, Studio, and Content API launch with no connection to the old
 * hiring system. These three strings are that connection. The allow-list is
 * the one-off importer and the tools that read the old site for comparison.
 */
const needles = ['CAREERS_APPLICATION_ENDPOINT', '/api/careers', '/api/booking'];

/** Paths relative to the repo root. A prefix match keeps the whole tree. */
const allow = [
  'website/test/no-hiring-system.test.ts',
  'api/tools/DigitalHub.ContentImport',
  'website/tools',
];

const roots = ['website', 'studio', 'api', '.github/workflows/ci.yml'];

const repo = path.resolve(import.meta.dirname, '../..');

function trackedFiles(): string[] {
  const listed = spawnSync('git', ['ls-files', '-z', '--', ...roots], { cwd: repo, encoding: 'utf8' });
  if (listed.status !== 0) throw new Error(listed.stderr || 'git ls-files failed');
  return listed.stdout.split('\0').filter(Boolean);
}

describe('no hiring system', () => {
  it('keeps the careers endpoint, /api/careers, and /api/booking out of the product and CI', () => {
    const hits: string[] = [];
    for (const rel of trackedFiles()) {
      const normalized = rel.replaceAll('\\', '/');
      if (allow.some((prefix) => normalized === prefix || normalized.startsWith(prefix + '/'))) continue;
      const text = readFileSync(path.join(repo, rel));
      if (text.includes(0)) continue;
      const source = text.toString('utf8');
      for (const needle of needles) {
        if (source.includes(needle)) hits.push(`${normalized} contains ${needle}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
