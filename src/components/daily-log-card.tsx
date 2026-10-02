"use client";

import { useState, useCallback } from "react";
import { MedicationDoseGroups } from "@/components/medication-dose-groups";
import { DayNavigator } from "@/components/ui/day-navigator";
import { FormMessage } from "@/components/ui/form-message";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { AS_NEEDED_KEY } from "@/lib/medication-schedule";
import { getTodayET, shiftIsoDay } from "@/lib/date-utils";
import { useDayRollover } from "@/lib/day-rollover";
import { classifyMedicationLogsForEditing } from "@/lib/medication-log";
import { EPISODE_STATES } from "@/lib/episode-states";
import { moodLabel } from "@/lib/design/mood-scale";
import { MoodScalePicker } from "@/components/mood-scale-picker";

const TAGS = [
  "travel",
  "illness",
  "stressor",
  "alcohol",
  "medication_change",
  "exercise",
  "social",
  "poor_sleep",
];

interface Medication {
  id: number;
  name: string;
  dosage: string | null;
  frequency: string | null;
  doseSchedule: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface DailyLogCardProps {
  initialDay: string;
  medications: Medication[];
  initialMood: {
    moodScore: number;
    episodeState: string | null;
    tags: string | null;
    notes: string | null;
  } | null;
  initialMedLogs: { medicationId: number; slot: string | null; taken: number }[];
  /** A tighter layout for narrow spots such as the dashboard's side column. */
  dense?: boolean;
}

type MedCheckMap = Record<number, Record<string, boolean>>;

function buildMedicationState(
  medications: Medication[],
  logs: DailyLogCardProps["initialMedLogs"]
): { checks: MedCheckMap; unclassifiedLegacyCount: number } {
  const map: MedCheckMap = {};
  for (const med of medications) map[med.id] = {};

  const classified = classifyMedicationLogsForEditing(medications, logs);
  for (const log of classified.editableLogs) {
    const inner = map[log.medicationId] ?? (map[log.medicationId] = {});
    const key = log.slot ?? AS_NEEDED_KEY;
    inner[key] = log.taken === 1;
  }
  return {
    checks: map,
    unclassifiedLegacyCount: classified.unclassifiedLegacyCount,
  };
}

function formatDisplayDate(dateStr: string): string {
  const todayStr = getTodayET();
  const yesterdayStr = shiftIsoDay(todayStr, -1);

  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";

  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function shiftDay(dateStr: string, delta: number): string {
  return shiftIsoDay(dateStr, delta) ?? dateStr;
}

function medsForDay(allMeds: Medication[], day: string): Medication[] {
  return allMeds.filter((med) => {
    if (med.startDate && med.startDate > day) return false;
    if (med.endDate && med.endDate < day) return false;
    return true;
  });
}

function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  try {
    return JSON.parse(tags);
  } catch {
    return [];
  }
}

function DayLabel({
  day,
  max,
  onChange,
}: {
  day: string;
  max: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="relative flex min-h-10 cursor-pointer items-center rounded-md px-3 transition-colors hover:bg-accent/50 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 sm:min-h-9">
      {formatDisplayDate(day)}
      <input
        type="date"
        value={day}
        max={max}
        onChange={onChange}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}

/**
 * Keyed by day, so when the page refreshes onto a new day the card starts
 * over from that day's data instead of keeping yesterday's.
 */
export function DailyLogCard(props: DailyLogCardProps) {
  useDayRollover(props.initialDay);
  return <DailyLogCardForDay key={props.initialDay} {...props} />;
}

function DailyLogCardForDay({
  initialDay,
  medications,
  initialMood,
  initialMedLogs,
  dense = false,
}: DailyLogCardProps) {
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [moodScore, setMoodScore] = useState<number | null>(
    initialMood?.moodScore ?? null
  );
  const [medStates, setMedStates] = useState<MedCheckMap>(
    () => buildMedicationState(medications, initialMedLogs).checks
  );
  const [unclassifiedLegacyCount, setUnclassifiedLegacyCount] = useState(
    () =>
      buildMedicationState(medications, initialMedLogs)
        .unclassifiedLegacyCount
  );
  const [episodeState, setEpisodeState] = useState<string | null>(
    initialMood?.episodeState ?? null
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(
    parseTags(initialMood?.tags)
  );
  const [notes, setNotes] = useState(initialMood?.notes ?? "");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const showSaved = useCallback(() => {
    setSaveError(null);
    const now = new Date();
    setLastSavedAt(
      now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    );
  }, []);

  async function fetchDayData(day: string) {
    setLoading(true);
    try {
      const [moodRes, medRes] = await Promise.all([
        fetch(`/api/mood?day=${day}`),
        fetch(`/api/medications/log?start=${day}&end=${day}`),
      ]);
      const moodData = await moodRes.json();
      const medData = await medRes.json();

      setMoodScore(moodData?.moodScore ?? null);
      setEpisodeState(moodData?.episodeState ?? null);
      setSelectedTags(parseTags(moodData?.tags));
      setNotes(moodData?.notes ?? "");
      if (moodData?.createdAt) {
        const d = new Date(moodData.createdAt * 1000);
        setLastSavedAt(d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
      } else {
        setLastSavedAt(null);
      }

      const medicationState = buildMedicationState(
        medications,
        Array.isArray(medData.logs) ? medData.logs : []
      );
      setMedStates(medicationState.checks);
      setUnclassifiedLegacyCount(
        medicationState.unclassifiedLegacyCount
      );
    } finally {
      setLoading(false);
    }
  }

  function navigateDay(delta: number) {
    const newDay = shiftDay(selectedDay, delta);
    const todayStr = getTodayET();
    if (newDay > todayStr) return;
    setSelectedDay(newDay);
    fetchDayData(newDay);
  }

  function handleDateInput(e: React.ChangeEvent<HTMLInputElement>) {
    const newDay = e.target.value;
    if (!newDay) return;
    const todayStr = getTodayET();
    if (newDay > todayStr) return;
    setSelectedDay(newDay);
    fetchDayData(newDay);
  }

  async function saveMood(score: number) {
    const previousScore = moodScore;
    setMoodScore(score);
    setSaveError(null);
    try {
      const response = await fetch("/api/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: selectedDay,
          moodScore: score,
        }),
      });
      if (!response.ok) throw new Error("save failed");
      showSaved();
    } catch {
      setMoodScore(previousScore);
      setSaveError("Mood was not saved. Please try again.");
    }
  }

  async function saveEpisode(value: string) {
    const previousValue = episodeState;
    const newValue = episodeState === value ? null : value;
    setEpisodeState(newValue);
    setSaveError(null);
    try {
      const response = await fetch("/api/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: selectedDay,
          episodeState: newValue,
        }),
      });
      if (!response.ok) throw new Error("save failed");
      showSaved();
    } catch {
      setEpisodeState(previousValue);
      setSaveError("Episode state was not saved. Please try again.");
    }
  }

  async function saveMedSlot(medId: number, slot: string, newState: boolean) {
    const currentState = medStates[medId]?.[slot] ?? false;
    setMedStates((prev) => ({
      ...prev,
      [medId]: { ...(prev[medId] ?? {}), [slot]: newState },
    }));
    try {
      setSaveError(null);
      const res = await fetch("/api/medications/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicationId: medId,
          day: selectedDay,
          slot: slot === AS_NEEDED_KEY ? null : slot,
          taken: newState,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      showSaved();
    } catch {
      setMedStates((prev) => ({
        ...prev,
        [medId]: { ...(prev[medId] ?? {}), [slot]: currentState },
      }));
      setSaveError("Medication status was not saved. Please try again.");
    }
  }

  async function toggleTag(tag: string) {
    if (moodScore == null) return;
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(newTags);
    setSaveError(null);
    try {
      const response = await fetch("/api/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: selectedDay,
          tags: newTags,
        }),
      });
      if (!response.ok) throw new Error("save failed");
      showSaved();
    } catch {
      setSelectedTags(selectedTags);
      setSaveError("Tags were not saved. Please try again.");
    }
  }

  async function saveNotes() {
    if (moodScore == null) return;
    setSaveError(null);
    try {
      const response = await fetch("/api/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: selectedDay,
          notes: notes || null,
        }),
      });
      if (!response.ok) throw new Error("save failed");
      showSaved();
    } catch {
      setSaveError("Notes were not saved. Please try again.");
    }
  }

  const todayStr = getTodayET();
  const isToday = selectedDay === todayStr;
  const dayMeds = medsForDay(medications, selectedDay);

  return (
    <Panel
      id="daily-log"
      title="Daily Log"
      meta={
        <FormMessage className="text-xs">
          {lastSavedAt && `Saved ${lastSavedAt}`}
        </FormMessage>
      }
    >
      <div className="space-y-4">
        <DayNavigator
          className="-mx-2 justify-between"
          label={
            <DayLabel
              day={selectedDay}
              max={todayStr}
              onChange={handleDateInput}
            />
          }
          onPrevious={() => navigateDay(-1)}
          onNext={() => navigateDay(1)}
          nextDisabled={isToday}
        />

        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">
            Mood
            {moodScore != null && (
              <span className="text-foreground"> · {moodLabel(moodScore)}</span>
            )}
          </p>
          <MoodScalePicker
            value={moodScore}
            onSelect={saveMood}
            disabled={loading}
            dense={dense}
          />
        </div>

        {dayMeds.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Medications</p>
            <MedicationDoseGroups
              medications={dayMeds}
              checks={medStates}
              disabled={loading}
              compact
              layout={dense ? "inline" : "rows"}
              onCheckedChange={(dose, checked) =>
                saveMedSlot(dose.medId, dose.slotKey, checked)
              }
            />
            {unclassifiedLegacyCount > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {unclassifiedLegacyCount} legacy medication{" "}
                {unclassifiedLegacyCount === 1 ? "record has" : "records have"}{" "}
                an unknown dose-slot classification.{" "}
                {unclassifiedLegacyCount === 1 ? "It is" : "They are"} retained
                in reports but not editable here.
              </p>
            )}
          </div>
        )}

        <FormMessage kind="error">{saveError}</FormMessage>

        <div className={dense ? "space-y-3" : "space-y-4"}>
          {moodScore == null && (
            <p className="text-xs text-muted-foreground">
              Choose a mood before adding an episode state, notes, or tags.
            </p>
          )}
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Episode state</p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Optional episode-state self-report"
            >
              {EPISODE_STATES.map((state) => (
                <ToggleChip
                  key={state.value}
                  pressed={episodeState === state.value}
                  onClick={() => saveEpisode(state.value)}
                  disabled={loading || moodScore == null}
                >
                  {state.label}
                </ToggleChip>
              ))}
            </div>
          </div>
          {/* Notes sit between the two rows of chips so episode state and
              tags do not read as one list. */}
          <div>
            <label
              htmlFor="daily-log-notes"
              className="mb-1.5 block text-xs text-muted-foreground"
            >
              Notes
            </label>
            <Textarea
              id="daily-log-notes"
              placeholder="Any notes? (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              disabled={loading || moodScore == null}
              rows={dense ? 3 : 4}
              className={dense ? "min-h-20" : "min-h-24"}
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Tags</p>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((tag) => (
                <ToggleChip
                  key={tag}
                  pressed={selectedTags.includes(tag)}
                  onClick={() => toggleTag(tag)}
                  disabled={loading || moodScore == null}
                >
                  {tag.replace("_", " ")}
                </ToggleChip>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
