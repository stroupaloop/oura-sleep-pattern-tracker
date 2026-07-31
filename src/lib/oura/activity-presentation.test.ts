import { describe, expect, it } from "vitest";
import {
  ACTIVITY_COLORS,
  NONWEAR_COLOR,
  UNAVAILABLE_ACTIVITY_COLOR,
  getActivityBarPresentation,
} from "./activity-presentation";

describe("getActivityBarPresentation", () => {
  it("uses the dominant Oura activity color for a fully classified hour", () => {
    expect(getActivityBarPresentation(3, 60)).toEqual({
      activityClass: "low",
      fill: ACTIVITY_COLORS.low,
      fillOpacity: 0.8,
      isNonWear: false,
    });
  });

  it("fades activity color when only part of the hour is classified", () => {
    const partial = getActivityBarPresentation(3, 30);
    const complete = getActivityBarPresentation(3, 60);

    expect(partial.fill).toBe(complete.fill);
    expect(partial.fillOpacity).toBeLessThan(complete.fillOpacity);
  });

  it("keeps unavailable or mixed activity visually distinct from non-wear", () => {
    expect(getActivityBarPresentation(null, 0)).toEqual({
      activityClass: null,
      fill: UNAVAILABLE_ACTIVITY_COLOR,
      fillOpacity: 0.3,
      isNonWear: false,
    });
    expect(getActivityBarPresentation(0, 60)).toEqual({
      activityClass: null,
      fill: NONWEAR_COLOR,
      fillOpacity: 0.7,
      isNonWear: true,
    });
  });

  it("fades a code-0-dominant hour when classification is partial", () => {
    expect(getActivityBarPresentation(0, 35).fillOpacity).toBeLessThan(
      getActivityBarPresentation(0, 60).fillOpacity
    );
  });
});
