import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataAvailabilityCard } from "./confidence-indicator";

describe("DataAvailabilityCard", () => {
  it("presents independent source facts without a synthetic score", () => {
    const html = renderToStaticMarkup(
      <DataAvailabilityCard
        data={{
          windowDays: 30,
          sleep: { measuredDays: 26, latestDay: "2026-07-30" },
          activity: { measuredDays: 28, latestDay: "2026-07-31" },
          mood: { measuredDays: 20, latestDay: "2026-07-29" },
          medicationLogging: {
            activeMedications: 2,
            entries: 17,
            loggedDays: 12,
            latestDay: "2026-07-31",
          },
        }}
      />
    );

    expect(html).toContain("26/30 measured nights");
    expect(html).toContain("28/30 measured days");
    expect(html).toContain("20/30 days logged");
    expect(html).toContain("17 entries across 12 days");
    expect(html).toContain("Latest medication log: Jul 31");
    expect(html).not.toContain("%");
    expect(html).not.toContain("Wear your ring");
  });

  it("does not imply medication adherence when only configuration exists", () => {
    const html = renderToStaticMarkup(
      <DataAvailabilityCard
        data={{
          windowDays: 30,
          sleep: { measuredDays: 0, latestDay: null },
          activity: { measuredDays: 0, latestDay: null },
          mood: { measuredDays: 0, latestDay: null },
          medicationLogging: {
            activeMedications: 1,
            entries: 0,
            loggedDays: 0,
            latestDay: null,
          },
        }}
      />
    );

    expect(html).toContain("1 active medication · no entries");
    expect(html).toContain(
      "Source-specific presence counts; a measured day may be partial. This is not an accuracy, adherence, or ring-wear score."
    );
  });
});
