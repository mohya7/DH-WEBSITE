import { RichText, parseRichText, headingAnchors, type BlockContext } from "@digitalhub/blocks";
import { Faq } from "@digitalhub/blocks/sections/Faq";
import { findItem } from "@digitalhub/blocks/lookup";
import type { ContentItem } from "@/content/build-content";

// Labels from scripts/blog-pages.js on feature/interviewer-portal. Resolution
// still uses the stored {type,id}; no URL is invented when a target is unpublished.
const pillarLabels: Record<string, string> = {
  "DEX & Digital Employee Experience": "Nexthink Digital Employee Experience",
  "Enterprise Software": "Enterprise Software Solutions",
  "Data, Cloud & Digital Egypt 2030": "Data & Analytics Solutions",
  "AI & Automation": "AI & Intelligent Automation Solutions",
  "Technical Talent & Outsourcing": "Outsourcing Technical Talents",
};

function displayDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.valueOf()) ? null : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Cairo" });
}
export function BlogArticle({ item, ctx }: { item: ContentItem<"blog-posts">; ctx: BlockContext }) {
  const f = item.fields;
  const doc = parseRichText(f.body);
  const toc = headingAnchors(doc).filter((heading) => heading.level === 2);
  const cluster = f.cluster || f.categoryLabel || "Insights";
  const related = (doc?.relatedItems ?? []).flatMap((ref) => {
    const path = ctx.resolve(ref);
    const target = findItem(ctx, ref);
    return path && target && target.id !== item.id ? [{ ref, path, target }] : [];
  });
  const cards = related.filter(({ ref }) => ref.type === "blog_post").slice(0, 3);
  const pillars = related.filter(({ ref }) => ref.type !== "blog_post");
  let faq: { items: { question: string; answer: string }[] } = { items: [] };
  try { const parsed = JSON.parse(f.faq ?? "null"); if (Array.isArray(parsed?.items)) faq = parsed; } catch { /* An absent FAQ renders nothing. */ }
  const byline = [displayDate(item.publishedAt) && `Published ${displayDate(item.publishedAt)}`, displayDate(f.dateModified) && `Updated ${displayDate(f.dateModified)}`, f.readTime ? `${f.readTime} min read` : null].filter(Boolean).join(" · ");
  return <>
    <section className="blog-view-hero"><div className="section-inner blog-view-hero__grid">
      <div data-reveal=""><nav className="blog-view-crumb" aria-label="Breadcrumb"><a href="/blogs">Blogs</a><span aria-hidden="true">›</span><span>{cluster}</span></nav>
        <div className="blog-view-kicker"><span className={`blog-view-tag${f.accent === "orange" ? " blog-view-tag--orange" : ""}`}>{cluster}</span></div>
        <h1 className="blog-view-title">{item.title}</h1><p className="blog-view-byline">{byline}</p>
      </div><div className="blog-view-media" data-reveal=""><ctx.Image mediaId={f.imageId} alt={f.imageAltOverride ?? item.title} loading="eager" fetchPriority="high" /></div>
    </div></section>
    <section className="blog-view-body"><div className="section-inner"><article className="blog-view-article" data-reveal="">
      {f.answerBlock ? <p className="blog-view-answer">{f.answerBlock}</p> : null}
      {toc.length ? <nav className="blog-view-toc" aria-label="Table of contents"><p className="blog-view-toc__label">Contents</p><ol>{toc.map((heading) => <li key={heading.id}><a href={`#${heading.id}`}>{heading.text}</a></li>)}</ol></nav> : null}
      <RichText doc={doc} ctx={ctx} compactParagraphs />
      <Faq fields={faq} ctx={ctx} />
    </article></div></section>
    {related.length ? <section className="blog-view-related"><div className="section-inner"><div className="blog-view-related__head"><span className="label">Keep reading</span><h2>{`Related in ${f.cluster || "this topic"}`}</h2></div>
      <div className="blog-view-related__grid">{cards.map(({ target, path }) => <a className="blog-view-related__card" href={path} key={target.id}><span className="blog-view-related__tag">{("cluster" in target.fields && target.fields.cluster) || ("categoryLabel" in target.fields && target.fields.categoryLabel) || "Insight"}</span><strong>{target.title}</strong></a>)}</div>
      {pillars.map(({ target, path }) => <a className="blog-view-pillar" key={target.id} href={path}>{`Explore ${pillarLabels[f.cluster ?? ""] ?? target.title} `}<i className="ti ti-arrow-right" aria-hidden="true" /></a>)}
    </div></section> : null}
  </>;
}
