"use client";
/*
 * Emits a design set's head items. A client component on purpose: Next renders
 * the 404 component into every page's React payload as its not-found fallback,
 * and resource hints from a server component there would add the hub set's
 * preloads to every page. A client component is only rendered where it is shown.
 */
import { preconnect, preloadModule } from "react-dom";
import type { HeadItem } from "./sets";

export function DesignHeadItems({ items }: { items: HeadItem[] }) {
  for (const item of items) {
    if (item.rel === "preconnect") preconnect(item.href, item.crossOrigin ? { crossOrigin: "" } : undefined);
    if (item.rel === "modulepreload") preloadModule(item.href);
  }
  return (
    <>
      {items.map((item) => (item.rel === "stylesheet" ? <link key={item.href} rel="stylesheet" href={item.href} precedence="design" /> : null))}
    </>
  );
}
