import { describe, expect, it } from "vitest";
import {
  directionForEpisodeState,
  evaluateRetrospectiveAgreement,
  groupLabelledEvents,
} from "./retrospective";

describe("retrospective agreement", () => {
  it("keeps mania and hypomania distinct while mapping both higher-activation", () => {
    expect(directionForEpisodeState("hypomanic")).toBe("hyper");
    expect(directionForEpisodeState("manic")).toBe("hyper");
    expect(
      groupLabelledEvents([
        { day: "2026-07-10", episodeState: "hypomanic" },
        { day: "2026-07-11", episodeState: "manic" },
      ])
    ).toHaveLength(2);
  });

  it("reports event agreement, lead time, misses, and unmatched flag windows", () => {
    const result = evaluateRetrospectiveAgreement(
      [
        { day: "2026-07-07", tier: "none", direction: null, evaluable: true },
        {
          day: "2026-07-08",
          tier: "watch",
          direction: "hyper",
          evaluable: true,
        },
        {
          day: "2026-07-09",
          tier: "watch",
          direction: "hyper",
          evaluable: true,
        },
        {
          day: "2026-07-10",
          tier: "warning",
          direction: "hyper",
          evaluable: true,
        },
        { day: "2026-07-11", tier: "none", direction: null, evaluable: true },
        {
          day: "2026-07-18",
          tier: "watch",
          direction: "hyper",
          evaluable: true,
        },
        { day: "2026-07-19", tier: "none", direction: null, evaluable: true },
        { day: "2026-07-20", tier: "none", direction: null, evaluable: true },
      ],
      [
        { day: "2026-07-11", episodeState: "hypomanic" },
        { day: "2026-07-12", episodeState: "hypomanic" },
        { day: "2026-07-20", episodeState: "depressive" },
      ]
    );

    expect(result).toMatchObject({
      labelledEvents: 2,
      evaluableEvents: 2,
      eventsWithMatchingFlag: 1,
      missedEvents: 1,
      medianLeadDays: 3,
    });
  });

  it("does not count a labelled event without enough prior assessment coverage", () => {
    const result = evaluateRetrospectiveAgreement(
      [
        {
          day: "2026-07-10",
          tier: "watch",
          direction: "hyper",
          evaluable: true,
        },
      ],
      [{ day: "2026-07-10", episodeState: "manic" }]
    );

    expect(result.labelledEvents).toBe(1);
    expect(result.evaluableEvents).toBe(0);
    expect(result.missedEvents).toBe(0);
  });

  it("preserves explicit none labels separately from missing labels", () => {
    const result = evaluateRetrospectiveAgreement(
      [
        {
          day: "2026-07-10",
          tier: "watch",
          direction: "hyper",
          evaluable: true,
        },
      ],
      [
        { day: "2026-07-09", episodeState: null },
        { day: "2026-07-10", episodeState: "none" },
      ]
    );

    expect(result.explicitLabelDays).toBe(1);
    expect(result.labelledEvents).toBe(0);
  });

  it("does not reuse one flag window for two separately labelled events", () => {
    const assessments = [
      { day: "2026-07-07", tier: "none", direction: null, evaluable: true },
      {
        day: "2026-07-08",
        tier: "watch",
        direction: "hyper",
        evaluable: true,
      },
      {
        day: "2026-07-09",
        tier: "watch",
        direction: "hyper",
        evaluable: true,
      },
      { day: "2026-07-10", tier: "none", direction: null, evaluable: true },
      { day: "2026-07-11", tier: "none", direction: null, evaluable: true },
      { day: "2026-07-12", tier: "none", direction: null, evaluable: true },
    ];
    const result = evaluateRetrospectiveAgreement(assessments, [
      { day: "2026-07-10", episodeState: "hypomanic" },
      { day: "2026-07-12", episodeState: "manic" },
    ]);

    expect(result.evaluableEvents).toBe(2);
    expect(result.eventsWithMatchingFlag).toBe(1);
    expect(result.missedEvents).toBe(1);
  });

  it("does not count insufficient assessment rows as scored coverage", () => {
    const result = evaluateRetrospectiveAgreement(
      [
        {
          day: "2026-07-08",
          tier: "watch",
          direction: "hypo",
          evaluable: false,
        },
        { day: "2026-07-09", tier: "none", direction: null, evaluable: false },
        { day: "2026-07-10", tier: "none", direction: null, evaluable: false },
      ],
      [{ day: "2026-07-10", episodeState: "depressive" }]
    );

    expect(result.labelledEvents).toBe(1);
    expect(result.evaluableEvents).toBe(0);
    expect(result.missedEvents).toBe(0);
  });

  it("uses maximum one-to-one matching when a mixed event has alternatives", () => {
    const result = evaluateRetrospectiveAgreement(
      [
        {
          day: "2026-07-07",
          tier: "watch",
          direction: "hypo",
          evaluable: true,
        },
        { day: "2026-07-08", tier: "none", direction: null, evaluable: true },
        {
          day: "2026-07-09",
          tier: "watch",
          direction: "hyper",
          evaluable: true,
        },
        { day: "2026-07-10", tier: "none", direction: null, evaluable: true },
        { day: "2026-07-11", tier: "none", direction: null, evaluable: true },
        { day: "2026-07-12", tier: "none", direction: null, evaluable: true },
      ],
      [
        { day: "2026-07-10", episodeState: "mixed" },
        { day: "2026-07-12", episodeState: "hypomanic" },
      ]
    );

    expect(result.evaluableEvents).toBe(2);
    expect(result.eventsWithMatchingFlag).toBe(2);
    expect(result.missedEvents).toBe(0);
  });
});
