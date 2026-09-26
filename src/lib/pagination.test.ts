import { describe, expect, it } from "vitest";
import { buildPageModel } from "./pagination";

describe("buildPageModel", () => {
  it("describes the first page of a long list", () => {
    const p = buildPageModel(1, 24, 10);
    expect(p).toMatchObject({
      page: 1,
      pageCount: 3,
      offset: 0,
      from: 1,
      to: 10,
      hasPrev: false,
      hasNext: true,
    });
  });

  it("describes a partial last page", () => {
    const p = buildPageModel(3, 24, 10);
    expect(p).toMatchObject({
      page: 3,
      offset: 20,
      from: 21,
      to: 24,
      hasPrev: true,
      hasNext: false,
    });
  });

  it("clamps a page past the end rather than showing nothing", () => {
    expect(buildPageModel(99, 24, 10).page).toBe(3);
  });

  it("clamps zero and negatives to the first page", () => {
    expect(buildPageModel(0, 24, 10).page).toBe(1);
    expect(buildPageModel(-5, 24, 10).offset).toBe(0);
  });

  it("survives junk from the query string", () => {
    for (const junk of ["abc", "", null, undefined, {}, Number.NaN]) {
      const p = buildPageModel(junk, 24, 10);
      expect(p.page).toBe(1);
      expect(p.offset).toBe(0);
    }
  });

  it("takes the first value when the param repeats", () => {
    expect(buildPageModel(["2", "9"], 24, 10).page).toBe(2);
  });

  it("handles an empty list without a phantom page", () => {
    const p = buildPageModel(1, 0, 10);
    expect(p).toMatchObject({
      page: 1,
      pageCount: 1,
      from: 0,
      to: 0,
      hasPrev: false,
      hasNext: false,
    });
  });

  it("handles a list that fits on one page", () => {
    const p = buildPageModel(1, 4, 10);
    expect(p).toMatchObject({ pageCount: 1, from: 1, to: 4, hasNext: false });
  });

  it("refuses a nonsense page size", () => {
    expect(buildPageModel(1, 10, 0).limit).toBe(1);
  });
});
