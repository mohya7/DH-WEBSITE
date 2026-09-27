/*
 * service_hero: the split hero on service pages. The copy comes from the
 * section; the "stage" beside it is a decorative mock-up, one per service,
 * chosen by the service's visual field (code, data, ai, team) and carried here
 * as the old pages wrote it.
 *
 * The heading's first two words are plain and the rest, up to the closing full
 * stop, is emphasised, as on every old service page.
 */
import type { ReactNode } from "react";
import type { BlockContext } from "../context";
import type { ServiceHeroFields } from "../generated/schema-types";

const stages: Record<string, ReactNode> = {
  ai: (
      <div className="svc-hero-stage" aria-hidden="true">
        <div className="stage-chrome">
          <span className="stage-dots">
            <i></i>
            <i></i>
            <i></i>
          </span>
          <span className="stage-label">Agent network · active</span>
          <span className="stage-live">
            <i></i>
            live
          </span>
        </div>
        <div className="stage-canvaswrap">
          <div className="stage-panel">
            <div className="stage-chat">
              <div className="stage-chat__agents">
                <span>Triage</span>
                <span>Extract</span>
                <span>Route</span>
                <span>Notify</span>
              </div>
              <div className="stage-chat__thread">
                <div className="stage-chat__bubble stage-chat__bubble--user">Summarize open incidents for standup.</div>
                <div className="stage-chat__bubble stage-chat__bubble--bot">
                  3 P1 tickets — 2 assigned, 1 awaiting vendor. Audit log attached. Escalation path ready if SLA slips.
                </div>
              </div>
              <div className="stage-chat__input">
                {" Ask your agent… "}
                <i className="ti ti-arrow-up"></i>
              </div>
            </div>
          </div>
          <div className="stage-ht"></div>
        </div>
      </div>
  ),
  data: (
      <div className="svc-hero-stage" aria-hidden="true">
        <div className="stage-chrome">
          <span className="stage-dots">
            <i></i>
            <i></i>
            <i></i>
          </span>
          <span className="stage-label">Executive Performance · live</span>
          <span className="stage-live">
            <i></i>
            live
          </span>
        </div>
        <div className="stage-canvaswrap">
          <svg className="stage-chart" viewBox="0 0 480 300" preserveAspectRatio="xMidYMid meet" role="img">
            <defs>
              <linearGradient id="svcBarGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#1A9AD6" stopOpacity="0.25"></stop>
                <stop offset="100%" stopColor="#36B0E5" stopOpacity="0.95"></stop>
              </linearGradient>
              <linearGradient id="svcLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#36B0E5" stopOpacity="0.4"></stop>
                <stop offset="100%" stopColor="#7DD3F5"></stop>
              </linearGradient>
              <filter id="svcLineGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="b"></feGaussianBlur>
                <feMerge>
                  <feMergeNode in="b"></feMergeNode>
                  <feMergeNode in="SourceGraphic"></feMergeNode>
                </feMerge>
              </filter>
            </defs>
            <g className="stage-chart__grid" stroke="rgba(255,255,255,0.06)" strokeWidth="1">
              <line x1="40" y1="40" x2="440" y2="40"></line>
              <line x1="40" y1="90" x2="440" y2="90"></line>
              <line x1="40" y1="140" x2="440" y2="140"></line>
              <line x1="40" y1="190" x2="440" y2="190"></line>
              <line x1="40" y1="240" x2="440" y2="240"></line>
            </g>
            <g className="stage-chart__bars">
              <rect x="56" y="168" width="28" height="72" rx="4" fill="url(#svcBarGrad)"></rect>
              <rect x="104" y="132" width="28" height="108" rx="4" fill="url(#svcBarGrad)"></rect>
              <rect x="152" y="148" width="28" height="92" rx="4" fill="url(#svcBarGrad)"></rect>
              <rect x="200" y="96" width="28" height="144" rx="4" fill="url(#svcBarGrad)"></rect>
              <rect x="248" y="114" width="28" height="126" rx="4" fill="url(#svcBarGrad)"></rect>
              <rect x="296" y="72" width="28" height="168" rx="4" fill="url(#svcBarGrad)"></rect>
              <rect x="344" y="88" width="28" height="152" rx="4" fill="url(#svcBarGrad)"></rect>
              <rect x="392" y="54" width="28" height="186" rx="4" fill="url(#svcBarGrad)"></rect>
            </g>
            <polyline className="stage-chart__line" filter="url(#svcLineGlow)" fill="none" stroke="url(#svcLineGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="70,176 118,140 166,156 214,104 262,122 310,80 358,96 406,62"></polyline>
            <g className="stage-chart__dots" fill="#7DD3F5">
              <circle cx="70" cy="176" r="3.5"></circle>
              <circle cx="118" cy="140" r="3.5"></circle>
              <circle cx="166" cy="156" r="3.5"></circle>
              <circle cx="214" cy="104" r="3.5"></circle>
              <circle cx="262" cy="122" r="3.5"></circle>
              <circle cx="310" cy="80" r="3.5"></circle>
              <circle cx="358" cy="96" r="3.5"></circle>
              <circle cx="406" cy="62" r="3.5"></circle>
            </g>
          </svg>
          <div className="stage-ht"></div>
        </div>
      </div>
  ),
  code: (
      <div className="svc-hero-stage" aria-hidden="true">
        <div className="stage-chrome">
          <span className="stage-dots">
            <i></i>
            <i></i>
            <i></i>
          </span>
          <span className="stage-label">Platform architecture · live</span>
          <span className="stage-live">
            <i></i>
            live
          </span>
        </div>
        <div className="stage-canvaswrap">
          <div className="stage-panel">
            <div className="stage-panel__meta">
              <strong>Enterprise delivery stack</strong>
              <span>Egypt-based</span>
            </div>
            <div className="stage-arch">
              <div className="stage-arch__node">
                <i className="ti ti-layout-dashboard"></i>
                <span>Applications</span>
                <small>Custom portals & workflows</small>
              </div>
              <div className="stage-arch__node">
                <i className="ti ti-plug-connected"></i>
                <span>Integration</span>
                <small>APIs, ERP & legacy bridges</small>
              </div>
              <div className="stage-arch__node">
                <i className="ti ti-cloud"></i>
                <span>Cloud layer</span>
                <small>Azure-ready modernization</small>
              </div>
              <div className="stage-arch__node">
                <i className="ti ti-shield-lock"></i>
                <span>Security</span>
                <small>Identity, audit & controls</small>
              </div>
            </div>
            <div className="stage-arch__flow">
              <span>Discover</span>
              <i className="ti ti-arrow-right"></i>
              <span>Architect</span>
              <i className="ti ti-arrow-right"></i>
              <span>Build</span>
              <i className="ti ti-arrow-right"></i>
              <span>Operate</span>
            </div>
          </div>
          <div className="stage-ht"></div>
        </div>
      </div>
  ),
  team: (
      <div className="svc-hero-stage" aria-hidden="true">
        <div className="stage-chrome">
          <span className="stage-dots">
            <i></i>
            <i></i>
            <i></i>
          </span>
          <span className="stage-label">Delivery team · active</span>
          <span className="stage-live">
            <i></i>
            live
          </span>
        </div>
        <div className="stage-canvaswrap">
          <div className="stage-panel">
            <div className="stage-panel__meta">
              <strong>Embedded contributors</strong>
              <span>Week 1 ready</span>
            </div>
            <div className="stage-talent">
              <div className="stage-talent__row">
                <div className="stage-talent__avatar">
                  <i className="ti ti-database"></i>
                </div>
                <div>
                  <strong>Data Engineer</strong>
                  <span>Fabric · pipelines · lakehouse</span>
                </div>
                <span className="stage-talent__badge">Matched</span>
              </div>
              <div className="stage-talent__row">
                <div className="stage-talent__avatar">
                  <i className="ti ti-code"></i>
                </div>
                <div>
                  <strong>Full-stack Developer</strong>
                  <span>.NET · Azure · APIs</span>
                </div>
                <span className="stage-talent__badge">Matched</span>
              </div>
              <div className="stage-talent__row">
                <div className="stage-talent__avatar">
                  <i className="ti ti-brain"></i>
                </div>
                <div>
                  <strong>AI Specialist</strong>
                  <span>RAG · agents · governance</span>
                </div>
                <span className="stage-talent__badge is-orange">Shortlist</span>
              </div>
              <div className="stage-talent__row">
                <div className="stage-talent__avatar">
                  <i className="ti ti-test-pipe"></i>
                </div>
                <div>
                  <strong>QA Engineer</strong>
                  <span>Automation · API · regression</span>
                </div>
                <span className="stage-talent__badge">Matched</span>
              </div>
            </div>
          </div>
          <div className="stage-ht"></div>
        </div>
      </div>
  ),
};

