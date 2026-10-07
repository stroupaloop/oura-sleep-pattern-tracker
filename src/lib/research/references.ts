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
    title:
      "Day-to-day variability in sleep and activity predict the onset of a hypomanic episode in patients with bipolar disorder",
    authors: "Ortiz et al.",
    journal: "Journal of Affective Disorders",
    year: 2025,
    url: "https://doi.org/10.1016/j.jad.2025.01.026",
    finding:
      "In 50 Oura Ring users with bipolar disorder who had a hypomanic episode, unusual variability in sleep stages was picked up a median of 3 days, and in activity 2.5 days, before a weekly self-rating first reached the study's hypomania cut-off. Only people who had an episode were analysed, and a research algorithm was used; it does not validate this app's metrics.",
    relevantMetrics: ["withinNightVariability", "sleepStageTransitions"],
  },
  {
    id: "activity-depression-2025",
    title:
      "Day-to-day variability in activity levels detects transitions to depressive symptoms in bipolar disorder earlier than changes in sleep and mood",
    authors: "Ortiz et al.",
    journal: "International Journal of Bipolar Disorders",
    year: 2025,
    url: "https://doi.org/10.1186/s40345-025-00379-6",
    finding:
      "In 127 Oura Ring users with bipolar disorder, spikes in day-to-day variability in step counts were detected a median of 7 days (IQR 9) before self-rated depressive symptoms (weekly PHQ-9) set in, earlier than deep-sleep changes. Sensitivity was about 0.79 and specificity 0.86 in a 2-week window. Its outcome was depressive symptoms and it measured variability, so it does not validate a simple drop in steps.",
    relevantMetrics: ["activityLevel", "steps"],
  },
  {
    id: "hrv-bipolar-2024",
    title:
      "A Bayesian analysis of heart rate variability changes over acute episodes of bipolar disorder",
    authors: "Corponi et al.",
    journal: "npj Mental Health Research",
    year: 2024,
    url: "https://doi.org/10.1038/s44184-024-00090-x",
    finding:
      "In 23 people followed from the start of a manic or depressive episode to recovery, overnight HRV from a research wristband (Empatica E4) tended to rise as symptoms eased, with no clear difference between mania and depression; the estimate was imprecise and its range still included no change. The authors suggest HRV change may not tell mania from depression. It does not validate Oura thresholds.",
    relevantMetrics: ["hrv"],
  },
  {
    id: "temp-mania-2025",
    title:
      "State-dependent skin temperature increase during manic episodes of bipolar disorder",
    authors: "Valenzuela-Pascual et al.",
    journal: "Journal of Affective Disorders",
    year: 2025,
    url: "https://doi.org/10.1016/j.jad.2025.119643",
    finding:
      "In 104 people with bipolar disorder and 35 healthy controls wearing a research wristband (Empatica E4), waking-hours wrist skin temperature was about 0.8 °C higher in mania than in euthymia (95% CI 0.02 to 1.62) and fell after remission; depression showed no difference. It compares different groups of people and does not validate Oura's overnight temperature deviation.",
    relevantMetrics: ["temperatureDeviation"],
  },
  {
    id: "circadian-relapse-2021",
    title:
      "Association between circadian activity rhythms and mood episode relapse in bipolar disorder: a 12-month prospective cohort study",
    authors: "Esaki et al.",
    journal: "Translational Psychiatry",
    year: 2021,
    url: "https://doi.org/10.1038/s41398-021-01652-9",
    finding:
      "In 189 outpatients with bipolar disorder (mostly type II) wearing a wrist accelerometer for 7 days, a stronger daily activity rhythm went with fewer mood episodes over the next 12 months; later-starting activity went with more depressive episodes, and higher intradaily variability (a more fragmented rhythm) with more manic, hypomanic or mixed ones (37 people). Interdaily stability showed no clear link. It measures long-term risk, not near-term change, and does not validate this app's implementation.",
    relevantMetrics: [
      "circadianIS",
      "circadianIV",
      "circadianRA",
      "activityLevel",
    ],
  },
  {
    id: "composite-accuracy-2024",
    title:
      "Accurately predicting mood episodes in mood disorder patients using wearable sleep and circadian rhythm features",
    authors: "Lim et al.",
    journal: "npj Digital Medicine",
    year: 2024,
    url: "https://doi.org/10.1038/s41746-024-01333-z",
    finding:
      "In 168 people with depression or bipolar disorder wearing a Fitbit, a gradient-boosted model using 36 sleep and estimated circadian-phase features plus each person's past mood episodes reported next-day AUCs of 0.80 (depressive), 0.98 (manic) and 0.95 (hypomanic episodes). AUC does not show how many alerts would be false, and the results do not validate this app's weighted score.",
    relevantMetrics: [
      "bedtimeShift",
      "wakeTimeShift",
      "sleepTimingScore",
      "sleepDuration",
    ],
  },
  {
    id: "sleep-architecture-bipolar",
    title: "The role of sleep in bipolar disorder",
    authors: "Gold & Sylvia",
    journal: "Nature and Science of Sleep",
    year: 2016,
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4935164/",
    finding:
      "This review describes sleep disturbance at every stage of bipolar disorder and links it to dysregulation of the body clock and of sleep pressure. It lists shorter total sleep time among markers of manic episodes and cites one study in which poor sleep predicted an earlier recurrence. Its sleep-stage findings come from lab sleep studies, so it does not validate Oura stage percentages or this app's thresholds.",
    relevantMetrics: ["sleepDuration", "latency"],
  },
  {
    id: "circadian-causal-2024",
    title:
      "Causal dynamics of sleep, circadian rhythm, and mood symptoms in patients with major depression and bipolar disorder: insights from longitudinal wearable device data",
    authors: "Song et al.",
    journal: "eBioMedicine",
    year: 2024,
    url: "https://doi.org/10.1016/j.ebiom.2024.105094",
    finding:
      "In 139 patients with major depression or bipolar disorder wearing a Fitbit and rating their mood daily, disturbances in a circadian phase estimated from sleep times came before mood symptoms in major depression and bipolar I, but not bipolar II; sleep timing alone showed no such link. The phase was estimated by a mathematical model, not measured, so this does not validate this app's sleep-timing or activity-rhythm scores.",
    relevantMetrics: [],
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
  { missing: "Subjective mood", impact: "Sleep and activity data cannot show how you feel", mitigation: "Daily mood check-in" },
  { missing: "Medication adherence", impact: "Cannot tell whether a change in sleep follows a medication change", mitigation: "Doses are logged separately and are not part of the pattern score" },
  { missing: "Life events/context", impact: "Cannot tell whether a change comes from an outside event such as travel, illness or a late night", mitigation: "Tags on mood entries" },
  { missing: "Speech patterns", impact: "Cannot see changes in how fast or loud you talk", mitigation: "Acknowledged limitation" },
  { missing: "Cognitive performance", impact: "Cannot see changes in attention or reaction time", mitigation: "Acknowledged limitation" },
  { missing: "Social activity", impact: "Cannot see changes in how much time you spend with other people", mitigation: "Add as mood tag" },
  { missing: "Phone usage patterns", impact: "Cannot see how you use your phone", mitigation: "Outside Oura domain" },
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
    "circadianIV",
    "withinNightHrvCV",
    "temperatureDelta",
    "temperatureDeviation",
    "sleepDuration",
  ];
  const hypoMetrics = [
    "activityLevel",
    "steps",
    "sleepDuration",
    "bedtimeShift",
  ];
  const relevantMetrics = direction === "hyper" ? hyperMetrics : hypoMetrics;
  return RESEARCH_REFERENCES.filter((r) =>
    r.relevantMetrics.some((m) => relevantMetrics.includes(m))
  );
}
