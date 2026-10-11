import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BlogArticle, displayCalendarDate } from '../src/components/BlogArticle';
import { Header, Footer, footerEmail, copyrightYear } from '../src/components/SiteChrome';
import { createSite } from '../src/content/site';
import { blockContext } from '../src/content/blocks';
import { careersEndpoint } from '../src/content/forms';
import { prepareContent } from '../src/content/prepare';
import { snapshotContent, tempDir } from './helpers';
import { stripRuntime } from '../src/build/strip-runtime';
import { parseRichText, headingAnchors, type RichNode } from '@digitalhub/blocks';
import { VacancyPage } from '../src/components/VacancyPage';
import { PageScaffold } from '../src/components/PageScaffold';
import { count } from './blocks/harness';

vi.mock('@/content/site', async (original) => {
  const actual = await original<typeof import('../src/content/site')>();
  const { snapshotContent: load } = await import('./helpers');
  return { ...actual, getSite: () => actual.createSite(load()) };
});

describe('page composition', () => {
  it('renders error pages with the hub hero and CTA styles, and published vacancies with their fields', () => {
    const site = createSite(snapshotContent());
    for (const code of ['404', '500'] as const) {
      const html = renderToStaticMarkup(<PageScaffold site={site} item={site.errorPage(code)} pageType="error" />);
      expect(count(html, 'h1')).toBe(1);
      expect(count(html, '.hub-hero')).toBe(1);
      expect(count(html, '.hub-cta__card')).toBe(1);
      expect(count(html, '.cs-section')).toBe(0);
    }
    const item = { ...site.content.pages[0], collection: 'vacancies' as const, slug: 'engineer', title: 'Engineer', sections: [], fields: { aboutRole: 'Build things.', keyResponsibilities: 'Design\nDeliver', requiredSkills: 'TypeScript', interviewStages: ['Introduction'] } };
    const html = renderToStaticMarkup(<VacancyPage item={item} />);
    expect(count(html, 'h1')).toBe(1);
    expect(html).toContain('<li>Design</li><li>Deliver</li>');
    expect(html).toContain('href="/careers/apply?role=engineer"');
  });
  it('does not collide a repeated heading with a literal numbered heading', () => {
    const headings = ['Title', 'Title', 'Title-2', 'Title'].map((text) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] }));
    expect(headingAnchors({ type: 'doc', content: headings }).map((heading) => heading.id)).toEqual(['title', 'title-2', 'title-2-2', 'title-3']);
  });
  it('renders every published article body and its matching table-of-contents anchors', () => {
    const site = createSite(snapshotContent());
    for (const post of site.content.collections['blog-posts']) {
      const html = renderToStaticMarkup(<BlogArticle item={post} ctx={blockContext(site, { kind: 'blog-post', slug: post.slug })} />);
      expect(count(html, 'h1')).toBe(1);
      expect(count(html, '.blog-view-hero')).toBe(1);
      expect(count(html, '.blog-view-body')).toBe(1);
      expect(count(html, '.blog-view-related')).toBe(1);
      const toc = html.match(/class="blog-view-toc"[\s\S]*?<\/nav>/)?.[0] ?? '';
      for (const [, id] of toc.matchAll(/href="#([^"]+)"/g)) expect(html).toContain(`id="${id}"`);
      expect(html).toContain('<blockquote>');
      expect(html).not.toContain('<blockquote><p>');
    }
  });
  it('renders FAQ and related posts, excludes unresolved references, and gives repeated headings distinct ids', () => {
    const content = snapshotContent();
    const post = content.collections['blog-posts'][0];
    const sibling = content.collections['blog-posts'][1];
    const doc = parseRichText(post.fields.body)!;
    const heading: RichNode = { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Repeated' }] };
    doc.content = [heading, heading];
    doc.relatedItems = [{ type: 'blog_post', id: sibling.id }, { type: 'blog_post', id: 'missing' }];
    post.fields.body = JSON.stringify(doc);
    post.fields.faq = JSON.stringify({ items: [{ question: 'Question?', answer: '<script>literal</script>' }] });
    const site = createSite(content);
    const html = renderToStaticMarkup(<BlogArticle item={post} ctx={blockContext(site, { kind: 'blog-post', slug: post.slug })} />);
    expect(html).toContain('id="repeated-2"');
    expect(html).toContain('href="#repeated-2"');
    expect(count(html, '.blog-view-related__card')).toBe(1);
    expect(html).toContain(sibling.path);
    expect(html).toContain('&lt;script&gt;literal&lt;/script&gt;');
    expect(html).toContain('class="blog-view-faq__item" open=""');
  });
  it('uses navigation ordering, skips unpublished links, and reads footer contacts only from settings', () => {
    const content = snapshotContent();
    const serviceMenu = content.navigation.find((node) => node.menu === 'header' && node.label === 'Services')!;
    serviceMenu.children[0].path = null;
    content.settings.email = 'edited@example.invalid';
    content.settings.phone = '+20 123';
    content.settings.linkedIn = 'https://linkedin.com/company/edited';
    const site = createSite(content);
    const header = renderToStaticMarkup(<Header site={site} set="home" currentPath="/" />);
    expect(header).not.toContain('Enterprise Software Solutions');
    expect(header).toContain('id="nav"');
    expect(header).toContain('id="mobileNav"');
    expect(header).toMatch(/<\/nav><script[^>]+index.inline-2.js/);
    const footer = renderToStaticMarkup(<Footer site={site} set="home" />);
    expect(footer).toContain('mailto:edited@example.invalid');
    expect(footer).not.toContain('sales@');
    expect(footer).toContain('tel:+20123');
    expect(footer).toContain('https://linkedin.com/company/edited');
  });
  it('shows the careers email on the careers, apply, and vacancy pages, and the main email everywhere else', () => {
    const content = snapshotContent();
    content.settings.email = 'main@example.invalid';
    content.settings.careersEmail = 'jobs@example.invalid';
    const site = createSite(content);
    for (const set of ['careers', 'apply', 'vacancy'] as const) {
      const footer = renderToStaticMarkup(<Footer site={site} set={set} />);
      expect(footer).toContain('<a href="mailto:jobs@example.invalid">jobs@example.invalid</a>');
      expect(footer).not.toContain('main@example.invalid');
    }
    for (const set of ['home', 'about', 'service', 'case-study', 'hub', 'blog-post', 'contact'] as const) {
      const footer = renderToStaticMarkup(<Footer site={site} set={set} />);
      expect(footer).toContain('<a href="mailto:main@example.invalid">main@example.invalid</a>');
      expect(footer).not.toContain('jobs@example.invalid');
    }
    expect(footerEmail({ ...content.settings, careersEmail: null }, 'careers')).toBe('main@example.invalid');
  });
  it('dates the copyright with the year of the build, as one text node', () => {
    const footer = renderToStaticMarkup(<Footer site={createSite(snapshotContent())} set="home" />);
    expect(footer).toContain(`<span>© ${new Date().getUTCFullYear()} Digital Hub S.A.E. All rights reserved.</span>`);
    expect(copyrightYear(new Date('2031-12-31T23:59:59Z'))).toBe(2031);
    expect(copyrightYear(new Date('2032-01-01T00:00:00Z'))).toBe(2032);
  });
  it('writes the byline from the editorial calendar dates, never a publish time or a time zone', () => {
    const content = snapshotContent();
    const post = content.collections['blog-posts'][0];
    post.publishedAt = '2026-10-04T09:30:00Z';
    post.fields.datePublished = '2026-06-15';
    post.fields.dateModified = '2026-08-12';
    const site = createSite(content);
    const render = () => renderToStaticMarkup(<BlogArticle item={post} ctx={blockContext(site, { kind: 'blog-post', slug: post.slug })} />);
    expect(render()).toMatch(/<p class="blog-view-byline">Published 15 Jun 2026 · Updated 12 Aug 2026( · \d+ min read)?<\/p>/);
    post.fields.dateModified = null;
    expect(render()).toMatch(/<p class="blog-view-byline">Published 15 Jun 2026( · \d+ min read)?<\/p>/);
    post.fields.datePublished = null;
    expect(render()).not.toContain('Published');
    expect(render()).not.toContain('4 Oct 2026');
  });
  it('formats only real calendar dates, identically in every time zone', () => {
    expect(displayCalendarDate('2026-06-15')).toBe('15 Jun 2026');
    expect(displayCalendarDate('2024-02-29')).toBe('29 Feb 2024');
    for (const invalid of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '2026-06-15T00:00:00Z', '2026-06-15Z', '15 Jun 2026', '', null, undefined]) {
      expect(displayCalendarDate(invalid)).toBeNull();
    }
    const zone = process.env.TZ;
    try {
      for (const tz of ['UTC', 'Africa/Cairo', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
        process.env.TZ = tz;
        expect(displayCalendarDate('2026-01-01')).toBe('1 Jan 2026');
      }
    } finally {
      process.env.TZ = zone;
    }
  });
  it('sets page classes before scripts execute in the static output', () => {
    const html = stripRuntime('<html lang="en"><body><main data-body-class="page-hub page-partner-view"></main></body></html>').html;
    expect(html).toContain('<html lang="en" class="nav-shown">');
    expect(html).toContain('<body class="page-hub page-partner-view">');
  });
});

