/**
 * The website, Studio, and Content API launch with no hiring system.
 * An application is an email plus a count. These strings are a candidate
 * store, a CV store, a pipeline, or the old careers API. The apply endpoint,
 * the application_counts table, and the hr role are allowed and are not needles.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const needles = [
  'CAREERS_APPLICATION_ENDPOINT',
  '/api/careers',
  '/api/booking',
  'class Candidate',
  'DbSet<Candidate',
  'cv_blob',
  'InterviewPipeline',
];

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
  it('keeps a candidate store, CV storage, and the old careers API out of the product', () => {
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

  it('still has the apply endpoint, the counter table, and the hr role', () => {
    const apply = readFileSync(path.join(repo, 'api/src/DigitalHub.Api/Controllers/PublicApplyController.cs'), 'utf8');
    const counts = readFileSync(path.join(repo, 'api/src/DigitalHub.Api/Data/ContentModelBuilder.cs'), 'utf8');
    const roles = readFileSync(path.join(repo, 'api/src/DigitalHub.Api/Identity/Roles.cs'), 'utf8');
    expect(apply).toContain('api/v1/public/apply');
    expect(counts).toContain('application_counts');
    expect(roles).toContain('hr');
    expect(roles).not.toContain('marketing');
    expect(roles).not.toContain('interviewer');
  });
});
