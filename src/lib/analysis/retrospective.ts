export type PatternDirection = "hyper" | "hypo";
export type RetrospectiveDirection = PatternDirection | "mixed";

export interface RetrospectiveAssessment {
  day: string;
  tier: string;
  direction: string | null;
  evaluable: boolean;
}

export interface RetrospectiveLabel {
  day: string;
  episodeState: string | null;
}

export interface LabelledEvent {
  startDay: string;
  endDay: string;
  episodeState: string;
  direction: RetrospectiveDirection;
}

export interface RetrospectiveAgreement {
  explicitLabelDays: number;
  labelledEvents: number;
  evaluableEvents: number;
  eventsWithMatchingFlag: number;
  missedEvents: number;
  medianLeadDays: number | null;
  minimumCoverageDays: number;
  lookbackDays: number;
}

interface FlagWindow {
  id: number;
  startDay: string;
  endDay: string;
  direction: PatternDirection;
  days: string[];
}

function parseIsoDay(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shiftIsoDay(day: string, offset: number): string | null {
  const date = parseIsoDay(day);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function dayDifference(laterDay: string, earlierDay: string): number {
  const later = parseIsoDay(laterDay);
  const earlier = parseIsoDay(earlierDay);
  if (!later || !earlier) return 0;
  return Math.round((later.getTime() - earlier.getTime()) / 86_400_000);
}

function isNextDay(previousDay: string, day: string): boolean {
  return shiftIsoDay(previousDay, 1) === day;
}

export function directionForEpisodeState(
  state: string | null
): RetrospectiveDirection | null {
  if (state === "depressive") return "hypo";
  if (state === "hypomanic" || state === "manic") return "hyper";
  if (state === "mixed") return "mixed";
  return null;
}

export function groupLabelledEvents(
  labels: RetrospectiveLabel[]
): LabelledEvent[] {
  const ordered = labels
    .map((label) => ({
      ...label,
      direction: directionForEpisodeState(label.episodeState),
    }))
    .filter(
      (
        label
      ): label is RetrospectiveLabel & {
        episodeState: string;
        direction: RetrospectiveDirection;
      } => label.direction !== null && label.episodeState !== null
    )
    .sort((a, b) => a.day.localeCompare(b.day));

  const events: LabelledEvent[] = [];
  for (const label of ordered) {
    const previous = events[events.length - 1];
    if (
      previous &&
      previous.episodeState === label.episodeState &&
      isNextDay(previous.endDay, label.day)
    ) {
      previous.endDay = label.day;
      continue;
    }
    events.push({
      startDay: label.day,
      endDay: label.day,
      episodeState: label.episodeState,
      direction: label.direction,
    });
  }
  return events;
}

function groupFlagWindows(
  assessments: RetrospectiveAssessment[]
): FlagWindow[] {
  const ordered = assessments
    .filter(
      (
        assessment
      ): assessment is RetrospectiveAssessment & {
        direction: PatternDirection;
      } =>
        assessment.evaluable &&
        assessment.tier !== "none" &&
        (assessment.direction === "hyper" ||
          assessment.direction === "hypo")
    )
    .sort((a, b) => a.day.localeCompare(b.day));

  const windows: FlagWindow[] = [];
  for (const assessment of ordered) {
    const previous = windows[windows.length - 1];
    if (
      previous &&
      previous.direction === assessment.direction &&
      isNextDay(previous.endDay, assessment.day)
    ) {
      previous.endDay = assessment.day;
      previous.days.push(assessment.day);
      continue;
    }
    windows.push({
      id: windows.length,
      startDay: assessment.day,
      endDay: assessment.day,
      direction: assessment.direction,
      days: [assessment.day],
    });
  }
  return windows;
}

function directionsMatch(
  eventDirection: RetrospectiveDirection,
  flagDirection: PatternDirection
): boolean {
  return eventDirection === "mixed" || eventDirection === flagDirection;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function evaluateRetrospectiveAgreement(
  assessments: RetrospectiveAssessment[],
  labels: RetrospectiveLabel[],
  options: { lookbackDays?: number; minimumCoverageDays?: number } = {}
): RetrospectiveAgreement {
  const lookbackDays = options.lookbackDays ?? 7;
  const minimumCoverageDays = options.minimumCoverageDays ?? 3;
  const events = groupLabelledEvents(labels);
  const explicitLabelDays = new Set(
    labels
      .filter((label) => label.episodeState !== null)
      .map((label) => label.day)
  ).size;
  const assessmentDays = new Set(
    assessments
      .filter((assessment) => assessment.evaluable)
      .map((assessment) => assessment.day)
  );
  const flagWindows = groupFlagWindows(assessments);
  const evaluableEvents: {
    event: LabelledEvent;
    startDay: string;
    candidateWindows: FlagWindow[];
  }[] = [];

  for (const event of events) {
    const start = shiftIsoDay(event.startDay, -lookbackDays);
    if (!start) continue;

    let coverageDays = 0;
    for (
      let day = start;
      day <= event.startDay;
      day = shiftIsoDay(day, 1) ?? "9999-12-31"
    ) {
      if (assessmentDays.has(day)) coverageDays++;
    }
    if (coverageDays < minimumCoverageDays) continue;
    evaluableEvents.push({
      event,
      startDay: start,
      candidateWindows: flagWindows
        .filter(
          (window) =>
            window.endDay >= start &&
            window.startDay <= event.startDay &&
            directionsMatch(event.direction, window.direction)
        )
        .sort((a, b) => b.startDay.localeCompare(a.startDay)),
    });
  }

  if (events.length === 0) {
    return {
      explicitLabelDays,
      labelledEvents: 0,
      evaluableEvents: 0,
      eventsWithMatchingFlag: 0,
      missedEvents: 0,
      medianLeadDays: null,
      minimumCoverageDays,
      lookbackDays,
    };
  }

  const eventForWindow = new Map<number, number>();
  const windowForEvent = new Map<number, FlagWindow>();

  function matchEvent(
    eventIndex: number,
    visitedWindowIds: Set<number>
  ): boolean {
    for (const window of evaluableEvents[eventIndex].candidateWindows) {
      if (visitedWindowIds.has(window.id)) continue;
      visitedWindowIds.add(window.id);

      const existingEventIndex = eventForWindow.get(window.id);
      if (
        existingEventIndex === undefined ||
        matchEvent(existingEventIndex, visitedWindowIds)
      ) {
        eventForWindow.set(window.id, eventIndex);
        windowForEvent.set(eventIndex, window);
        return true;
      }
    }
    return false;
  }

  for (let index = 0; index < evaluableEvents.length; index++) {
    matchEvent(index, new Set());
  }

  const leadDays = [...windowForEvent.entries()]
    .map(([eventIndex, window]) => {
      const evaluableEvent = evaluableEvents[eventIndex];
      const earliestFlagDay = window.days
        .filter(
          (day) =>
            day >= evaluableEvent.startDay &&
            day <= evaluableEvent.event.startDay
        )
        .sort()[0];
      return earliestFlagDay
        ? dayDifference(evaluableEvent.event.startDay, earliestFlagDay)
        : null;
    })
    .filter((leadDay): leadDay is number => leadDay !== null);
  const eventsWithMatchingFlag = windowForEvent.size;

  return {
    explicitLabelDays,
    labelledEvents: events.length,
    evaluableEvents: evaluableEvents.length,
    eventsWithMatchingFlag,
    missedEvents: evaluableEvents.length - eventsWithMatchingFlag,
    medianLeadDays: median(leadDays),
    minimumCoverageDays,
    lookbackDays,
  };
}
