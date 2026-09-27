/* profile: the CEO message on the About page. */
import type { BlockContext } from "../context";
import type { ProfileFields } from "../generated/schema-types";

export function Profile({ fields, ctx }: { fields: ProfileFields; ctx: BlockContext }) {
  const { Image } = ctx;
  return (
    <section className="section about-ceo" id="ceo">
      <div className="section-inner about-ceo__grid">
        <div className="about-ceo__photo" data-reveal="">
          <div className="about-ceo__photo-inner">
            {fields.image ? <Image mediaId={fields.image.mediaId} alt={fields.image.alt} decorative={fields.image.decorative} sizes="320px" /> : null}
          </div>
          <div className="about-ceo__photo-meta">
            <strong>{fields.name}</strong>
            {fields.role ? <span>{fields.role}</span> : null}
          </div>
        </div>
        <blockquote className="about-ceo__quote" data-reveal="">
          <p>{fields.quote}</p>
          {fields.cite ? <cite>{fields.cite}</cite> : null}
        </blockquote>
      </div>
    </section>
  );
}
