/*
 * The 404 page, built from the error-404 page record. Exported as 404.html; IIS
 * returns it with a 404 status (Section 8). While the record is unpublished the
 * page is built with no content.
 */
import { PageScaffold } from "@/components/PageScaffold";
import { getSite } from "@/content/site";

export default function NotFound() {
  const page = getSite().errorPage("404");
  return page ? <PageScaffold item={page} pageType="error" /> : <main data-page-type="error" />;
}
