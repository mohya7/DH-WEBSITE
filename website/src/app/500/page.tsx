/*
 * The 500 page, built from the error-500 page record. Exported as 500.html; IIS
 * returns it with a 500 status (Section 8). While the record is unpublished the
 * page is built with no content. It loads the hub design set.
 */
import type { Metadata } from "next";
import { PageScaffold } from "@/components/PageScaffold";
import { getSite } from "@/content/site";
import { headMetadata, pageHead } from "@/seo/head";
import { readSiteUrl } from "@/seo/site-url";

export function generateMetadata(): Metadata {
  const site = getSite();
  const page = site.errorPage("500");
  if (!page) return { robots: "noindex" };
  return headMetadata(pageHead(site, page, "error", "/500", readSiteUrl()));
}

export default function ServerError() {
  const page = getSite().errorPage("500");
  return <PageScaffold item={page} pageType="error" path="/500" />;
}
