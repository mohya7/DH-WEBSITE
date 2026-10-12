/*
 * Home service cards keep the visible "Learn more" and add the service title
 * in visually hidden text. The title is content, so it is escaped.
 */
import { describe, expect, it } from "vitest";
import { snapshotContent } from "../helpers";
import { instances, render, siteFrom, tags } from "./harness";

const links = (html: string) =>
  tags(html).filter((tag) => tag.name === "a" && (tag.attrs.get("class") ?? "").split(/\s+/).includes("svc-card__link"));

const hidden = (html: string) =>
  [...html.matchAll(/<a href="[^"]*" class="svc-card__link">Learn more<span class="dh-sr-only">([^<]*)<\/span>/g)].map((match) => match[1]);

describe("home service cards", () => {
  const content = snapshotContent();
  const site = siteFrom(content);
  const [home] = instances(site, "service_cards").filter((instance) => instance.kind === "home");

  it("adds each service title as hidden text inside its Learn more link", () => {
    const html = render(site, home.section, home);
    const titles = [...html.matchAll(/<h3 class="svc-card__title">([^<]*)<\/h3>/g)].map((match) => match[1]);
    expect(titles).toHaveLength(4);
    expect(hidden(html)).toEqual(titles.map((title) => ` about ${title}`));
    expect(links(html)).toHaveLength(4);
    expect(links(html).every((link) => !link.attrs.has("aria-label"))).toBe(true);
  });

  it("escapes a hostile service title in the hidden text", () => {
    const copy = snapshotContent();
    const service = copy.collections.services.find((item) => item.path);
    expect(service).toBeTruthy();
    service!.title = '"><script>';
    const html = render(siteFrom(copy), home.section, home);
    expect(html).not.toContain('"><script>');
    expect(hidden(html)).toContain(" about &quot;&gt;&lt;script&gt;");
  });
});
