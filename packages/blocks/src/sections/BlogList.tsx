/*
 * blog_list: the published blog posts, as the old runtime rendered them from
 * its blog collection. Renders nothing when no post is published (4.5).
 *   home: section#blogs — intro and a carousel of the first five
 *   blogs hub: filter bar and every post as a card
 */
import type { BlockContext } from "../context";
import type { BlogListFields } from "../generated/schema-types";
import { slugify } from "../richtext/anchors";
import { publishedBlogPosts, type Published } from "../select";
import { accentSplit } from "../util";

type Post = Published<"blog-posts">;

function Meta({ post, prefix }: { post: Post; prefix: "blog-dest" | "blog-card" }) {
  return (
    <div className={`${prefix}__row`}>
      <span className={`${prefix}__meta`}>
        <strong>{`${post.fields.readTime ?? 1} min`}</strong>
        {" read"}
      </span>
      <span className={`${prefix}__arrow`} aria-hidden="true">
        <i className="ti ti-arrow-up-right"></i>
      </span>
    </div>
  );
}

export function BlogList({ fields, ctx }: { fields: BlogListFields; ctx: BlockContext }) {
  const { Image, Link } = ctx;
  const posts = publishedBlogPosts(ctx);
  if (posts.length === 0) return null;
  const image = (post: Post, className?: string) => (
    <Image mediaId={post.fields.imageId} alt={post.fields.imageAltOverride || post.title} className={className} sizes="(max-width: 900px) 100vw, 405px" />
  );

  if (ctx.page.kind === "home") {
    const { regular, accent } = accentSplit(fields.heading);
    return (
      <section className="section blogs" id="blogs" data-section-reveal="">
        <div className="section-inner blogs-layout">
          <div className="blogs-intro" data-reveal="">
            {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
            <h2 className="blogs-title">
              {regular ? `${regular} ` : null}
              <em>{accent}</em>
            </h2>
            {fields.lead ? <p className="blogs-lead">{fields.lead}</p> : null}
            {fields.action ? (
              <Link href={fields.action.href} className="blogs-cta">
                {`${fields.action.label} `}
                <i className="ti ti-arrow-right"></i>
              </Link>
            ) : null}
          </div>

          <div className="blogs-carousel" id="blogsCarousel" data-reveal="">
            <button type="button" className="blogs-carousel__btn blogs-carousel__btn--prev" aria-label="Previous blog" id="blogsPrev">
              <i className="ti ti-arrow-left" aria-hidden="true"></i>
            </button>
            <button type="button" className="blogs-carousel__btn blogs-carousel__btn--next" aria-label="Next blog" id="blogsNext">
              <i className="ti ti-arrow-right" aria-hidden="true"></i>
            </button>
            <div className="blogs-viewport" id="blogsViewport">
              <div className="blogs-track" id="blogsTrack">
                {posts.slice(0, 5).map((post) => (
                  <Link key={post.id} href={post.path} className="blog-dest" attributes={{ "aria-label": `Read: ${post.title}` }}>
                    {image(post)}
                    <div className="blog-dest__shade" aria-hidden="true"></div>
                    <div className="blog-dest__body">
                      <h3 className="blog-dest__title">{post.title}</h3>
                      <Meta post={post} prefix="blog-dest" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="section hub-section hub-section--tight">
      <div className="section-inner">
        <div className="hub-head" data-reveal="">
          <div>
            {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
            <h2>{fields.heading}</h2>
            {fields.lead ? <p>{fields.lead}</p> : null}
          </div>
        </div>

        {fields.filters && fields.filters.length > 0 ? (
          <div className="hub-filters" data-reveal="" role="tablist" aria-label="Filter by topic">
            {fields.filters.map((label, index) => (
              <button key={index} type="button" className={index === 0 ? "hub-filter is-active" : "hub-filter"} data-filter={index === 0 ? "all" : slugify(label)} role="tab" aria-selected={index === 0 ? "true" : "false"}>
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="blogs-hub-grid">
          {posts.map((post) => (
            <Link key={post.id} href={post.path} className="blog-card" attributes={{ "data-category": post.fields.category ?? "", "data-reveal": "", "aria-label": `Read: ${post.title}` }}>
              {image(post)}
              <div className="blog-card__shade" aria-hidden="true"></div>
              <div className="blog-card__body">
                <span className={post.fields.accent === "orange" ? "blog-card__tag blog-card__tag--orange" : "blog-card__tag"}>{post.fields.categoryLabel || post.fields.category}</span>
                <h3 className="blog-card__title">{post.title}</h3>
                <Meta post={post} prefix="blog-card" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
