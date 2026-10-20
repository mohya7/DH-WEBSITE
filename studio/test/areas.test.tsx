import { describe, expect, it } from "vitest";
import { areasForRole } from "../src/shell/areas";

describe("studio areas", () => {
  it("shows applications only to hr, with vacancies", () => {
    const hr = areasForRole("hr").map((area) => area.path);
    expect(hr).toEqual(["/vacancies", "/applications"]);
    expect(areasForRole("admin").some((area) => area.path === "/applications")).toBe(false);
    expect(areasForRole("editor").some((area) => area.path === "/applications")).toBe(false);
    expect(areasForRole("editor").some((area) => area.path === "/users")).toBe(false);
    expect(areasForRole("admin").some((area) => area.path === "/users")).toBe(true);
  });
});
