/*
 * team_grid: the leadership strip on the About page. The members come from the
 * published team, as the old runtime rendered them from its team collection;
 * the section supplies the heading. LinkedIn links open in a new tab; without a
 * profile the action is an inert "#" link, as before.
 */
import type { BlockContext } from "../context";
import type { TeamGridFields } from "../generated/schema-types";

export function TeamGrid({ fields, ctx }: { fields: TeamGridFields; ctx: BlockContext }) {
  const { Image, Link } = ctx;
  const members = ctx.collections.teamMembers;
  return (
    <section className="section about-leaders" id="leadership">
      <div className="section-inner">
        <header className="about-head" data-reveal="">
          {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
          <h2>{fields.heading}</h2>
          {fields.lead ? <p>{fields.lead}</p> : null}
        </header>

        <div className="team-strip" id="teamStrip" data-reveal="" aria-label="Management team">
          <div className="team-strip__frame">
            <button type="button" className="team-strip__btn team-strip__btn--prev" id="teamStripPrev" aria-label="Previous team member">
              <i className="ti ti-chevron-left" aria-hidden="true"></i>
            </button>
            <button type="button" className="team-strip__btn team-strip__btn--next" id="teamStripNext" aria-label="Next team member">
              <i className="ti ti-chevron-right" aria-hidden="true"></i>
            </button>
            <div className="team-strip__viewport" id="teamStripViewport" tabIndex={0}>
              <div className="team-strip__inner" id="teamStripInner">
                {members.map((member) => {
                  const role = member.fields.role ?? "";
                  const profile = (member.fields.linkedIn ?? "").trim();
                  const external = /^https?:\/\//i.test(profile);
                  return (
                    <div key={member.id} className="team-strip__item">
                      <div className="team-card">
                        <div className="team-card__photo">
                          <Image mediaId={member.fields.imageId} alt={member.fields.imageAltOverride || (role ? `${member.title}, ${role}` : member.title)} sizes="320px" />
                          <div className="team-card__overlay">
                            <div className="team-card__meta">
                              <p className="team-card__role">{role}</p>
                              <h3 className="team-card__name">{member.title}</h3>
                            </div>
                            <div className="team-card__actions">
                              <Link
                                href={external ? profile : "#"}
                                className="team-card__action team-card__action--linkedin"
                                attributes={{ ...(external ? { target: "_blank", rel: "noopener" } : {}), "aria-label": `${member.title} on LinkedIn` }}
                              >
                                <i className="ti ti-brand-linkedin" aria-hidden="true"></i>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="team-strip__progress" aria-hidden="true">
            <span className="team-strip__progress-bar" id="teamStripProgress"></span>
          </div>
        </div>
      </div>
    </section>
  );
}
