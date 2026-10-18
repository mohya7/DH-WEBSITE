// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import caseStudies from "../../packages/collections/case-studies.json";
import type { SchemaCatalog, SchemaNode } from "../src/content/schemas";

// The form module reads the website address as it loads. The unit-test job
// does not set that variable; the other Studio tests supply it themselves.
vi.stubEnv("VITE_PUBLIC_SITE_URL", "http://127.0.0.1:4380");

// Loaded here, after the stub, and not inside the test: FormWalker brings antd,
// TipTap, and the media picker, which took 2 to 3 s warm and about 26 s on the
// first run after npm ci. Inside the test that counted against the 5 s test
// timeout; at module level it is part of loading the file.
const { FormWalker } = await import("../src/content/FormWalker");

// The real collection schema, as the API serves it to the Studio (CollectionSchemaSet.Catalog).
const theme = caseStudies.properties.theme as SchemaNode;
const schema: SchemaNode = { type: "object", properties: { theme } };
const catalog: SchemaCatalog = { defs: {}, sections: {}, collections: { "case-studies": caseStudies as SchemaNode } };

describe("case study theme", () => {
  it("is the orange or teal select the collection schema declares", () => {
    expect(theme).toEqual({
      type: ["string", "null"],
      enum: ["orange", "teal", null],
      "x-dh-kind": "select",
      "x-dh-label": "Theme",
      "x-dh-help": "Accent colour of the case-study page. Leave empty for the default blue.",
    });
  });

  it("shows the accent select and saves orange, teal, or empty", () => {
    const saved: unknown[] = [];
    const view = render(
      <FormWalker schema={schema} catalog={catalog} value={{}} onChange={(next) => saved.push(next)} fieldPath="" />,
    );
    expect(view.getByText(theme["x-dh-help"]!)).toBeTruthy();
    const select = view.getByRole("combobox");
    expect(view.getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(["", "orange", "teal"]);
    fireEvent.change(select, { target: { value: "orange" } });
    expect(saved.at(-1)).toEqual({ theme: "orange" });
    fireEvent.change(select, { target: { value: "teal" } });
    expect(saved.at(-1)).toEqual({ theme: "teal" });
    fireEvent.change(select, { target: { value: "" } });
    expect(saved.at(-1)).toEqual({ theme: null });
  });
});
