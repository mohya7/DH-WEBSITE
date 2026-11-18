/*
 * Two of the build's content checks, run on any BuildContent: the prepare
 * step's schema, media and inline-text check (validateContent) and the
 * web.config step's redirect check (renderWebConfig), called as
 * scripts/write-web-config.ts calls it.
 *
 * It adds no rule of its own. It exists so content the Content API accepted can
 * be fed to the website's own checks (ADM-02): the API's integration tests run
 * it on what GET /api/v1/build/content returned.
 *
 * It is not a whole build. A real build also stops on the route table
 * (buildRoutes), on unpublished error pages in an API build (prepare.ts), and on
 * the output checks after next build (check-output.ts). Those are not run here.
 */
import type { BuildContent } from "./build-content";
import { tagManagerId } from "./tag-manager";
import { validateContent } from "./validate";
import { WebConfigError, renderWebConfig } from "../iis/web-config";

/** Every problem the two checks find, as readable lines. Empty when both pass. */
export function checkContent(content: BuildContent): string[] {
  const problems = validateContent(content);
  const tagManager = content.settings != null && tagManagerId(content.settings) !== null;
  try {
    renderWebConfig(content.redirects ?? [], { tagManager });
  } catch (error: unknown) {
    if (!(error instanceof WebConfigError)) throw error;
    problems.push(error.message);
  }
  return problems;
}
