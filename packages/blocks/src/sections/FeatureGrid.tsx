/*
 * feature_grid: the "What we deliver" deck on service pages — a stage of
 * photo scenes beside a menu of offerings, driven by js/service-page.js.
 * Scene colours go by position; each point's icon is part of the design, per
 * service (by its visual) and position, as on the old pages. The first scene
 * and menu item start active.
 */
import type { BlockContext } from "../context";
import type { FeatureGridFields } from "../generated/schema-types";
import { serviceVisual } from "../lookup";

const sceneColours = ["blue", "cyan", "orange", "teal"];

const pointIcons: Record<string, string[][]> = {
  ai: [["ti-compass", "ti-scan", "ti-route"], ["ti-message-chatbot", "ti-language", "ti-shield-check"], ["ti-file-search", "ti-forms", "ti-checkbox"], ["ti-robot", "ti-books", "ti-gavel"]],
  data: [["ti-compass", "ti-map", "ti-list-check"], ["ti-database", "ti-cloud", "ti-chart-dots"], ["ti-git-merge", "ti-layers-linked", "ti-bolt"], ["ti-chart-bar", "ti-world", "ti-settings-automation"]],
  code: [["ti-apps", "ti-device-mobile", "ti-checklist"], ["ti-layout-grid", "ti-users", "ti-bolt"], ["ti-plug-connected", "ti-git-branch", "ti-network"], ["ti-refresh", "ti-shield-check", "ti-cloud"]],
  team: [["ti-database", "ti-layers-linked", "ti-chart-dots"], ["ti-code", "ti-cloud", "ti-plug-connected"], ["ti-brain", "ti-message-chatbot", "ti-robot"], ["ti-test-pipe", "ti-bug", "ti-gauge"]],
};

const pad = (n: number) => String(n).padStart(2, "0");

export function FeatureGrid({ fields, ctx }: { fields: FeatureGridFields; ctx: BlockContext }) {
  const { Image } = ctx;
  const icons = pointIcons[serviceVisual(ctx)] ?? [];
  const items = fields.items;
  const [line1, line2] = (() => {
    const words = fields.heading.trim().split(/\s+/);
    return [words.slice(0, 2).join(" "), words.slice(2).join(" ")];
  })();

  return (
    <section className="eswd-section" id="services" data-section-reveal="">
      <div className="eswd-inner">
        <header className="eswd-head" data-reveal="">
          {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
          <h2 className="eswd-head__title">
            <span className="eswd-head__line1">{line1}</span>
            {line2 ? <span className="eswd-head__line2">{line2}</span> : null}
          </h2>
          {fields.lead ? <p>{fields.lead}</p> : null}
        </header>

        <div className="eswd-deck" id="eswdDeck">
          <div className="eswd-deck__progress" aria-hidden="true">
            <span className="eswd-deck__progress-label">
              <strong id="eswdSceneNum">01</strong>
              <em>/</em>
              <span>{pad(items.length)}</span>
            </span>
            <span className="eswd-deck__progress-track">
              <span className="eswd-deck__progress-bar" id="eswdProgressBar"></span>
            </span>
            <span className="eswd-deck__progress-label" id="eswdSceneName">
              {items[0]?.title ?? ""}
            </span>
          </div>

          <div className="eswd-stage" id="eswdStage" aria-hidden="true">
            <span className="eswd-stage__glow" id="eswdStageGlow"></span>
            {items.map((item, index) => (
              <div key={index} className={`eswd-scene eswd-scene--photo eswd-scene--${sceneColours[index % sceneColours.length]}${index === 0 ? " is-active" : ""}`} data-scene={String(index)}>
                <span className="eswd-scene__label">{item.title}</span>
                <div className="eswd-scene__photo">
                  {item.image ? <Image mediaId={item.image.mediaId} alt={item.image.alt} decorative={item.image.decorative} sizes="(max-width: 900px) 100vw, 50vw" /> : null}
                </div>
              </div>
            ))}
          </div>

          <nav className="eswd-menu" id="eswdMenu" aria-label="Suite navigation">
            {items.map((item, index) => (
              <button key={index} type="button" className={index === 0 ? "eswd-menu__item is-active" : "eswd-menu__item"} data-target={String(index)}>
                <span className="eswd-menu__num">{item.index ?? pad(index + 1)}</span>
                <span className="eswd-menu__title">{item.title}</span>
                <div className="eswd-menu__panel">
                  <div>
                    {item.text ? <p className="eswd-menu__desc">{item.text}</p> : null}
                    {item.points && item.points.length > 0 ? (
                      <ul className="eswd-menu__list">
                        {item.points.map((point, pointIndex) => (
                          <li key={pointIndex}>
                            <i className={`ti ${icons[index]?.[pointIndex] ?? "ti-point"}`} aria-hidden="true"></i>
                            {` ${point}`}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
                <span className="eswd-menu__line"></span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}
