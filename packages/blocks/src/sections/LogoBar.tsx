/*
 * logo_bar: the scrolling client-logo marquee (home and About). The stored list
 * already holds the marquee's repeat as decorative entries, which render hidden
 * from assistive technology, as on the old pages.
 *
 * Some logos carry a size modifier or a nudge on the old pages so they sit
 * evenly in the row. Those are design tweaks per logo, kept here by media id;
 * a logo that is replaced gets the default.
 */
import type { CSSProperties } from "react";
import type { BlockContext } from "../context";
import type { LogoBarFields } from "../generated/schema-types";

const tweaks: Record<string, { modifier?: string; style?: CSSProperties }> = {
  "01c9499d-c537-5782-8dfd-84226eead8e3": { style: { "--logo-nudge": "6px" } as CSSProperties },
  "4bbe3677-defd-55b7-8662-9b121a49c7b6": { modifier: "trust-item--md" },
  "3657d819-9ca4-5799-9af5-d671dceee6dd": { modifier: "trust-item--lg" },
  "2cfe5d96-d1ca-5bcb-bbfd-185231161fa5": { modifier: "trust-item--boost" },
  "815f883d-5a22-5348-8260-6a8336395d0c": { modifier: "trust-item--sm" },
  "6046055e-7784-5011-899a-4bba1deee398": { modifier: "trust-item--lg" },
  "001abfdc-8289-520c-bb24-cfa5d51d873d": { modifier: "trust-item--lg" },
};

export function LogoBar({ fields, ctx }: { fields: LogoBarFields; ctx: BlockContext }) {
  const { Image } = ctx;
  // The home page's bar reveals on scroll; the About page's is labelled instead.
  const sectionAttributes = ctx.page.kind === "home" ? { "data-section-reveal": "" } : { "aria-label": "Clients" };
  return (
    <section className="trust-logos" {...sectionAttributes}>
      {fields.label ? <span className="label">{fields.label}</span> : null}
      <div className="trust-marquee" style={{ "--speed": "100s" } as CSSProperties} aria-label="Client logos">
        <div className="trust-track">
          {(fields.logos ?? []).map((logo, index) => {
            const tweak = tweaks[logo.mediaId] ?? {};
            return (
              <span key={index} className={tweak.modifier ? `trust-item ${tweak.modifier}` : "trust-item"} style={tweak.style} {...(logo.decorative ? { "aria-hidden": "true" as const } : {})}>
                <Image mediaId={logo.mediaId} alt={logo.alt} decorative={logo.decorative} className="trust-item__logo" sizes="184px" />
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
