/*
 * Loads a page type's design set: stylesheets, fonts, and scripts, in the old
 * order and position (Phase C, Section 3).
 *
 * The root layout cannot see the page type, so the page renders the head items
 * and React 19 moves them into <head>:
 *   - preconnect() and preloadModule() are emitted first and after the
 *     stylesheets respectively;
 *   - stylesheets need a precedence to be moved into <head>. All share one, so
 *     they keep their order; React adds data-precedence="design" to each.
 * Scripts are plain <script> elements rendered in place, with no async or
 * defer: they run on page load exactly where the old pages ran them.
 */
import { DesignHeadItems } from "./DesignHeadItems";
import { designUrl } from "./folder";
import { designSets, type DesignSetName, type ScriptSlot } from "./sets";

export function DesignHead({ set }: { set: DesignSetName }) {
  // URLs are resolved here, on the server, where the design folder's hash is known.
  const items = designSets[set].head.map((item) => ({ ...item, href: designUrl(item.href) }));
  return <DesignHeadItems items={items} />;
}

export function DesignScripts({ set, slot }: { set: DesignSetName; slot: ScriptSlot }) {
  const scripts: { src: string; module?: true }[] = (designSets[set].scripts as Partial<Record<ScriptSlot, { src: string; module?: true }[]>>)[slot] ?? [];
  return (
    <>
      {scripts.map((script) => (
        <script key={script.src} src={designUrl(script.src)} type={script.module ? "module" : undefined} />
      ))}
    </>
  );
}

/**
 * Head items and the scripts outside the page content, around the page body.
 * Sections 4 and 5 put the header and footer inside this frame: the after-nav
 * scripts move to straight after the header's </nav>, and the hero scripts are
 * placed by the hero component (PageScaffold stands in for both until then).
 */
export function DesignFrame({ set, children }: { set: DesignSetName; children: React.ReactNode }) {
  return (
    <>
      <DesignHead set={set} />
      <DesignScripts set={set} slot="body-start" />
      <DesignScripts set={set} slot="after-nav" />
      {children}
      <DesignScripts set={set} slot="body-end" />
    </>
  );
}
