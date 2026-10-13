// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormWalker } from "../src/content/FormWalker";
import type { SchemaCatalog, SchemaNode } from "../src/content/schemas";

const help = "Accent colour of the case-study page. Leave empty for the default blue.";

const schema: SchemaNode = {
  type: "object",
  properties: {
    theme: {
      type: ["string", "null"],
      enum: ["orange", "teal", null],
      "x-dh-kind": "select",
      "x-dh-label": "Theme",
      "x-dh-help": help,
    },
  },
};

const catalog: SchemaCatalog = { defs: {}, sections: {}, collections: {} };

describe("case study theme", () => {
  it("shows the accent select and saves orange, teal, or empty", () => {
    const saved: unknown[] = [];
    const view = render(
      <FormWalker schema={schema} catalog={catalog} value={{}} onChange={(next) => saved.push(next)} fieldPath="" />,
    );
    expect(view.getByText(help)).toBeTruthy();
    const select = view.getByRole("combobox");
    expect(view.getByRole("option", { name: "orange" })).toBeTruthy();
    expect(view.getByRole("option", { name: "teal" })).toBeTruthy();
    fireEvent.change(select, { target: { value: "orange" } });
    expect(saved.at(-1)).toEqual({ theme: "orange" });
    fireEvent.change(select, { target: { value: "teal" } });
    expect(saved.at(-1)).toEqual({ theme: "teal" });
    fireEvent.change(select, { target: { value: "" } });
    expect(saved.at(-1)).toEqual({ theme: null });
  });
});
