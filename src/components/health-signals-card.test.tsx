import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HealthSignalsCard } from "./health-signals-card";

function render(signalType: string) {
  return renderToStaticMarkup(
    <HealthSignalsCard
      signals={[
        {
          day: "2026-03-20",
          signalType,
          status: "detected",
          evidenceScore: 0.55,
          indicators: ["Nighttime skin-temperature deviation stayed elevated"],
        },
      ]}
    />
  );
}

describe("HealthSignalsCard guidance", () => {
  it("keeps the sustained temperature pattern nonspecific and points to her care team", () => {
    const html = render("sustained_temperature");

    expect(html).toContain(
      "This pattern is nonspecific; it can follow many things. If you are worried about your health, talk with your care team."
    );
  });

  it("does not nudge a test, for the current signal or the legacy one it replaced", () => {
    for (const signalType of ["sustained_temperature", "early_pregnancy"]) {
      const html = render(signalType);

      expect(html).not.toMatch(/\btests?\b/i);
    }
  });
});
