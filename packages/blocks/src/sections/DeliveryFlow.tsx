/*
 * delivery_flow: the "How we deliver" diagram on the home page — inputs on the
 * left, the Digital Hub stack in the middle, outputs on the right, joined by
 * animated connectors. The connector layer and every slot's position are the
 * design, fixed for four inputs, three centre nodes, and four outputs, as on the
 * old page; the labels come from the section. Pill icons go by position.
 */
import type { CSSProperties } from "react";
import type { BlockContext } from "../context";
import type { DeliveryFlowFields } from "../generated/schema-types";

const idx = (value: number) => ({ "--idx": String(value) }) as CSSProperties;
const rows = ["60", "160", "320", "420"];
const inputIcons = ["ti-target", "ti-code", "ti-database", "ti-users"];
const outputIcons = ["ti-apps", "ti-chart-line", "ti-robot", "ti-plug-connected"];

function Pill({ side, index, icon, label }: { side: "left" | "right"; index: number; icon: string; label: string }) {
  return (
    <div className={`delivery-pill-slot is-${side}`} data-y={rows[index]} style={idx(side === "left" ? index : index + 4)}>
      <div className="delivery-pill">
        <span className="delivery-pill-ico">
          <i className={`ti ${icon}`}></i>
        </span>
        {label}
      </div>
    </div>
  );
}

