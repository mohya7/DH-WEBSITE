// @vitest-environment jsdom
/**
 * GAP-05: the two parity comparisons in ci.yml are real gates. The section
 * comparison blocks; the screenshot comparison blocks or cites an unexpired
 * deferred-items entry. The careers apply acceptance names exactly the form the
 * site renders.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApplyForm } from '../src/components/ApplyForm';

const root = path.resolve(process.cwd(), '..');
const workflow = readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
const compareHtml = readFileSync(path.join(process.cwd(), 'tools', 'section-compare', 'compare.html'), 'utf8');
const register: Array<Record<string, any>> = JSON.parse(readFileSync(path.join(process.cwd(), 'tools', 'section-compare', 'accepted-differences.json'), 'utf8'));
const deferred = readFileSync(path.join(root, 'docs', 'deferred-items.md'), 'utf8');

/** The lines of one top-level job under `jobs:`. */
function job(name: string): string[] {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${name}:`);
  expect(start, `job ${name} in ci.yml`).toBeGreaterThan(-1);
  const end = lines.findIndex((line, i) => i > start && /^  [A-Za-z0-9_-]+:/.test(line));
  return lines.slice(start, end === -1 ? undefined : end);
}
/** The lines of one step, from its `- name:` line to the next step. */
function step(lines: string[], name: string): string[] {
  const start = lines.findIndex((line) => line.trim() === `- name: ${name}`);
  expect(start, `step ${name}`).toBeGreaterThan(-1);
  const end = lines.findIndex((line, i) => i > start && /^\s+- (name|uses):/.test(line));
  return lines.slice(start, end === -1 ? undefined : end);
}
const hasContinueOnError = (lines: string[]) => lines.some((line) => /^\s+continue-on-error:/.test(line));
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const normalise = (text: string) => text.replace(/\s+/g, ' ').trim();

describe('parity gates (GAP-05)', () => {
  it('the section comparison step blocks', () => {
    expect(hasContinueOnError(step(job('section-compare'), 'Compare sections'))).toBe(false);
  });

  it('every section acceptance entry has a handler', () => {
    for (const rule of register) expect(compareHtml, `handler for ${rule.id}`).toContain(`rule.kind === '${rule.kind}'`);
    const entry = register.find((rule) => rule.kind === 'apply-form');
    expect(entry, 'apply-form entry').toBeDefined();
    expect(entry!.pages).toEqual(['/careers/apply.html']);
    expect(entry!.sections).toEqual(['section']);
    expect(String(entry!.reason ?? '').trim()).not.toBe('');
    expect(entry!.reason).toContain('"(a) Accept current form"');
    expect(register.some((rule) => rule.kind === 'apply-by-email')).toBe(false);
  });

  let oldPage: string | null = null;
  try {
    oldPage = execFileSync('git', ['show', 'feature/interviewer-portal:careers/apply.html'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    oldPage = null;
  }
  // Skipped when feature/interviewer-portal is not available. The shallow CI checkout of the website job has no feature/interviewer-portal; the
  // section-compare job, which checks that branch out, is the backstop there.
  it.skipIf(oldPage === null)('the apply-form selector matches the old compared section', () => {
    const entry = register.find((rule) => rule.kind === 'apply-form')!;
    expect(entry).toBeDefined();
    const doc = parse(oldPage!);
    const sections = [...(doc.querySelector('main')?.children ?? [])].filter((el) => el.tagName === 'SECTION');
    const matching = sections.filter((el) => el.matches(entry.selector));
    expect(matching).toHaveLength(1);
    expect(matching[0].querySelectorAll('section#apply.careers-apply.careers-apply--form')).toHaveLength(1);
  });

  it('the apply-form acceptance names the form the site renders', () => {
    const entry = register.find((rule) => rule.kind === 'apply-form');
    expect(entry, 'apply-form entry').toBeDefined();
    const rendered = parse(renderToStaticMarkup(createElement(ApplyForm, { email: 'careers@example.test' })));
    const form = rendered.querySelector('form')!;
    expect(entry!.action).toBe(form.getAttribute('action'));
    expect(entry!.heading).toBe(rendered.querySelector('h2')!.textContent);
    expect(entry!.fields).toEqual([...form.querySelectorAll('[name]')].map((el) => el.getAttribute('name')));
    const template = parse(compareHtml).querySelector('template#apply-form-markup') as HTMLTemplateElement | null;
    expect(template, 'template#apply-form-markup in compare.html').not.toBeNull();
    const style = template!.content.querySelector('style');
    expect(style, 'style in the template').not.toBeNull();
    expect(normalise(style!.textContent ?? '')).toBe(normalise(rendered.querySelector('style')!.textContent ?? ''));
  });

  it('the screenshot comparison is blocking or excepted', () => {
    const lines = job('screenshot-parity');
    if (!hasContinueOnError(step(lines, 'Compare screenshots'))) return;
    const comment = lines.filter((line) => line.trim().startsWith('#')).join('\n');
    const ids = [...comment.matchAll(/\bD-\d{3}\b/g)].map((m) => m[0]);
    expect(ids, 'the screenshot-parity job comment cites a D-NNN (GAP-05, docs/changes/GAP-05/plan.md)').not.toHaveLength(0);
    const today = new Date().toISOString().slice(0, 10);
    for (const id of ids) {
      const body = deferred.split(/^## /m).find((part) => part.startsWith(`${id}:`));
      expect(body, `${id} in docs/deferred-items.md`).toBeDefined();
      const expires = body!.match(/^- Expires: (\d{4}-\d{2}-\d{2})/m)?.[1];
      expect(expires, `${id} has an Expires date`).toBeDefined();
      expect(expires! >= today, `${id} expired on ${expires}: make "Compare screenshots" block or have the owner renew ${id} (GAP-05)`).toBe(true);
    }
  });
});
