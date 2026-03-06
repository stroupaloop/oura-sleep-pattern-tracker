export interface ResearchReference {
  id: string;
  title: string;
  authors: string;
  journal: string;
  year: number;
  url: string;
  finding: string;
  relevantMetrics: string[];
}

export const RESEARCH_REFERENCES: ResearchReference[] = [
  {
    id: "oura-hypomania-2025",
    title: "Changes in sleep can signal hypomanic episodes days before they begin",
    authors: "Luykx et al.",
    journal: "Journal of Affective Disorders",
    year: 2025,
    url: "https://pubmed.ncbi.nlm.nih.gov/39793618/",
    finding:
      "Within-day sleep variability detected hypomanic episodes ~3 days before onset with 87% balanced accuracy and >90% sensitivity in 164 Oura Ring wearers.",
    relevantMetrics: ["withinNightVariability", "sleepStageTransitions"],
  },
  {
    id: "activity-depression-2025",
    title: "Day-to-day variability in step count anticipates depressive episodes",
    authors: "Int. J. Bipolar Disorders",
    journal: "International Journal of Bipolar Disorders",
    year: 2025,
    url: "https://journalbipolardisorders.springeropen.com/articles/10.1186/s40345-025-00379-6",
    finding:
      "Activity variability detected depressive episode onset 7 days before occurrence with 79% sensitivity in 127 outpatients with bipolar disorder.",
    relevantMetrics: ["activityLevel", "steps"],
  },
  {
    id: "hrv-bipolar-2024",
    title: "Bayesian analysis of HRV changes over acute bipolar episodes",
    authors: "Nature npj Mental Health Research",
    journal: "Nature",
    year: 2024,
    url: "https://www.nature.com/articles/s44184-024-00090-x",
    finding:
      "HRV increased by 17-18% during manic states compared to depressive and euthymic states, suggesting HRV is a state-dependent biomarker.",
    relevantMetrics: ["hrv", "withinNightHrvCV"],
  },
  {
    id: "temp-mania-2025",
    title: "State-dependent skin temperature increase during manic episodes",
    authors: "Clinic-IDIBAPS, Barcelona",
    journal: "Journal of Affective Disorders",
    year: 2025,
    url: "https://www.sciencedirect.com/science/article/abs/pii/S0165032725310857",
    finding:
      "Skin temperature was elevated during manic episodes (mid-morning through evening) and normalized upon remission, in a study of 104 bipolar patients.",
    relevantMetrics: ["temperatureDelta", "temperatureDeviation"],
  },
  {
    id: "circadian-relapse-2021",
    title: "Circadian activity rhythms predict mood episode relapse",
    authors: "Nature Translational Psychiatry",
    journal: "Nature Translational Psychiatry",
    year: 2021,
    url: "https://www.nature.com/articles/s41398-021-01652-9",
    finding:
      "Later timing of circadian activity rhythm was significantly associated with increased depressive episode relapses. Greater intradaily variability predicted earlier recurrence (AUC 0.75-0.82).",
    relevantMetrics: [
      "circadianIS",
      "circadianIV",
      "circadianRA",
      "bedtimeShift",
    ],
  },
  {
    id: "composite-accuracy-2024",
    title:
      "Accurately predicting mood episodes with combined sleep and circadian features",
    authors: "npj Digital Medicine",
    journal: "Nature npj Digital Medicine",
    year: 2024,
    url: "https://www.nature.com/articles/s41746-024-01333-z",
    finding:
      "Combined sleep and circadian rhythm features achieved 87% accuracy for depression, 94% for mania, and 91% for hypomania prediction.",
    relevantMetrics: [
      "sleepDuration",
      "circadianRegularity",
      "withinNightVariability",
    ],
  },
  {
    id: "sleep-architecture-bipolar",
    title:
      "Sleep architecture as correlate and predictor of bipolar symptoms",
    authors: "Harvey et al.",
    journal: "PMC",
    year: 2008,
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4935164/",
    finding:
      "69-99% of individuals in manic episodes report reduced need for sleep. ~70% of bipolar patients have persistent sleep disturbance even during remission. Sleep onset latency is the most consistent abnormality across all bipolar stages.",
    relevantMetrics: ["sleepDuration", "latency", "remPct", "deepPct"],
  },
  {
    id: "circadian-causal-2024",
    title:
      "Circadian phase disruptions precede mood symptom variations",
    authors: "Lancet eBioMedicine",
    journal: "The Lancet eBioMedicine",
    year: 2024,
    url: "https://www.thelancet.com/journals/ebiom/article/PIIS2352-3964(24)00129-4/fulltext",
    finding:
      "Circadian phase disruptions \u2014 rather than sleep disruptions alone \u2014 preceded mood symptom variations, suggesting circadian rhythm is a potential upstream target for intervention.",
    relevantMetrics: ["circadianIS", "circadianIV", "sleepTimingScore"],
  },
];

export const METRIC_LIMITATIONS: Record<string, string> = {
  circadianIS: "Circadian metrics require continuous ring wear for accuracy. IS computed from 3-day activity windows.",
  circadianIV: "Intradaily variability depends on activity data quality. Non-wear time may skew results.",
  circadianRA: "Relative amplitude requires full-day activity data. Partial wear reduces accuracy.",
  withinNightVariability: "Within-night metrics require 5-min HR/HRV data from long sleep periods.",
  sleepDuration: "Sleep duration is ring-detected and may miss naps or misclassify rest periods.",
  activityLevel: "Activity data may be incomplete on days with low ring wear time.",
  temperatureDelta: "Temperature readings require consistent ring placement and wearing the ring to bed.",
  hrv: "HRV accuracy depends on ring fit and consistent sleep position.",
  steps: "Step count may undercount certain activities (cycling, swimming).",
};

export const OURA_LIMITATIONS = [
  { missing: "Subjective mood", impact: "Cannot distinguish euthymia from hypomania without self-report", mitigation: "Daily mood check-in" },
  { missing: "Medication adherence", impact: "Cannot assess if sleep changes are medication-related", mitigation: "Medication tracking" },
  { missing: "Life events/context", impact: "Cannot distinguish episode signals from external stressors", mitigation: "Tags on mood entries" },
  { missing: "Speech patterns", impact: "Rate/volume changes are strong mania indicators", mitigation: "Acknowledged limitation" },
  { missing: "Cognitive performance", impact: "Attention/reaction time changes", mitigation: "Acknowledged limitation" },
  { missing: "Social activity", impact: "Social rhythm disruption is a key trigger", mitigation: "Add as mood tag" },
  { missing: "Phone usage patterns", impact: "Screen time correlates with episodes", mitigation: "Outside Oura domain" },
];

export function getReferencesForMetric(metric: string): ResearchReference[] {
  return RESEARCH_REFERENCES.filter((r) =>
    r.relevantMetrics.includes(metric)
  );
}

export function getReferencesForDirection(
  direction: "hyper" | "hypo"
): ResearchReference[] {
  const hyperMetrics = [
    "withinNightVariability",
    "sleepStageTransitions",
    "hrv",
    "withinNightHrvCV",
    "temperatureDelta",
    "temperatureDeviation",
    "sleepDuration",
  ];
  const hypoMetrics = [
    "activityLevel",
    "steps",
    "circadianIS",
    "circadianIV",
    "circadianRA",
    "sleepDuration",
    "bedtimeShift",
  ];
  const relevantMetrics = direction === "hyper" ? hyperMetrics : hypoMetrics;
  return RESEARCH_REFERENCES.filter((r) =>
    r.relevantMetrics.some((m) => relevantMetrics.includes(m))
  );
}
