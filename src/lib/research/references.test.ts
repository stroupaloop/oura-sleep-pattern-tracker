import { describe, expect, it } from "vitest";
import {
  METRIC_LIMITATIONS,
  OURA_LIMITATIONS,
  RESEARCH_REFERENCES,
  getReferencesForDirection,
  getReferencesForMetric,
} from "./references";

// Identities below were checked against NCBI esummary (PMID) and Crossref (DOI).
const PUBLISHED = [
  {
    id: "oura-hypomania-2025",
    title:
      "Day-to-day variability in sleep and activity predict the onset of a hypomanic episode in patients with bipolar disorder",
    authors: "Ortiz et al.",
    journal: "Journal of Affective Disorders",
    year: 2025,
    url: "https://doi.org/10.1016/j.jad.2025.01.026",
  },
  {
    id: "activity-depression-2025",
    title:
      "Day-to-day variability in activity levels detects transitions to depressive symptoms in bipolar disorder earlier than changes in sleep and mood",
    authors: "Ortiz et al.",
    journal: "International Journal of Bipolar Disorders",
    year: 2025,
    url: "https://doi.org/10.1186/s40345-025-00379-6",
  },
  {
    id: "hrv-bipolar-2024",
    title:
      "A Bayesian analysis of heart rate variability changes over acute episodes of bipolar disorder",
    authors: "Corponi et al.",
    journal: "npj Mental Health Research",
    year: 2024,
    url: "https://doi.org/10.1038/s44184-024-00090-x",
  },
  {
    id: "temp-mania-2025",
    title:
      "State-dependent skin temperature increase during manic episodes of bipolar disorder",
    authors: "Valenzuela-Pascual et al.",
    journal: "Journal of Affective Disorders",
    year: 2025,
    url: "https://doi.org/10.1016/j.jad.2025.119643",
  },
  {
    id: "circadian-relapse-2021",
    title:
      "Association between circadian activity rhythms and mood episode relapse in bipolar disorder: a 12-month prospective cohort study",
    authors: "Esaki et al.",
    journal: "Translational Psychiatry",
    year: 2021,
    url: "https://doi.org/10.1038/s41398-021-01652-9",
  },
  {
    id: "composite-accuracy-2024",
    title:
      "Accurately predicting mood episodes in mood disorder patients using wearable sleep and circadian rhythm features",
    authors: "Lim et al.",
    journal: "npj Digital Medicine",
    year: 2024,
    url: "https://doi.org/10.1038/s41746-024-01333-z",
  },
  {
    id: "sleep-architecture-bipolar",
    title: "The role of sleep in bipolar disorder",
    authors: "Gold & Sylvia",
    journal: "Nature and Science of Sleep",
    year: 2016,
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4935164/",
  },
  {
    id: "circadian-causal-2024",
    title:
      "Causal dynamics of sleep, circadian rhythm, and mood symptoms in patients with major depression and bipolar disorder: insights from longitudinal wearable device data",
    authors: "Song et al.",
    journal: "eBioMedicine",
    year: 2024,
    url: "https://doi.org/10.1016/j.ebiom.2024.105094",
  },
];

function byId(id: string) {
  const reference = RESEARCH_REFERENCES.find((entry) => entry.id === id);
  if (!reference) throw new Error(`Missing reference ${id}`);
  return reference;
}

