/*
 * The partner card on the partners hub and in "More partners" on partner pages:
 * logo, name, summary, action. Links to the partner's page.
 */
import type { BlockContext, BlockItem, ImageAdapterProps } from "../context";

export function PartnerHubCard({ partner, path, image, title, text, action, ctx }: {
  partner: BlockItem<"partners">;
  path: string;
  image: Pick<ImageAdapterProps, "mediaId" | "alt" | "decorative">;
  title?: string;
  text?: string;
  action?: string;
  ctx: BlockContext;
}) {
  const { Image, Link } = ctx;
  const name = title?.trim() || partner.title;
  return (
    <Link href={path} className="partner-card-hub" attributes={{ "data-reveal": "", "aria-label": `Explore ${name} partnership` }}>
      <div className="partner-card-hub__logo">
        <Image {...image} sizes="165px" />
      </div>
      <h3 className="partner-card-hub__title">{name}</h3>
      <p className="partner-card-hub__desc">{text?.trim() || partner.fields.summary || ""}</p>
      <span className="partner-card-hub__link">
        {`${action?.trim() || "Explore partnership"} `}
        <i className="ti ti-arrow-right"></i>
      </span>
    </Link>
  );
}
