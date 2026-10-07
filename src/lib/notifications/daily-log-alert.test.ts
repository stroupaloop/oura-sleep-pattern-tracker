import { describe, expect, it } from "vitest";
import {
  buildDailyLogAlert,
  dailyLogAlertsEnabled,
  isLatestLogSave,
} from "./daily-log-alert";

const BASE = {
  email: "her@example.com",
  day: "2026-09-27",
  today: "2026-09-27",
  moodScore: 2,
  episodeState: "depressive",
  energyScore: null,
  irritabilityScore: null,
  anxietyScore: null,
  sleepSubjective: null,
  tags: ["poor_sleep"],
  note: "I watched the movie\nand thought of us",
  doses: { taken: ["Lamotrigine (Morning)"], notTaken: ["Lithium (Evening)"] },
};

describe("dailyLogAlertsEnabled", () => {
  it("defaults to the production deployment only", () => {
    expect(dailyLogAlertsEnabled({ vercelEnv: "production" })).toBe(true);
    expect(
      dailyLogAlertsEnabled({ vercelEnv: "preview", nodeEnv: "production" })
    ).toBe(false);
  });

  it("honours an explicit flag either way", () => {
    expect(dailyLogAlertsEnabled({ flag: "0", vercelEnv: "production" })).toBe(false);
    expect(dailyLogAlertsEnabled({ flag: "1", nodeEnv: "development" })).toBe(true);
  });
});

describe("isLatestLogSave", () => {
  it("is true only while the queued save is still the newest", () => {
    expect(isLatestLogSave(100, { updatedAt: 100 })).toBe(true);
    expect(isLatestLogSave(100, { updatedAt: 160 })).toBe(false);
    expect(isLatestLogSave(100, null)).toBe(false);
  });
});

describe("buildDailyLogAlert", () => {
  it("keeps health details out of the subject", () => {
    expect(buildDailyLogAlert(BASE).subject).toBe(
      "📝 her@example.com saved today's daily log"
    );
  });

  it("summarises the log in the body", () => {
    const alert = buildDailyLogAlert(BASE);
    expect(alert.html).toContain("+2");
    expect(alert.html).toContain("Depressive");
    expect(alert.html).toContain("poor sleep");
    expect(alert.text).toContain("Medications taken: Lamotrigine (Morning)");
    expect(alert.text).toContain("Not marked taken: Lithium (Evening)");
  });

  it("carries the note in full, line breaks kept", () => {
    const alert = buildDailyLogAlert(BASE);
    expect(alert.text).toContain("Note:\nI watched the movie\nand thought of us");
    expect(alert.html).toContain("white-space:pre-wrap");
    expect(alert.html).toContain("I watched the movie\nand thought of us");
  });

  it("says so when there is no note, and escapes one that has markup", () => {
    expect(buildDailyLogAlert({ ...BASE, note: null }).text).toContain(
      "Note:\nNone"
    );
    const html = buildDailyLogAlert({ ...BASE, note: "<script>x</script>" }).html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("names the day when the log is not today's", () => {
    expect(buildDailyLogAlert({ ...BASE, day: "2026-09-21" }).subject).toBe(
      "📝 her@example.com saved the daily log for Mon, Sep 21"
    );
  });

  it("includes optional scores only when present", () => {
    expect(buildDailyLogAlert(BASE).text).not.toContain("Energy");
    expect(
      buildDailyLogAlert({ ...BASE, energyScore: 4, sleepSubjective: 2 }).text
    ).toContain("Also: Energy 4/5 · Sleep quality 2/5");
  });

  it("leaves the optional row out entirely when none were answered", () => {
    const alert = buildDailyLogAlert(BASE);
    expect(alert.text).not.toContain("Also");
    expect(alert.html).not.toContain("Also");
    for (const word of ["Energy", "Irritability", "Anxiety", "Sleep quality"]) {
      expect(alert.text).not.toContain(word);
      expect(alert.html).not.toContain(word);
    }
    expect(alert.text).toContain("Tags: poor sleep");
  });

  it("names only the optional scores that were answered", () => {
    const alert = buildDailyLogAlert({ ...BASE, irritabilityScore: 2 });
    expect(alert.text).toContain("Also: Irritability 2/5\n");
    expect(alert.html).toContain(">Also</td><td");
    expect(alert.html).toContain("Irritability 2/5");
    for (const word of ["Energy", "Anxiety", "Sleep quality"]) {
      expect(alert.text).not.toContain(word);
    }
  });

  it("escapes medication names and tags", () => {
    const alert = buildDailyLogAlert({
      ...BASE,
      doses: { taken: ["<b>X</b> (Morning)"], notTaken: [] },
    });
    expect(alert.html).not.toContain("<b>X</b>");
    expect(alert.html).toContain("&lt;b&gt;X&lt;/b&gt;");
  });
});
