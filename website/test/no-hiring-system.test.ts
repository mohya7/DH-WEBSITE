/**
 * The website, Studio, and Content API launch with no hiring system.
 * An application is an email plus a count. These strings are a candidate
 * store, a CV store, a pipeline, or the old careers API. The apply endpoint,
 * the application_counts table, and the hr role are allowed and are not needles.
 *
 * The scan walks the working tree, not only files git already tracks, so an
 * untracked scratch file is visible. DbSet types are the API context's
 * allow-list (a single type-parameter letter such as T is a generic method).
 * Table and column names in the model and migrations may not look like a CV,
 * an applicant, a resume, a candidate, or an interview store. application_counts
 * is the counter. interview_stages is the vacancy page's existing content field.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
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

const skipDirs = new Set(['bin', 'obj', 'node_modules', '.next', 'dist', 'coverage']);

/** Concrete sets on ContentDbContext. Identity's sets live on the base class. */
const dbSetAllow = new Set([
  'RefreshToken',
  'Page',
  'Section',
  'Service',
  'Partner',
  'CaseStudy',
  'BlogPost',
  'Vacancy',
  'TeamMember',
  'NewsItem',
  'MediaAsset',
  'Redirect',
  'NavigationItem',
  'SiteSettings',
  'WorkingCopy',
  'Revision',
  'AuditLogEntry',
  'ContactRequest',
  'ApplicationCount',
]);

/**
 * Names already in the model that are not a hiring store.
 * interview_stages is copy on the vacancy page. application_counts is the counter.
 */
const nameAllow = new Set(['application_counts', 'interview_stages']);

const hiringName = /^(cv_|applicant|resume|candidate|interview)/i;

const repo = path.resolve(import.meta.dirname, '../..');

function files(): string[] {
  const found: string[] = [];
  for (const root of roots) {
    const absolute = path.join(repo, root);
    walk(absolute, found);
  }
  return found;
}

function walk(absolute: string, found: string[]) {
  let info: ReturnType<typeof statSync>;
  try {
    info = statSync(absolute);
  } catch {
    return;
  }
  if (info.isFile()) {
    found.push(absolute);
    return;
  }
  if (!info.isDirectory()) return;
  for (const name of readdirSync(absolute)) {
    if (skipDirs.has(name)) continue;
    walk(path.join(absolute, name), found);
  }
}

function relative(absolute: string) {
  return path.relative(repo, absolute).replaceAll('\\', '/');
}

function allowed(normalized: string) {
  return allow.some((prefix) => normalized === prefix || normalized.startsWith(prefix + '/'));
}

function textOf(absolute: string): string | null {
  const text = readFileSync(absolute);
  if (text.includes(0)) return null;
  return text.toString('utf8');
}

function inModel(normalized: string) {
  return normalized.startsWith('api/src/DigitalHub.Api/Data/') && normalized.endsWith('.cs');
}

function names(source: string): string[] {
  const found = new Set<string>();
  for (const match of source.matchAll(/HasColumnName\("([^"]+)"\)|ToTable\("([^"]+)"\)/g)) {
    found.add(match[1] ?? match[2]);
  }
  for (const match of source.matchAll(/\b([a-z][a-z0-9_]*)\s*=\s*table\.Column/g)) {
    found.add(match[1]);
  }
  for (const match of source.matchAll(/name:\s*"([^"]+)"/g)) {
    found.add(match[1]);
  }
  return [...found];
}

describe('no hiring system', () => {
  it('keeps a candidate store, CV storage, and the old careers API out of the product', () => {
    const hits: string[] = [];
    for (const absolute of files()) {
      const normalized = relative(absolute);
      if (allowed(normalized)) continue;
      const source = textOf(absolute);
      if (source === null) continue;
      for (const needle of needles) {
        if (source.includes(needle)) hits.push(`${normalized} contains ${needle}`);
      }
      for (const match of source.matchAll(/DbSet<([A-Za-z_][A-Za-z0-9_]*)/g)) {
        const type = match[1];
        if (type.length === 1) continue;
        if (!dbSetAllow.has(type)) hits.push(`${normalized} has DbSet<${type}>`);
      }
      if (inModel(normalized)) {
        for (const name of names(source)) {
          if (nameAllow.has(name) || !hiringName.test(name)) continue;
          hits.push(`${normalized} names ${name}`);
        }
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
