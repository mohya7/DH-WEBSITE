/*
 * Home service cards keep the visible "Learn more" and add an accessible name
 * from the service title. The title is content, so it is escaped.
 */
import { describe, expect, it } from "vitest";
import { snapshotContent } from "../helpers";
import { instances, render, siteFrom, tags } from "./harness";

const labels = (html: string) =>
  tags(html)
    .filter((tag) => tag.name === "a" && (tag.attrs.get("class") ?? "").split(/\s+/).includes("svc-card__link"))
    .map((tag) => tag.attrs.get("aria-label"));

describe("home service cards", () => {
  const content = snapshotContent();
  const site = siteFrom(content);
  const [home] = instances(site, "service_cards").filter((instance) => instance.kind === "home");

  it("names each Learn more link from that card's service title", () => {
    const html = render(site, home.section, home);
    const titles = [...html.matchAll(/<h3 class="svc-card__title">([^<]*)<\/h3>/g)].map((match) => match[1]);
    expect(titles).toHaveLength(4);
    expect(labels(html)).toEqual(titles.map((title) => `Learn more about ${title}`));
    expect(html).toContain(">Learn more <");
    expect(html).not.toContain(">Learn more about ");
  });

  it("escapes a hostile service title in the accessible name", () => {
    const copy = snapshotContent();
    const service = copy.collections.services.find((item) => item.path);
    expect(service).toBeTruthy();
    service!.title = '"><script>';
    const hostile = siteFrom(copy);
    const html = render(hostile, home.section, home);
    expect(html).not.toContain('"><script>');
    expect(labels(html)).toContain("Learn more about &quot;&gt;&lt;script&gt;");
  });
});
