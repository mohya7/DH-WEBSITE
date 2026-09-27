/*
 * Every page type — home, pages, services, partners, case studies, blog posts,
 * vacancies — at the clean path the API resolved for it. Only paths listed by
 * generateStaticParams exist; anything else is the 404 page.
 */
import { notFound } from "next/navigation";
import { PageScaffold } from "@/components/PageScaffold";
import { getSite } from "@/content/site";

export const dynamicParams = false;

export function generateStaticParams(): { path: string[] }[] {
  return getSite().routes.map((route) => ({ path: route.segments }));
}

export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const route = getSite().routeFor(path);
  if (!route) notFound();

  return <PageScaffold item={route.item} pageType={route.pageType} />;
}
