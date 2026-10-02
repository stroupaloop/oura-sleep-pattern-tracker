import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DetectionConfig } from "./detection-config";

function checkedOptions(html: string): string[] {
  return [...html.matchAll(/role="radio" aria-checked="true"[^>]*>([^<]+)</g)].map(
    (match) => match[1]
  );
}

const SAVE_DISABLED = /disabled=""[^>]*>Save Preset &amp; Reprocess</;

describe("DetectionConfig", () => {
  it("opens on the saved preset rather than always on Medium", () => {
    expect(checkedOptions(renderToStaticMarkup(<DetectionConfig savedPreset="low" />))).toEqual(["Low"]);
    expect(checkedOptions(renderToStaticMarkup(<DetectionConfig savedPreset="medium" />))).toEqual(["Medium"]);
    expect(checkedOptions(renderToStaticMarkup(<DetectionConfig savedPreset="high" />))).toEqual(["High"]);
  });

  it("describes the saved preset and offers to save it again", () => {
    const html = renderToStaticMarkup(<DetectionConfig savedPreset="high" />);
    expect(html).toContain("More sensitive");
    expect(html).not.toContain("Balanced");
    expect(html).not.toContain(">Custom<");
    expect(html).not.toMatch(SAVE_DISABLED);
  });

  it("calls saved thresholds that match no preset Custom, with nothing to save", () => {
    const html = renderToStaticMarkup(<DetectionConfig savedPreset={null} />);
    expect(checkedOptions(html)).toEqual(["Custom"]);
    expect(html).toContain("The saved thresholds match no preset.");
    expect(html).toMatch(SAVE_DISABLED);
  });
});
