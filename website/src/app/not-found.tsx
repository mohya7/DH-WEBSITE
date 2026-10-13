/*
 * The 404 page, built from the error-404 page record. Exported as 404.html; IIS
 * returns it with a 404 status (Section 8). While the record is unpublished the
 * page is built with no content. It loads the hub design set.
 */
import type { Metadata } from "next";
import { PageScaffold } from "@/components/PageScaffold";
import { getSite } from "@/content/site";
import { headMetadata, noIndexRobots, pageHead } from "@/seo/head";
import { readSiteUrl } from "@/seo/site-url";

export function generateMetadata(): Metadata {
  const site = getSite();
  const page = site.errorPage("404");
  if (!page) return { robots: noIndexRobots };
  return headMetadata(pageHead(site, page, "error", "/404", readSiteUrl()));
}

export default function NotFound() {
  const page = getSite().errorPage("404");
  return <PageScaffold item={page} pageType="error" path="/404" />;
}