export function DeliveryFlow({ fields }: { fields: DeliveryFlowFields; ctx: BlockContext }) {
  const inputs = (fields.inputs ?? []).slice(0, 4);
  const outputs = (fields.outputs ?? []).slice(0, 4);
  const [brandLeft, stack, brandRight] = fields.hub ?? [];
  return (
    <section className="section delivery-flow" id="delivery" data-section-reveal="">
      <div className="section-inner">
        <header className="delivery-head section-head" data-reveal="">
          {fields.eyebrow ? <span className="label">{fields.eyebrow}</span> : null}
          <h2 className="h2">{fields.heading}</h2>
          {fields.lead ? <p className="lead">{fields.lead}</p> : null}
        </header>

        <div className="delivery-stage" data-reveal="">
      <svg className="delivery-svg" viewBox="0 0 1200 480" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="delivery-line-grad" gradientUnits="userSpaceOnUse" x1="0" y1="240" x2="1200" y2="240">
            <stop offset="0%" stopColor="#7ad3f4" stopOpacity="0.85"></stop>
            <stop offset="50%" stopColor="#36B0E5" stopOpacity="0.55"></stop>
            <stop offset="100%" stopColor="#7ad3f4" stopOpacity="0.85"></stop>
          </linearGradient>
          <linearGradient id="delivery-line-mid" gradientUnits="userSpaceOnUse" x1="370" y1="240" x2="830" y2="240">
            <stop offset="0%" stopColor="#7ad3f4" stopOpacity="0.9"></stop>
            <stop offset="50%" stopColor="#36B0E5" stopOpacity="0.65"></stop>
            <stop offset="100%" stopColor="#7ad3f4" stopOpacity="0.9"></stop>
          </linearGradient>
          <radialGradient id="delivery-hub-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#36B0E5" stopOpacity="0.30"></stop>
            <stop offset="60%" stopColor="#1A9AD6" stopOpacity="0.08"></stop>
            <stop offset="100%" stopColor="#1A9AD6" stopOpacity="0"></stop>
          </radialGradient>
          <filter id="delivery-pulse-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="2.4" result="blur"></feGaussianBlur>
            <feMerge>
              <feMergeNode in="blur"></feMergeNode>
              <feMergeNode in="SourceGraphic"></feMergeNode>
            </feMerge>
          </filter>
        </defs>
        <ellipse className="delivery-glow" cx="600" cy="240" rx="380" ry="200" fill="url(#delivery-hub-glow)"></ellipse>
        <path id="dp1" className="delivery-path" style={idx(0)} d="M 216,60  C 310,60  340,180 370,210"></path>
        <path id="dp2" className="delivery-path" style={idx(1)} d="M 216,160 C 310,160 340,220 370,230"></path>
        <path id="dp3" className="delivery-path" style={idx(2)} d="M 216,320 C 310,320 340,260 370,250"></path>
        <path id="dp4" className="delivery-path" style={idx(3)} d="M 216,420 C 310,420 340,300 370,270"></path>
        <path id="dp5" className="delivery-path" style={idx(4)} d="M 830,210 C 860,180 890,60  984,60"></path>
        <path id="dp6" className="delivery-path" style={idx(5)} d="M 830,230 C 860,220 890,160 984,160"></path>
        <path id="dp7" className="delivery-path" style={idx(6)} d="M 830,250 C 860,260 890,320 984,320"></path>
        <path id="dp8" className="delivery-path" style={idx(7)} d="M 830,270 C 860,300 890,420 984,420"></path>
        <path id="dpm1" className="delivery-path delivery-path--mid" style={idx(3)} d="M 494,240 L 524,240"></path>
        <path id="dpm2" className="delivery-path delivery-path--mid" style={idx(3)} d="M 676,240 L 706,240"></path>
        <g className="delivery-anchors" aria-hidden="true">
          <circle className="delivery-anchor" cx="216" cy="60" r="3.4"></circle>
          <circle className="delivery-anchor" cx="216" cy="160" r="3.4"></circle>
          <circle className="delivery-anchor" cx="216" cy="320" r="3.4"></circle>
          <circle className="delivery-anchor" cx="216" cy="420" r="3.4"></circle>
          <circle className="delivery-anchor" cx="984" cy="60" r="3.4"></circle>
          <circle className="delivery-anchor" cx="984" cy="160" r="3.4"></circle>
          <circle className="delivery-anchor" cx="984" cy="320" r="3.4"></circle>
          <circle className="delivery-anchor" cx="984" cy="420" r="3.4"></circle>
          <circle className="delivery-anchor delivery-anchor--node" cx="370" cy="210" r="2.6"></circle>
          <circle className="delivery-anchor delivery-anchor--node" cx="370" cy="230" r="2.6"></circle>
          <circle className="delivery-anchor delivery-anchor--node" cx="370" cy="250" r="2.6"></circle>
          <circle className="delivery-anchor delivery-anchor--node" cx="370" cy="270" r="2.6"></circle>
          <circle className="delivery-anchor delivery-anchor--node" cx="830" cy="210" r="2.6"></circle>
          <circle className="delivery-anchor delivery-anchor--node" cx="830" cy="230" r="2.6"></circle>
          <circle className="delivery-anchor delivery-anchor--node" cx="830" cy="250" r="2.6"></circle>
          <circle className="delivery-anchor delivery-anchor--node" cx="830" cy="270" r="2.6"></circle>
        </g>
        <g className="delivery-pulses">
          <circle className="delivery-pulse" r="3.2" opacity="0">
            <animateMotion dur="4s" begin="0.20s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1" keyTimes="0;1">
              <mpath xlinkHref="#dp1"></mpath>
            </animateMotion>
            <animate attributeName="opacity" dur="4s" begin="0.20s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.12;0.88;1"></animate>
          </circle>
          <circle className="delivery-pulse" r="3.2" opacity="0">
            <animateMotion dur="4s" begin="0.95s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1" keyTimes="0;1">
              <mpath xlinkHref="#dp2"></mpath>
            </animateMotion>
            <animate attributeName="opacity" dur="4s" begin="0.95s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.12;0.88;1"></animate>
          </circle>
          <circle className="delivery-pulse" r="3.2" opacity="0">
            <animateMotion dur="4s" begin="1.70s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1" keyTimes="0;1">
              <mpath xlinkHref="#dp3"></mpath>
            </animateMotion>
            <animate attributeName="opacity" dur="4s" begin="1.70s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.12;0.88;1"></animate>
          </circle>
          <circle className="delivery-pulse" r="3.2" opacity="0">
            <animateMotion dur="4s" begin="2.45s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1" keyTimes="0;1">
              <mpath xlinkHref="#dp4"></mpath>
            </animateMotion>
            <animate attributeName="opacity" dur="4s" begin="2.45s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.12;0.88;1"></animate>
          </circle>
          <circle className="delivery-pulse" r="3.2" opacity="0">
            <animateMotion dur="4s" begin="0.55s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1" keyTimes="0;1">
              <mpath xlinkHref="#dp5"></mpath>
            </animateMotion>
            <animate attributeName="opacity" dur="4s" begin="0.55s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.12;0.88;1"></animate>
          </circle>
          <circle className="delivery-pulse" r="3.2" opacity="0">
            <animateMotion dur="4s" begin="1.30s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1" keyTimes="0;1">
              <mpath xlinkHref="#dp6"></mpath>
            </animateMotion>
            <animate attributeName="opacity" dur="4s" begin="1.30s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.12;0.88;1"></animate>
          </circle>
          <circle className="delivery-pulse" r="3.2" opacity="0">
            <animateMotion dur="4s" begin="2.05s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1" keyTimes="0;1">
              <mpath xlinkHref="#dp7"></mpath>
            </animateMotion>
            <animate attributeName="opacity" dur="4s" begin="2.05s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.12;0.88;1"></animate>
          </circle>
          <circle className="delivery-pulse" r="3.2" opacity="0">
            <animateMotion dur="4s" begin="2.80s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1" keyTimes="0;1">
              <mpath xlinkHref="#dp8"></mpath>
            </animateMotion>
            <animate attributeName="opacity" dur="4s" begin="2.80s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.12;0.88;1"></animate>
          </circle>
          <circle className="delivery-pulse" r="2.6" opacity="0">
            <animateMotion dur="1.6s" begin="1.0s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1" keyTimes="0;1">
              <mpath xlinkHref="#dpm1"></mpath>
            </animateMotion>
            <animate attributeName="opacity" dur="1.6s" begin="1.0s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.18;0.82;1"></animate>
          </circle>
          <circle className="delivery-pulse" r="2.6" opacity="0">
            <animateMotion dur="1.6s" begin="1.8s" repeatCount="indefinite" calcMode="linear" keyPoints="0;1" keyTimes="0;1">
              <mpath xlinkHref="#dpm2"></mpath>
            </animateMotion>
            <animate attributeName="opacity" dur="1.6s" begin="1.8s" repeatCount="indefinite" values="0;1;1;0" keyTimes="0;0.18;0.82;1"></animate>
          </circle>
        </g>
      </svg>

          <div className="delivery-pills-left">
            {inputs.map((label, index) => (
              <Pill key={index} side="left" index={index} icon={inputIcons[index]} label={label} />
            ))}
          </div>

          <div className="delivery-nodes">
            <div className="delivery-node-slot is-brand-left" style={idx(4)}>
              <div className="delivery-node">
                <span className="delivery-node__icon">
                  <i className="ti ti-cube"></i>
                </span>
                <span className="delivery-node__label">{brandLeft ?? ""}</span>
              </div>
            </div>
            <div className="delivery-node-slot is-stack" style={idx(5)}>
              <div className="delivery-node">
                <span className="delivery-node__chips">
                  <span className="delivery-node__chip">
                    <i className="ti ti-cloud"></i>
                  </span>
                  <span className="delivery-node__chip">
                    <i className="ti ti-brain"></i>
                  </span>
                  <span className="delivery-node__chip">
                    <i className="ti ti-stack-2"></i>
                  </span>
                </span>
                <span className="delivery-node__label">{stack ?? ""}</span>
              </div>
            </div>
            <div className="delivery-node-slot is-brand-right" style={idx(6)}>
              <div className="delivery-node">
                <span className="delivery-node__icon">
                  <i className="ti ti-cube"></i>
                </span>
                <span className="delivery-node__label">{brandRight ?? ""}</span>
              </div>
            </div>
          </div>

          <div className="delivery-pills-right">
            {outputs.map((label, index) => (
              <Pill key={index} side="right" index={index} icon={outputIcons[index]} label={label} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