describe('build requirements', () => {
  it.each(['404', '500'] as const)('fails API preparation when error page %s is missing or unpublished, before fetching media', async (code) => {
    for (const missing of [true, false]) {
      const content = snapshotContent();
      if (missing) content.errorPages[code] = null;
      else content.errorPages[code]!.publishedAt = null;
      const fetchImpl = vi.fn(async () => new Response(JSON.stringify(content), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      await expect(prepareContent({ source: 'api', apiUrl: 'http://example.invalid', token: 'test-only' }, { outDir: tempDir('missing-error'), mediaDir: tempDir('media'), fetchImpl })).rejects.toThrow(`Error page ${code} must be published`);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });
  it('requires a configured careers endpoint and rejects unsafe URLs', () => {
    expect(() => careersEndpoint({})).toThrow(/CAREERS_APPLICATION_ENDPOINT/);
    for (const value of ['javascript:alert(1)', '//outside.invalid', '/\\outside', 'https://user:password@example.invalid']) expect(() => careersEndpoint({ CAREERS_APPLICATION_ENDPOINT: value })).toThrow();
    expect(careersEndpoint({ CAREERS_APPLICATION_ENDPOINT: '/api/careers/applications' })).toBe('/api/careers/applications');
    expect(careersEndpoint({ CAREERS_APPLICATION_ENDPOINT: 'https://hiring.example.invalid/apply' })).toBe('https://hiring.example.invalid/apply');
  });
});
