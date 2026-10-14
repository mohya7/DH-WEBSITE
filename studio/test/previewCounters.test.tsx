import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Stats } from "../../packages/blocks/src/sections/Stats";
import type { BlockContext } from "../../packages/blocks/src/context";
import { materialiseCounters } from "../src/preview/counters";

const about = {
  heading: "",
  items: [
    { value: "5+", label: "Years in Business" },
    { value: "50+", label: "Employees" },
    { value: "50+", label: "Customers" },
  ],
};

const ctx = {
  page: { kind: "page", slug: "about" },
  Image: () => null,
  Link: () => null,
  resolve: () => null,
  collections: { services: [], partners: [], caseStudies: [], blogPosts: [], newsItems: [], vacancies: [], teamMembers: [] },
} as BlockContext;

describe("script-free preview counters", () => {
  it("shows the final About values the website script writes, while the shared markup still starts at 0", () => {
    const raw = renderToStaticMarkup(<Stats fields={about} ctx={ctx} />);
    expect(raw).toContain('data-count="5"');
    expect(raw).toContain('data-suffix="+"');
    expect(raw).toContain(">0<");
    const preview = materialiseCounters(raw);
    expect(preview).toContain(">5+<");
    expect(preview.match(/>50\+</g)).toHaveLength(2);
    expect(preview).not.toContain(">0<");
  });
});