describe("research references", () => {
  it("keeps the ids that stored pattern results point to, each once", () => {
    const ids = RESEARCH_REFERENCES.map((reference) => reference.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(PUBLISHED.map((entry) => entry.id).sort());
  });

  it("matches the published title, first author, journal, year and link of each study", () => {
    for (const published of PUBLISHED) {
      const { id, ...expected } = published;
      const { title, authors, journal, year, url } = byId(id);
      expect({ title, authors, journal, year, url }, id).toEqual(expected);
    }
  });

  it("names real authors, never a placeholder", () => {
    for (const reference of RESEARCH_REFERENCES) {
      expect(reference.authors, reference.id).toMatch(
        /^\p{Lu}[\p{L}'’-]+( et al\.| & \p{Lu}[\p{L}'’-]+)$/u
      );
      expect(reference.authors, reference.id).not.toMatch(
        /study authors|unknown|n\/a/i
      );
    }
  });

  it("links over https to a DOI or a PubMed Central article", () => {
    for (const reference of RESEARCH_REFERENCES) {
      const url = new URL(reference.url);
      expect(url.protocol, reference.id).toBe("https:");
      if (url.hostname === "doi.org") {
        expect(url.pathname, reference.id).toMatch(/^\/10\.\d{4,9}\/\S+$/);
      } else {
        expect(url.hostname, reference.id).toBe("pmc.ncbi.nlm.nih.gov");
        expect(url.pathname, reference.id).toMatch(/^\/articles\/PMC\d+\/$/);
      }
    }
  });

  it("gives every study a year that has already happened", () => {
    const thisYear = new Date().getFullYear();
    for (const reference of RESEARCH_REFERENCES) {
      expect(Number.isInteger(reference.year), reference.id).toBe(true);
      expect(reference.year, reference.id).toBeGreaterThanOrEqual(2000);
      expect(reference.year, reference.id).toBeLessThanOrEqual(thisYear);
    }
  });

  it("says in every finding what the study does not validate", () => {
    for (const reference of RESEARCH_REFERENCES) {
      expect(reference.finding, reference.id).toMatch(/(do|does) not validate/);
    }
  });

  it("gives lead times as medians, not best cases", () => {
    for (const id of ["oura-hypomania-2025", "activity-depression-2025"]) {
      expect(byId(id).finding, id).toMatch(/a median of \d/);
      expect(byId(id).finding, id).not.toMatch(/up to/i);
    }
  });

  it("carries none of the claims it replaced", () => {
    const everything = JSON.stringify(RESEARCH_REFERENCES);
    for (const replaced of [
      "Luykx",
      "Study authors",
      "up to seven days",
      "17-18%",
      "0.75-0.82",
      "S0165032725310857",
    ]) {
      expect(everything).not.toContain(replaced);
    }
  });
});

describe("limitation notes", () => {
  it("keeps unsourced clinical claims out of the limitation tables", () => {
    const text = JSON.stringify({ OURA_LIMITATIONS, METRIC_LIMITATIONS });
    for (const replaced of [
      "strong mania indicators",
      "key trigger",
      "correlates with episodes",
    ]) {
      expect(text).not.toContain(replaced);
    }
  });

  it("words each missing signal as what the app cannot see", () => {
    for (const row of OURA_LIMITATIONS) {
      expect(row.impact, row.missing).toMatch(/^(Cannot|Sleep and activity)/);
      expect(row.mitigation.length, row.missing).toBeGreaterThan(0);
    }
  });
});

describe("which study is cited for a flag", () => {
  it("cites the hypomania study first for a higher-activation flag", () => {
    expect(getReferencesForDirection("hyper")[0].id).toBe(
      "oura-hypomania-2025"
    );
  });

  it("cites the depression study first for a lower-activation flag", () => {
    expect(getReferencesForDirection("hypo")[0].id).toBe(
      "activity-depression-2025"
    );
  });

  it("does not cite the HRV study for either direction, since it found no difference by episode type", () => {
    for (const direction of ["hyper", "hypo"] as const) {
      const ids = getReferencesForDirection(direction).map((r) => r.id);
      expect(ids).not.toContain("hrv-bipolar-2024");
    }
  });

  it("cites the fragmentation finding for higher activation, where it was found", () => {
    const ids = getReferencesForDirection("hyper").map((r) => r.id);
    expect(ids).toContain("circadian-relapse-2021");
  });

  it("does not cite the circadian-phase study, which is not about any metric the app scores", () => {
    for (const direction of ["hyper", "hypo"] as const) {
      const ids = getReferencesForDirection(direction).map((r) => r.id);
      expect(ids).not.toContain("circadian-causal-2024");
    }
  });
});

describe("research buttons", () => {
  it("keeps at least one study behind every metric that has a research button", () => {
    for (const metric of [
      "sleepDuration",
      "circadianIS",
      "sleepStageTransitions",
      "activityLevel",
    ]) {
      expect(getReferencesForMetric(metric).length, metric).toBeGreaterThan(0);
    }
  });
});
