/*
 * values: the careers page's breadcrumb, badge, photos, and value cards. The
 * four-column arrangement and each photo's colour and crop modifier are the
 * design, by position, as on the old page.
 */
import { Fragment } from "react";
import type { BlockContext } from "../context";
import type { ValuesFields } from "../generated/schema-types";

const photoLooks = [
  "careers-values__photo--blue careers-values__photo--laila",
  "careers-values__photo--blue careers-values__photo--endi",
  "careers-values__photo--orange careers-values__photo--ali",
  "careers-values__photo--orange careers-values__photo--youssef",
];

export function Values({ fields, ctx }: { fields: ValuesFields; ctx: BlockContext }) {
  const { Image, Link } = ctx;
  const photo = (index: number) => {
    const media = fields.photos?.[index];
    if (!media) return null;
    return (
      <div className={`careers-values__photo ${photoLooks[index]}`}>
        <Image mediaId={media.mediaId} alt={media.alt} decorative={media.decorative} sizes="400px" />
      </div>
    );
  };
  const card = (index: number) => {
    const item = fields.items?.[index];
    if (!item) return null;
    return (
      <article className="careers-values__card">
        <h3>{item.title}</h3>
        <p>{item.text}</p>
      </article>
    );
  };
  const crumbs = fields.breadcrumb ?? [];

  return (
    <section className="section careers-values hub-section--tight">
      <div className="section-inner">
        {crumbs.length > 0 ? (
          <nav className="careers-crumb" aria-label="Breadcrumb" data-reveal="">
            {crumbs.map((crumb, index) =>
              index === crumbs.length - 1 ? (
                <span key={index} className="careers-crumb__current">
                  {crumb}
                </span>
              ) : (
                <Fragment key={index}>
                  <Link href="/">
                    <i className="ti ti-home" aria-hidden="true"></i>
                    {` ${crumb}`}
                  </Link>
                  <span className="careers-crumb__sep" aria-hidden="true">
                    /
                  </span>
                </Fragment>
              ),
            )}
          </nav>
        ) : null}
        <div className="careers-values__grid" data-reveal="">
          <div className="careers-values__col careers-values__col--1">
            {fields.badge && fields.badge.length > 0 ? (
              <div className="careers-values__badge" aria-hidden="true">
                {fields.badge.map((word, index) => (
                  <span key={index}>{word}</span>
                ))}
              </div>
            ) : null}
            {photo(0)}
          </div>
          <div className="careers-values__col careers-values__col--2">
            {photo(1)}
            {card(0)}
          </div>
          <div className="careers-values__col careers-values__col--3">
            {card(1)}
            {photo(2)}
          </div>
          <div className="careers-values__col careers-values__col--4">
            {photo(3)}
            {card(2)}
          </div>
        </div>
      </div>
    </section>
  );
}
