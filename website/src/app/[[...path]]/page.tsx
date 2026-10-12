/*
 * Every page type — home, pages, services, partners, case studies, blog posts,
 * vacancies — at the clean path the API resolved for it. Only paths listed by
 * generateStaticParams exist; anything else is the 404 page.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageScaffold } from "@/components/PageScaffold";
import { getSite } from "@/content/site";
import { headMetadata, pageHead } from "@/seo/head";
import { readSiteUrl } from "@/seo/site-url";

export const dynamicParams = false;

function metadataFor(path: string[] | undefined): Metadata {
  const site = getSite();
  const route = site.routeFor(path);
  if (!route) return {};
  return headMetadata(pageHead(site, route.item, route.pageType, route.path, readSiteUrl()));
}

export function generateStaticParams(): { path: string[] }[] {
  return getSite().routes.map((route) => ({ path: route.segments }));
}

export async function generateMetadata({ params }: { params: Promise<{ path?: string[] }> }): Promise<Metadata> {
  const { path } = await params;
  return metadataFor(path);
}

export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const route = getSite().routeFor(path);
  if (!route) notFound();

  return <PageScaffold item={route.item} pageType={route.pageType} />;
}
