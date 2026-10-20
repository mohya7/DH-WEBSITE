import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { BlogArticle, displayCalendarDate } from '../src/components/BlogArticle';
import { Header, Footer, footerEmail, copyrightYear } from '../src/components/SiteChrome';
import { createSite } from '../src/content/site';
import { blockContext } from '../src/content/blocks';
import { prepareContent } from '../src/content/prepare';
import { snapshotContent, tempDir } from './helpers';
import { stripRuntime } from '../src/build/strip-runtime';
import { parseRichText, headingAnchors, type RichNode } from '@digitalhub/blocks';
import { VacancyPage } from '../src/components/VacancyPage';
import { PrivacyCareersPage } from '../src/app/privacy-careers/page';
import { PageScaffold } from '../src/components/PageScaffold';
import { headMetadata, pageHead } from '../src/seo/head';
import { consentCopy, consentDefaults, tagManagerId } from '../src/components/Consent';
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
    const html = renderToStaticMarkup(<VacancyPage item={item} email="careers@digitalhub.com.eg" />);
    expect(count(html, 'h1')).toBe(1);
    expect(html).toContain('<li>Design</li><li>Deliver</li>');
    expect(html).toContain('action="/api/v1/public/apply"');
    expect(html).toContain('href="/privacy-careers"');
    expect(html).not.toContain('/careers/apply?role=');
  });
  it('puts the hub page class on the blogs and partners body, which the design uses for spacing, chips, and the intro width', () => {
    const site = createSite(snapshotContent());
    for (const [path, body] of [['/blogs', 'page-hub page-blogs'], ['/partners', 'page-hub page-partners']] as const) {
      const item = site.routes.find((route) => route.path === path)!.item;
      const html = renderToStaticMarkup(<PageScaffold site={site} item={item} pageType="page" path={path} />);
      expect(html).toContain(`data-body-class="${body}"`);
    }
  });
  it('posts the apply page to the careers form', () => {
    const content = snapshotContent();
    const site = createSite(content);
    const apply = site.routes.find((route) => route.path === '/careers/apply')!.item;
    const html = renderToStaticMarkup(<PageScaffold site={site} item={apply} pageType="page" path="/careers/apply" />);
    expect(html).toContain('action="/api/v1/public/apply"');
    expect(html).toContain('Send your CV and a short note about the role you want. Our careers team reviews every application.');
    const description = 'Apply for an open role at Digital Hub by email. Send your CV, LinkedIn profile and availability to our careers team.';
    const meta = headMetadata(pageHead(site, apply, 'page', '/careers/apply', 'https://digitalhub.com.eg'));
    expect(meta.description).toBe(description);
    expect(meta.openGraph?.description).toBe(description);
    expect(meta.twitter?.description).toBe(description);
    expect(html.match(/Our careers team reviews every application\./g)).toHaveLength(1);
    expect(html).toContain('href="mailto:careers@digitalhub.com.eg"');
    expect(html).toContain('Apply to join Digital Hub');
    expect(html).toContain('type="file"');
    const without = createSite({ ...content, settings: { ...content.settings, careersEmail: null } });
    const fallback = renderToStaticMarkup(<PageScaffold site={without} item={apply} pageType="page" path="/careers/apply" />);
    expect(fallback).toContain(`href="mailto:${content.settings.email}"`);
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
  it('shows the mailbox the API sends to, the careers address or the main email when that is empty', () => {
    const content = snapshotContent();
    content.settings.email = 'sales@example.invalid';
    content.settings.careersEmail = 'jobs@example.invalid';
    const careers = renderToStaticMarkup(<PrivacyCareersPage site={createSite(content)} />);
    expect(careers).toContain('our careers mailbox (jobs@example.invalid)');
    expect(careers).toContain('write to jobs@example.invalid');
    expect(careers).not.toContain('careers@digitalhub.com.eg');
    const fallback = renderToStaticMarkup(<PrivacyCareersPage site={createSite({ ...content, settings: { ...content.settings, careersEmail: null } })} />);
    expect(fallback).toContain('our careers mailbox (sales@example.invalid)');
    expect(fallback).toContain('write to sales@example.invalid');
  });
  it('keeps the old Nexthink footer tagline on that page only', () => {
    const site = createSite(snapshotContent());
    expect(renderToStaticMarkup(<Footer site={site} set="hub" currentPath="/partners/nexthink" />)).toContain('<p class="footer-tagline">Empowering Digital Evolution — Egypt &amp; GCC</p>');
    expect(renderToStaticMarkup(<Footer site={site} set="hub" currentPath="/partners/huawei" />)).toContain('<p class="footer-tagline">Empowering Digital Evolution</p>');
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
  it('keeps subpage on a themed case study when the static body class is applied', () => {
    for (const body of ["page-case", "theme-orange page-case", "theme-teal page-case"]) {
      const html = stripRuntime(`<html lang="en"><body><main data-body-class="${body}"></main></body></html>`).html;
      expect(html).toContain('<html lang="en" class="nav-shown subpage">');
      expect(html).toContain(`<body class="${body}">`);
    }
  });
  it('sets page classes before scripts execute in the static output', () => {
    const html = stripRuntime('<html lang="en"><body><main data-body-class="page-hub page-partner-view"></main></body></html>').html;
    expect(html).toContain('<html lang="en" class="nav-shown">');
    expect(html).toContain('<body class="page-hub page-partner-view">');
  });
  it('puts theme-orange or theme-teal next to page-case, and nothing for any other theme', () => {
    const site = createSite(snapshotContent());
    const studies = site.content.collections["case-studies"];
    const renderStudy = (slug: string, theme: string | null) => {
      const item = studies.find((study) => study.slug === slug);
      expect(item, slug).toBeDefined();
      const themed = { ...item!, fields: { ...item!.fields, theme } } as typeof item;
      return renderToStaticMarkup(<PageScaffold site={site} item={themed ?? null} pageType="case-study" />);
    };
    expect(renderStudy("data-center-transformation", "orange")).toContain('data-body-class="theme-orange page-case"');
    expect(renderStudy("nexthink-dex-bank", "teal")).toContain('data-body-class="theme-teal page-case"');
    expect(renderStudy("ministry-planning", null)).toContain('data-body-class="page-case"');
    expect(renderStudy("ministry-planning", "")).toContain('data-body-class="page-case"');
    expect(renderStudy("ministry-planning", "blue")).toContain('data-body-class="page-case"');
    for (const html of [
      renderStudy("ministry-planning", null),
      renderStudy("ministry-planning", ""),
      renderStudy("ministry-planning", "blue"),
    ]) {
      expect(html).not.toContain("theme-orange");
      expect(html).not.toContain("theme-teal");
    }
    const themeOf = (slug: string) => studies.find((study) => study.slug === slug)?.fields.theme ?? null;
    expect(themeOf("data-center-transformation")).toBe("orange");
    expect(themeOf("nexthink-dex-bank")).toBe("teal");
    expect(themeOf("ministry-planning")).toBeNull();
    expect(themeOf("national-portal")).toBeNull();
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
});

describe('cookie consent', () => {
  const withContainer = (id: string | null) => {
    const content = snapshotContent();
    return createSite({ ...content, settings: { ...content.settings, analyticsContainerId: id } });
  };

  it('renders no banner, script, stylesheet, or footer control when the container id is empty', () => {
    const site = withContainer(null);
    expect(tagManagerId(site.content.settings)).toBeNull();
    for (const html of [
      renderToStaticMarkup(<PageScaffold site={site} item={null} pageType="error" />),
      renderToStaticMarkup(<Footer site={site} set="home" />),
    ]) {
      expect(html).not.toContain('cookieBanner');
      expect(html).not.toContain('googletagmanager');
      expect(html).not.toContain('data-cookie-settings');
      expect(html).not.toContain('consent.');
    }
  });

  it('takes the container id from the site setting only, never from a build variable', () => {
    const previous = process.env.ANALYTICS_CONTAINER_ID;
    process.env.ANALYTICS_CONTAINER_ID = 'GTM-FROMENV1';
    try {
      expect(tagManagerId(withContainer(null).content.settings)).toBeNull();
      expect(renderToStaticMarkup(<PageScaffold site={withContainer(null)} item={null} pageType="error" />)).not.toContain('cookieBanner');
      expect(tagManagerId(withContainer('GTM-TEST1234').content.settings)).toBe('GTM-TEST1234');
    } finally {
      if (previous === undefined) delete process.env.ANALYTICS_CONTAINER_ID;
      else process.env.ANALYTICS_CONTAINER_ID = previous;
    }
    expect(tagManagerId({ analyticsContainerId: 'GTM-SHORT' })).toBeNull();
    expect(tagManagerId({ analyticsContainerId: ' GTM-TEST1234 ' })).toBe('GTM-TEST1234');
  });

  it('uses English defaults and renders a non-modal banner for a valid container id', () => {
    const site = withContainer('GTM-TEST1234');
    expect(consentCopy(site.content.settings)).toEqual(consentDefaults);
    const html = renderToStaticMarkup(<PageScaffold site={site} item={null} pageType="error" />);
    expect(html).toContain('id="cookieBanner"');
    expect(html).toContain('role="dialog"');
    expect(html).not.toContain('aria-modal');
    expect(html).toContain('Cookies on this site');
    expect(html).toContain('Accept all');
    expect(html).toContain('Reject all');
    expect(html).toContain('Analytics only');
    expect(html).toContain('<a href="#cookie-settings" data-cookie-settings="">Cookie settings</a>');
    expect(html).toContain('data-container="GTM-TEST1234"');
    expect(html).toContain('rel="stylesheet"');
    expect(html).not.toContain('googletagmanager');
  });

  it('pushes the gtm.js start event before it inserts Tag Manager, and events carry only a name', () => {
    const consent = readFileSync(new URL('../behaviors/consent.js', import.meta.url), 'utf8');
    const contact = readFileSync(new URL('../behaviors/contact.js', import.meta.url), 'utf8');
    expect(consent).toContain("window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });");
    expect(consent.indexOf("event: 'gtm.js'")).toBeLessThan(consent.indexOf('googletagmanager.com/gtm.js'));
    for (const source of [contact, consent]) {
      expect(source).not.toContain('innerHTML');
      expect(source).not.toMatch(/dataLayer\.push\(\{[^}]*name/);
    }
    expect(contact).toContain("dataLayer.push({ event: 'contact_form_submitted' })");
    expect(consent).toContain("dataLayer.push({ event: 'cta_clicked' })");
    for (const value of ['v=1&a=0&m=0', 'v=1&a=1&m=0', 'v=1&a=1&m=1']) expect(consent).toContain(`'${value}'`);
    expect(consent).toContain('v=1&a=0&m=1');
    expect(consent).not.toMatch(/\^v=1&a=\(\[01\]\)&m=\(\[01\]\)\$/);
  });
});
