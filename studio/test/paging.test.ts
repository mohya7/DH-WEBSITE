import { describe, expect, it } from "vitest";
import { afterEmptyPage, lastPage, latestOnly, withPage } from "../src/ui/paging";

describe("paging helpers", () => {
  it("lastPage is never below 1", () => {
    expect(lastPage(0, 50)).toBe(1);
    expect(lastPage(50, 50)).toBe(1);
    expect(lastPage(51, 50)).toBe(2);
    expect(lastPage(120, 50)).toBe(3);
  });

  it("withPage sets page and pageSize and keeps other parameters", () => {
    expect(withPage(new URLSearchParams("search=x"), 2, 48).toString()).toBe("search=x&page=2&pageSize=48");
  });

  it("latestOnly accepts only the newest ticket", () => {
    const requests = latestOnly();
    const a = requests.start();
    const b = requests.start();
    expect(requests.isLatest(a)).toBe(false);
    expect(requests.isLatest(b)).toBe(true);
  });

  it("afterEmptyPage jumps to the last page once, then fails", () => {
    expect(afterEmptyPage(1, 120, 50, false)).toBe("show");
    expect(afterEmptyPage(3, 0, 50, false)).toBe("show");
    expect(afterEmptyPage(3, 51, 50, false)).toBe(2);
    expect(afterEmptyPage(2, 51, 50, true)).toBe("fail");
    expect(afterEmptyPage(2, 120, 50, false)).toBe("fail");
  });
});
