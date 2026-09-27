/*
 * news_carousel: news, as the old runtime rendered it from its news collection.
 *   home: section#news — carousel of the first eight, the second one active
 *   news hub: every item as a card with an expandable details panel
 * With no published news the old runtime kept the page's own cards; so does
 * this, from the section's items.
 */
import type { ReactNode } from "react";
import type { BlockContext, ImageAdapterProps } from "../context";
import type { NewsCarouselFields } from "../generated/schema-types";

interface NewsCard {
  key: string;
  slug: string;
  title: string;
  summary: string;
  details: string;
  category: string;
  location: string;
  year: string;
  month: string;
  image: Pick<ImageAdapterProps, "mediaId" | "alt" | "decorative">;
}

function mediaClass(category: string): string {
  const value = category.toLowerCase();
  if (value.includes("event")) return "events";
  if (value.includes("project")) return "projects";
  return "partnership";
}

function cards(fields: NewsCarouselFields, ctx: BlockContext): NewsCard[] {
  const published = ctx.collections.newsItems;
  if (published.length > 0) {
    return published.map((item) => ({
      key: item.id,
      slug: item.slug,
      title: item.title,
      summary: item.fields.summary ?? "",
      details: item.fields.details ?? "",
      category: item.fields.category ?? "",
      location: item.fields.location ?? "",
      year: item.fields.year ?? "",
      month: item.fields.month ?? "",
      image: { mediaId: item.fields.imageId, alt: item.fields.imageAltOverride },
    }));
  }
  return (fields.items ?? []).map((item, index) => ({
    key: String(index),
    slug: String(index + 1),
    title: item.title,
    summary: item.text ?? "",
    details: item.details ?? "",
    category: item.category ?? "",
    location: item.place ?? "",
    year: item.year ?? "",
    month: item.month ?? "",
    image: item.image ?? { mediaId: null },
  }));
}

function CardInner({ card, ctx, toggle }: { card: NewsCard; ctx: BlockContext; toggle?: ReactNode }) {
  const { Image } = ctx;
  return (
    <>
      <div className={`news-slide__media news-slide__media--${mediaClass(card.category)}`}>
        <Image {...card.image} sizes="(max-width: 900px) 100vw, 50vw" />
      </div>
      <div className="news-slide__shade" aria-hidden="true"></div>
      <div className="news-slide__dim" aria-hidden="true"></div>
      <div className="news-slide__body">
        <div className="news-slide__top">
          <span className="news-slide__chip">{card.category || "News"}</span>
        </div>
        <div className="news-slide__bottom">
          <div className="news-slide__blur" aria-hidden="true"></div>
          <div className="news-slide__foot">
            <div className="news-slide__info">
              {card.location ? (
                <div className="news-slide__meta">
                  <i className="ti ti-map-pin"></i>
                  {` ${card.location}`}
                </div>
              ) : null}
              <h3 className="news-slide__title">{card.title}</h3>
              <p className="news-slide__sub">{card.summary}</p>
            </div>
            <div className="news-slide__stat">
              <span className="news-slide__stat-val">{card.year}</span>
              <span className="news-slide__stat-label">{card.month}</span>
              {toggle}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function NewsCarousel({ fields, ctx }: { fields: NewsCarouselFields; ctx: BlockContext }) {
  const { Link } = ctx;
  const items = cards(fields, ctx);

  if (ctx.page.kind === "home") {
    const shown = items.slice(0, 8);
    const active = Math.min(1, shown.length - 1);
    return (
      <section className="section news" id="news" data-section-reveal="">
        <div className="section-inner">
          <div className="section-head row" data-reveal="">
            <div className="head-left">
              {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
              <h2 className="h2">{fields.heading}</h2>
            </div>
            {fields.action ? (
              <Link href={fields.action.href} className="tlink">
                {`${fields.action.label} `}
                <i className="ti ti-arrow-right"></i>
              </Link>
            ) : null}
          </div>

          <div className="news-carousel" id="newsCarousel" data-reveal="">
            <button type="button" className="news-carousel__btn news-carousel__btn--prev" aria-label="Previous news" id="newsPrev">
              <i className="ti ti-arrow-left" aria-hidden="true"></i>
            </button>
            <button type="button" className="news-carousel__btn news-carousel__btn--next" aria-label="Next news" id="newsNext">
              <i className="ti ti-arrow-right" aria-hidden="true"></i>
            </button>

            <div className="news-carousel__viewport" id="newsViewport">
              <div className="news-carousel__track" id="newsTrack">
                {shown.map((card, index) => (
                  <article key={card.key} className={index === active ? "news-slide is-active" : "news-slide"}>
                    <div className="news-slide__link" role="group" aria-label={card.title}>
                      <CardInner card={card} ctx={ctx} />
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="news-carousel__dots" id="newsDots" aria-label="News slides"></div>
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

        <div className="news-hub-grid" data-reveal="">
          {items.map((card) => {
            const panel = `news-panel-news-${card.slug}`;
            return (
              <article key={card.key} className="news-slide is-active news-hub-item">
                <div className="news-slide__surface">
                  <CardInner
                    card={card}
                    ctx={ctx}
                    toggle={
                      <button type="button" className="news-slide__details" aria-expanded="false" aria-controls={panel}>
                        {"Full details "}
                        <i className="ti ti-arrow-down" aria-hidden="true"></i>
                      </button>
                    }
                  />
                </div>
                <div className="news-slide__panel" id={panel} hidden>
                  <p>{card.details || card.summary}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
