import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CycleLengthChart } from "./cycle-length-chart";

describe("CycleLengthChart evidence gate", () => {
  it("requires three observed intervals before rendering a chart", () => {
    const insufficient = renderToStaticMarkup(
      createElement(CycleLengthChart, {
        data: [
          { cycleNumber: 2, interShiftDays: 28 },
          { cycleNumber: 3, interShiftDays: 30 },
        ],
      })
    );
    const sufficient = renderToStaticMarkup(
      createElement(CycleLengthChart, {
        data: [
          { cycleNumber: 2, interShiftDays: 28 },
          { cycleNumber: 3, interShiftDays: 30 },
          { cycleNumber: 4, interShiftDays: 27 },
        ],
      })
    );

    expect(insufficient).toBe("");
    expect(sufficient).toContain("3 observed intervals");
    expect(sufficient).toContain("not menstrual-cycle length");
  });
});
