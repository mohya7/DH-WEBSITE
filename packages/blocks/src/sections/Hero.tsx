/*
 * hero. Four forms on the old site, by page:
 *   home:        section.hero#top — WebGL canvases, the headline in lines, and
 *                the partner logo bar
 *   about:       section.about-hero — glass banner, two actions, proof list
 *   partner:     section.partner-view-hero — back link, kicker, title, logo
 *   case study:  section.cs-hero — label, title, client, tags, image
 */
import type { BlockContext } from "../context";
import type { HeroFields } from "../generated/schema-types";
import { partnerLogoModifier, sentences } from "../util";

type Props = { fields: HeroFields; ctx: BlockContext };

function HomeHero({ fields, ctx }: Props) {
  const { Image, Link } = ctx;
  const lines = sentences(fields.heading);
  const logos = (fields.logos ?? []).flatMap((logo) => {
    const path = ctx.resolve(logo.reference);
    if (!path) return [];
    const partner = ctx.collections.partners.find((item) => item.id === logo.reference?.id);
    return partner ? [{ logo, path, partner }] : [];
  });
  return (
    <section className="hero" id="top">
      <div className="hero-wires" aria-hidden="true">
        <canvas id="heroSandCanvas"></canvas>
        <canvas id="heroFluidCanvas"></canvas>
      </div>
      {ctx.slots?.hero}

      <div className="hero-inner">
        <div className="hero-left">
          {fields.eyebrow ? (
            <div className="eyebrow">
              <span className="bar" aria-hidden="true"></span>
              <span>{fields.eyebrow}</span>
            </div>
          ) : null}

          <h1 className="h1-wrap" aria-label={lines.join(" ")}>
            {lines.map((line, index) => (
              <span key={index} className="h1-line">
                <span>{line}</span>
              </span>
            ))}
          </h1>

          {fields.lead ? <p className="hero-sub">{fields.lead}</p> : null}
        </div>
      </div>

      {logos.length > 0 ? (
        <div className="trust-bar partner-logos-bar">
          <div className="partner-logos">
            {logos.map(({ logo, path, partner }) => (
              <Link key={partner.id} href={path} className={`plogo plogo--${partnerLogoModifier(partner)}`} attributes={{ "aria-label": partner.title }}>
                <Image mediaId={logo.image.mediaId} alt={logo.image.alt} decorative={logo.image.decorative} className="plogo-img" loading="eager" sizes="165px" />
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AboutHero({ fields, ctx }: Props) {
  const { Link } = ctx;
  const actions = fields.actions ?? [];
  return (
    <section className="hero hero--service about-hero" id="top">
      <div className="hero-inner">
        <div className="about-banner hero-glass" data-reveal="">
          <div className="hero-glass__glow" aria-hidden="true"></div>
          <div className="about-banner__head hero-glass__copy">
            {fields.eyebrow ? <p className="label about-eyebrow">{fields.eyebrow}</p> : null}
            <h1 className="about-display">{fields.heading}</h1>
            {fields.lead ? <p className="lead about-lede">{fields.lead}</p> : null}
            {actions.length > 0 ? (
              <div className="about-hero__cta">
                {actions.map((action, index) => {
                  const arrow = /\s*→\s*$/.test(action.label);
                  const label = action.label.replace(/\s*→\s*$/, "");
                  return (
                    <Link key={index} href={action.href} className={index === 0 ? "btn-svc btn-svc-primary" : "btn-svc btn-svc-ghost"}>
                      {arrow ? `${label} ` : label}
                      {arrow ? (
                        <span className="arr" aria-hidden="true">
                          →
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
          {fields.proof && fields.proof.length > 0 ? (
            <div className="about-banner__body hero-glass__side">
              <ul className="about-proof" aria-label="Digital Hub at a glance">
                {fields.proof.map((entry, index) => (
                  <li key={index}>
                    <strong>{entry.value}</strong>
                    <span>{entry.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/*
 * The Nexthink page's kicker tag is orange on the old site. That is written into
 * its page, not driven by any content field, so it is kept here by slug.
 */
const orangeKickers = new Set(["nexthink"]);

function PartnerHero({ fields, ctx }: Props) {
  const { Image, Link } = ctx;
  return (
    <section className="partner-view-hero" data-section-reveal="">
      <div className="section-inner partner-view-hero__grid">
        <div data-reveal="">
          {fields.back ? (
            <Link href={fields.back.href} className="partner-view-back">
              <i className="ti ti-arrow-left"></i>
              {` ${fields.back.label}`}
            </Link>
          ) : null}
          {fields.kicker ? (
            <div className="partner-view-kicker">
              <span className={orangeKickers.has(ctx.page.slug) ? "partner-view-tag partner-view-tag--orange" : "partner-view-tag"}>{fields.kicker}</span>
            </div>
          ) : null}
          <h1 className="partner-view-title">{fields.heading}</h1>
          {fields.lead ? <p className="partner-view-lead">{fields.lead}</p> : null}
        </div>
        {fields.image ? (
          <div className="partner-view-logo" data-reveal="">
            <Image mediaId={fields.image.mediaId} alt={fields.image.alt} decorative={fields.image.decorative} loading="eager" sizes="165px" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CaseHero({ fields, ctx }: Props) {
  const { Image } = ctx;
  return (
    <section className="section cs-hero">
      <div className="section-inner">
        <div className="cs-hero__content" data-reveal="">
          {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
          <h1 className="cs-hero__title">{fields.heading}</h1>
          {fields.client ? <p className="cs-hero__client">{fields.client}</p> : null}
          {fields.tags && fields.tags.length > 0 ? (
            <div className="cs-meta">
              {fields.tags.map((tag, index) => (
                <span key={index} className="cs-tag">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {fields.image ? (
          <div className="cs-hero__media" data-reveal="">
            <Image mediaId={fields.image.mediaId} alt={fields.image.alt} decorative={fields.image.decorative} loading="eager" fetchPriority="high" sizes="(max-width: 900px) 100vw, 50vw" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function Hero(props: Props) {
  switch (props.ctx.page.kind) {
    case "home":
      return <HomeHero {...props} />;
    case "partner":
      return <PartnerHero {...props} />;
    case "case-study":
      return <CaseHero {...props} />;
    default:
      return <AboutHero {...props} />;
  }
}