function heading(text: string): ReactNode {
  const match = /^(\S+\s+\S+)\s+(.+?)([.!?]?)$/.exec(text.trim());
  if (!match) return text;
  return (
    <>
      {`${match[1]} `}
      <em>{match[2]}</em>
      {match[3]}
    </>
  );
}

export function ServiceHero({ fields, ctx }: { fields: ServiceHeroFields; ctx: BlockContext }) {
  const { Link } = ctx;
  const service = ctx.collections.services.find((item) => item.slug === ctx.page.slug);
  const stage = stages[service?.fields.visual ?? ""] ?? null;
  const arrow = fields.action ? /\s*→\s*$/.test(fields.action.label) : false;
  const label = fields.action ? fields.action.label.replace(/\s*→\s*$/, "") : "";
  return (
    <section className="hero hero--service hero--svc-split" id="top">
      <div className="svc-hero-atmos" aria-hidden="true">
        <span className="svc-hero-atmos__beam"></span>
        <span className="svc-hero-atmos__glow"></span>
        <span className="svc-hero-atmos__grain"></span>
      </div>
      <div className="svc-hero-grid">
        <div className="svc-hero-copy">
          {fields.eyebrow ? <p className="svc-eyebrow">{fields.eyebrow}</p> : null}
          <h1 className="svc-display">{heading(fields.heading)}</h1>
          {fields.lead ? <p className="svc-lede">{fields.lead}</p> : null}
          {fields.action ? (
            <div className="svc-cta-row">
              <Link href={fields.action.href} className="btn-svc btn-svc-primary">
                {arrow ? `${label} ` : label}
                {arrow ? (
                  <span className="arr" aria-hidden="true">
                    →
                  </span>
                ) : null}
              </Link>
            </div>
          ) : null}
          {fields.marks && fields.marks.length > 0 ? (
            <ul className="svc-hero-marks">
              {fields.marks.map((mark, index) => (
                <li key={index}>{mark}</li>
              ))}
            </ul>
          ) : null}
        </div>

      {stage}
      </div>
    </section>
  );
}
