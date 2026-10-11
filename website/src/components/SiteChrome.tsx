import type { NavigationNode, SiteSettings } from "@/content/build-content";
import type { Site } from "@/content/site";
import { DesignScripts } from "@/design/Design";
import type { DesignSetName } from "@/design/sets";

const icons: Record<string, string> = {
  "/services/enterprise-software": "code", "/services/data-analytics": "chart-bar",
  "/services/ai-automation": "brain", "/services/outsourcing": "users",
  "/partners/microsoft": "brand-windows", "/partners/huawei": "cloud",
  "/partners/nexthink": "device-desktop-analytics", "/partners/efinance": "credit-card",
  "/partners/vodafone": "antenna-bars-5",
};
export function navigationHref(node: NavigationNode): string | undefined {
  const href = node.kind === "internal" ? node.path : node.url;
  return href && (/^\/(?!\/)/.test(href) || /^(https?:|mailto:|tel:)/i.test(href)) ? href : undefined;
}
function visible(nodes: NavigationNode[]): NavigationNode[] {
  return nodes.filter((node) => node.kind === "group" ? visible(node.children).length > 0 : navigationHref(node))
    .slice().sort((a, b) => a.sortOrder - b.sortOrder);
}
export function Header({ site, set, currentPath }: { site: Site; set: DesignSetName; currentPath: string }) {
  const home = set === "home";
  const nodes = visible(site.content.navigation.filter((node) => node.menu === "header"));
  const contactPath = site.content.pages.find((page) => page.slug === "contact")?.path;
  const cta = contactPath ? nodes.find((node) => navigationHref(node) === contactPath) : undefined;
  const links = nodes.filter((node) => node !== cta);
  const active = (href?: string) => !!href && (currentPath === href || currentPath.startsWith(href + "/"));
  const partnersGroup = (node: NavigationNode) => node.children.some((child) => child.path?.startsWith('/partners/'));
  const groupActive = (node: NavigationNode) => partnersGroup(node) ? currentPath === '/partners' : node.children.some((child) => active(navigationHref(child)));
  const inner = <div className="nav-inner glass-surface">
    <a href="/" className="brand" aria-label="Digital Hub home">{home ? null : <Logo className="brand-logo" />}</a>
    <ul className="nav-links" role="menubar">{links.map((node) => node.kind === "group" ?
      <li key={node.id} className="has-dd" role="none">
        <a className={`nav-link${groupActive(node) ? " is-active" : ""}`} aria-current={partnersGroup(node) && currentPath === '/partners' ? 'page' : undefined} role="menuitem" tabIndex={0}>{node.label} <i className="ti ti-chevron-down" /></a>
        <div className="dd" role="menu">{visible(node.children).map((child) => <a key={child.id} href={navigationHref(child)} className={active(navigationHref(child)) ? "is-active" : undefined} aria-current={set !== 'service' && active(navigationHref(child)) ? "page" : undefined}><i className={`ti ti-${icons[navigationHref(child)!] ?? "arrow-right"}`} />{` ${child.label}`}</a>)}</div>
      </li> : <li key={node.id}><a className={`nav-link${active(navigationHref(node)) ? " is-active" : ""}`} href={navigationHref(node)} aria-current={currentPath === navigationHref(node) || ['blog-post', 'apply'].includes(set) && active(navigationHref(node)) ? "page" : undefined}>{node.label}</a></li>)}</ul>
    {cta ? <a className="nav-cta" href={navigationHref(cta)} aria-current={currentPath === navigationHref(cta) ? 'page' : undefined}>{cta.label} <i className="ti ti-arrow-right" /></a> : null}
    <button className="nav-burger" id="navBurger" aria-label="Open menu" aria-expanded="false"><i className="ti ti-menu-2" /></button>
  </div>;
  return <>
    {home ? <div className="nav-intro" id="navIntro" aria-hidden="true"><div className="nav-intro-brand"><Logo className="nav-intro-logo" alt="" /></div></div> : null}
    <nav className="nav" id="nav" aria-label="Primary">{home ? <div className="nav-wipe"><div className="nav-wipe-cover" aria-hidden="true" />{inner}</div> : inner}</nav>
    <DesignScripts set={set} slot="after-nav" />
    <div className="mobile-nav" id="mobileNav" aria-hidden="true">{links.map((node) => node.kind === "group" ? <details key={node.id} open={node.children.some((child) => active(navigationHref(child))) || partnersGroup(node) && currentPath === '/partners'}>
      <summary>{node.label} <i className="ti ti-chevron-down" /></summary><div className="sub">
        {partnersGroup(node) && site.routeFor(["partners"]) ? <a href="/partners" className={currentPath === '/partners' ? 'is-active' : undefined}>All partners</a> : null}
        {visible(node.children).map((child) => <a key={child.id} href={navigationHref(child)} className={partnersGroup(node) && active(navigationHref(child)) ? 'is-active' : undefined}>{child.label}</a>)}
      </div></details> : <a key={node.id} href={navigationHref(node)}>{node.label}</a>)}
      {cta ? <a className="mn-cta" href={navigationHref(cta)}>Get in Touch</a> : null}
    </div>
  </>;
}
function Logo({ className, alt = "Digital Hub", lazy = false }: { className: string; alt?: string; lazy?: boolean }) {
  return <img className={className} src="/assets/digital-hub-logo.png" alt={alt} decoding="async" width={180} height={48} loading={lazy ? "lazy" : "eager"} />;
}
/** The careers email on the careers, apply, and vacancy pages; the main email everywhere else. */
export function footerEmail(settings: SiteSettings, set: DesignSetName): string | null {
  return ["careers", "apply", "vacancy"].includes(set) ? settings.careersEmail || settings.email : settings.email;
}
/** The copyright year is the year of the build, so it never goes stale. */
export function copyrightYear(now: Date = new Date()): number {
  return now.getUTCFullYear();
}
export function Footer({ site, set }: { site: Site; set: DesignSetName }) {
  const home = set === "home";
  const styledContact = ["home", "about", "service", "case-study"].includes(set);
  const settings = site.content.settings;
  const email = footerEmail(settings, set);
  const groups = visible(site.content.navigation.filter((node) => node.menu === "footer"));
  // Contact links in the imported menu are historical copies. Settings own them.
  const contact = groups.find((node) => node.children.some((child) => child.path === '/' || /^(mailto:|tel:)/.test(child.url ?? "")));
  const socials: [keyof SiteSettings, string, string][] = [["linkedIn", "LinkedIn", "linkedin"], ["facebook", "Facebook", "facebook"], ["instagram", "Instagram", "instagram"], ["tikTok", "TikTok", "tiktok"]];
  return <footer className="footer"><div className="footer-inner"><div className="footer-top">
    <div className={home ? "footer-logo-wrap" : undefined}><Logo className="footer-logo" lazy />{home || set === "case-study" ? null : <p className="footer-tagline">Empowering Digital Evolution</p>}</div>
    <div className="footer-cols">{groups.filter((node) => node !== contact).map((node) => <div className="footer-col" key={node.id}><h4>{node.label}</h4>{node.kind === "group" ? visible(node.children).map((child) => <a key={child.id} href={navigationHref(child)}>{child.label}</a>) : <a href={navigationHref(node)}>{node.label}</a>}</div>)}</div>
    <div className="footer-contact"><h4 style={styledContact ? { fontSize: "11px", fontWeight: 600, color: `rgba(255,255,255,${home || set === "case-study" ? "0.6" : "0.55"})`, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 14px" } : undefined}>{contact?.label ?? "Contact"}</h4>
      {email ? <a href={`mailto:${email}`}>{email}</a> : null}
      {settings.phone ? <a href={`tel:${settings.phone.replace(/[^+\d]/g, "")}`}>{settings.phone}</a> : null}
      {contact && (home || set === "contact") ? visible(contact.children).filter((node) => !/^(mailto:|tel:)/.test(navigationHref(node) ?? "")).map((node) => <a key={node.id} href={navigationHref(node)} target="_blank" rel="noopener">{node.label}</a>) : null}
      {home && socials.some(([key]) => settings[key]) ? <div className="footer-social">{socials.map(([key, label, icon]) => settings[key] && /^https?:\/\//.test(settings[key]!) ? <a key={key} href={settings[key]!} target="_blank" rel="noopener" aria-label={label}><i className={`ti ti-brand-${icon}`} /></a> : null)}</div> : null}
    </div></div><div className="footer-bottom"><span>{`© ${copyrightYear()} Digital Hub S.A.E. All rights reserved.`}</span>{set !== "contact" ? <span>Microsoft Partner · Nexthink Authorized Reseller · Huawei · eFinance · Vodafone</span> : null}</div></div></footer>;
}

const waves = [
  ["M0,200 C200,100 400,300 600,200 C800,100 1000,300 1200,200 C1400,100 1600,300 1800,200 C2000,100 2200,300 2400,200", "#1A9AD6", "0.16", "1.5"],
  ["M0,320 C300,260 500,380 800,320 C1100,260 1300,380 1600,320 C1900,260 2100,380 2400,320", "#1A9AD6", "0.12", "1.25"],
  ["M0,420 C240,300 480,560 720,420 C960,280 1200,560 1440,420 C1680,280 1920,560 2160,420 C2280,360 2340,400 2400,420", "#36B0E5", "0.10", "1.25"],
  ["M0,540 C300,480 500,600 800,540 C1100,480 1300,600 1600,540 C1900,480 2100,600 2400,540", "#F4970B", "0.12", "1.25"],
  ["M0,640 C200,580 400,700 600,640 C800,580 1000,700 1200,640 C1400,580 1600,700 1800,640 C2000,580 2200,700 2400,640", "#F4970B", "0.08", "1"],
  ["M0,730 C400,640 600,820 1000,730 C1400,640 1600,820 2000,730 C2200,690 2300,720 2400,730", "#1A9AD6", "0.08", "1"],
];
export function SiteBackground({ set }: { set: DesignSetName }) {
  return <div className="site-bg" aria-hidden="true"><div className="site-grid" />{set === "case-study" ? null : <div className="site-waves">{waves.slice(0, set === "home" || set === "service" ? 6 : 4).map(([d, stroke, opacity, width], i) => <div className={`wave wave-${i + 1}`} key={i}><svg viewBox="0 0 2400 800" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d={d} fill="none" stroke={stroke} strokeOpacity={opacity} strokeWidth={width} /></svg></div>)}</div>}</div>;
}
