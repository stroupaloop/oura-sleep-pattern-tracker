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
    title: "Within-night sleep-stage variability before hypomanic episodes",
    authors: "Luykx et al.",
    journal: "Journal of Affective Disorders",
    year: 2025,
    url: "https://pubmed.ncbi.nlm.nih.gov/39793618/",
    finding:
      "A study-specific time-frequency signal derived from within-night sleep-stage variability preceded some hypomanic episodes by about three days. It does not validate this app's HR/HRV coefficient-of-variation metrics.",
    relevantMetrics: ["sleepStageTransitions"],
  },
  {
    id: "activity-depression-2025",
    title: "Frequency-domain step variability before depressive symptoms",
    authors: "Study authors",
    journal: "International Journal of Bipolar Disorders",
    year: 2025,
    url: "https://journalbipolardisorders.springeropen.com/articles/10.1186/s40345-025-00379-6",
    finding:
      "A frequency-domain step-variability method anticipated PHQ-9-defined depressive symptom onset by up to seven days with 79% sensitivity. It does not validate a simple drop in steps or active minutes.",
    relevantMetrics: ["activityLevel", "steps"],
  },
  {
    id: "hrv-bipolar-2024",
    title: "Bayesian analysis of HRV changes over acute bipolar episodes",
    authors: "Study authors",
    journal: "npj Mental Health Research",
    year: 2024,
    url: "https://www.nature.com/articles/s44184-024-00090-x",
    finding:
      "In Empatica E4 data, lnRMSSD tended to increase as acute symptoms resolved toward euthymia; the study did not establish a polarity-specific 17-18% mania increase or validate Oura thresholds.",
    relevantMetrics: ["hrv"],
  },
  {
    id: "temp-mania-2025",
    title: "State-dependent skin temperature increase during manic episodes",
    authors: "Study authors",
    journal: "Journal of Affective Disorders",
    year: 2025,
    url: "https://www.sciencedirect.com/science/article/abs/pii/S0165032725310857",
    finding:
      "Waking wrist temperature measured with Empatica E4 was elevated during manic episodes in a study of 104 participants. This does not validate thresholds for Oura's overnight temperature deviation.",
    relevantMetrics: ["temperatureDeviation"],
  },
  {
    id: "circadian-relapse-2021",
    title: "Circadian activity rhythms predict mood episode relapse",
    authors: "Study authors",
    journal: "Translational Psychiatry",
    year: 2021,
    url: "https://www.nature.com/articles/s41398-021-01652-9",
    finding:
      "Actiwatch-derived circadian timing and fragmentation measures were associated with depressive relapse timing. The paper reports hazard associations, not AUC 0.75-0.82, and does not validate this app's implementation.",
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
    authors: "Study authors",
    journal: "npj Digital Medicine",
    year: 2024,
    url: "https://www.nature.com/articles/s41746-024-01333-z",
    finding:
      "A Fitbit XGBoost model using 36 features plus prior mood history reported next-day AUCs of 0.80 for depression, 0.98 for mania, and 0.95 for hypomania. Those results do not validate this app's weighted score.",
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
    authors: "Gold & Sylvia",
    journal: "Nature and Science of Sleep",
    year: 2016,
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4935164/",
    finding:
      "This narrative review supports sleep disturbance as clinically important across bipolar states, but it does not validate Oura sleep-stage percentages or this app's thresholds.",
    relevantMetrics: ["sleepDuration", "latency", "remPct", "deepPct"],
  },
  {
    id: "circadian-causal-2024",
    title:
      "Circadian phase disruptions precede mood symptom variations",
    authors: "Study authors",
    journal: "eBioMedicine",
    year: 2024,
    url: "https://www.thelancet.com/journals/ebiom/article/PIIS2352-3964(24)00129-4/fulltext",
    finding:
      "Model-estimated circadian phase showed temporal associations with later mood variation. The causal interpretation is model-based and does not validate Oura activity-class IS/IV or this app's sleep timing score.",
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
