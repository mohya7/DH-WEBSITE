/*
 * The website's link adapter: a plain <a>. The site uses ordinary full-page
 * links, never Next's client-side navigation (Section 3).
 */
import type { LinkAdapterProps } from "@digitalhub/blocks";

export function Link({ href, className, children, attributes }: LinkAdapterProps) {
  return (
    <a href={href} className={className} {...attributes}>
      {children}
    </a>
  );
}
