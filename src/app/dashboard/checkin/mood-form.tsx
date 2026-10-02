"use client";

import { useState, useCallback } from "react";
import { ChevronDown, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { DayNavigator } from "@/components/ui/day-navigator";
import { FormMessage } from "@/components/ui/form-message";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { MedicationDoseGroups } from "@/components/medication-dose-groups";
import {
  AS_NEEDED_KEY,
  doseSlotLabel,
  slotsForMedication,
} from "@/lib/medication-schedule";
import { getTodayET, shiftIsoDay } from "@/lib/date-utils";
import { useDayRollover } from "@/lib/day-rollover";
import { classifyMedicationLogsForEditing } from "@/lib/medication-log";
import { EPISODE_STATES } from "@/lib/episode-states";
import { formatMoodValue, moodLabel } from "@/lib/design/mood-scale";
import { MoodScalePicker } from "@/components/mood-scale-picker";
import type { EpisodePatternSummary } from "@/lib/episode-pattern";
import { PatternStatus } from "@/components/pattern-status";

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

interface MedicationItem {
  id: number;
  name: string;
  dosage: string | null;
  frequency: string | null;
  doseSchedule: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

type MedCheckMap = Record<number, Record<string, boolean>>;

interface MedLog {
  medicationId: number;
  slot: string | null;
  taken: number;
}

function buildMedChecks(
  meds: MedicationItem[],
  logs: MedLog[]
): MedCheckMap {
  const map: MedCheckMap = {};
  for (const med of meds) {
    const slots = slotsForMedication(med);
    const inner: Record<string, boolean> = {};
    if (slots.length === 0) {
      inner[AS_NEEDED_KEY] = false;
    } else {
      for (const s of slots) inner[s] = false;
    }
    map[med.id] = inner;
  }
  const { editableLogs } = classifyMedicationLogsForEditing(meds, logs);
  for (const log of editableLogs) {
    if (!map[log.medicationId]) continue;
    const key = log.slot ?? AS_NEEDED_KEY;
    map[log.medicationId][key] = log.taken === 1;
  }
  return map;
}

function buildMedTouched(
  meds: MedicationItem[],
  logs: MedLog[]
): MedCheckMap {
  const touched: MedCheckMap = {};
  const { editableLogs } = classifyMedicationLogsForEditing(meds, logs);
  for (const log of editableLogs) {
    const key = log.slot ?? AS_NEEDED_KEY;
    touched[log.medicationId] = {
      ...(touched[log.medicationId] ?? {}),
      [key]: true,
    };
  }
  return touched;
}

interface ExistingMood {
  moodScore: number;
  energyScore: number | null;
  irritabilityScore: number | null;
  anxietyScore: number | null;
  sleepSubjective: number | null;
  notes: string | null;
  tags: string | null;
  episodeState: string | null;
  createdAt?: number | null;
}

interface MoodFormProps {
  initialDay: string;
  existingMood: ExistingMood | null;
  medications: MedicationItem[];
  existingMedLogs: MedLog[];
  episodePattern: EpisodePatternSummary | null;
}

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatDisplayDate(dateStr: string): string {
  const todayStr = getTodayET();
  const yesterdayStr = shiftIsoDay(todayStr, -1);

  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";

  return formatShortDate(dateStr);
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

function shiftDay(dateStr: string, delta: number): string {
  return shiftIsoDay(dateStr, delta) ?? dateStr;
}

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  try {
    return JSON.parse(tags);
  } catch {
    return [];
  }
}

function medicationsForDay(
  medications: MedicationItem[],
  day: string
): MedicationItem[] {
  return medications.filter((medication) => {
    if (medication.startDate && medication.startDate > day) return false;
    if (medication.endDate && medication.endDate < day) return false;
    return true;
  });
}

/**
 * Keyed by day, so when the page refreshes onto a new day the form starts
 * over from that day's data instead of keeping yesterday's.
 */
export function MoodForm(props: MoodFormProps) {
  useDayRollover(props.initialDay);
  return <MoodFormForDay key={props.initialDay} {...props} />;
}

function MoodFormForDay({
  initialDay,
  existingMood,
  medications,
  existingMedLogs,
  episodePattern,
}: MoodFormProps) {
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [moodScore, setMoodScore] = useState<number | null>(existingMood?.moodScore ?? null);
  const [energy, setEnergy] = useState(existingMood?.energyScore ?? 3);
  const [irritability, setIrritability] = useState(existingMood?.irritabilityScore ?? 1);
  const [anxiety, setAnxiety] = useState(existingMood?.anxietyScore ?? 1);
  const [sleepSubjective, setSleepSubjective] = useState(existingMood?.sleepSubjective ?? 3);
  const [episodeState, setEpisodeState] = useState<string | null>(existingMood?.episodeState ?? null);
  const [notes, setNotes] = useState(existingMood?.notes ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(parseTags(existingMood?.tags ?? null));
  const [medChecks, setMedChecks] = useState<MedCheckMap>(() =>
    buildMedChecks(medications, existingMedLogs)
  );
  const [medTouched, setMedTouched] = useState<MedCheckMap>(() =>
    buildMedTouched(medications, existingMedLogs)
  );
  const [unclassifiedLegacyCount, setUnclassifiedLegacyCount] = useState(
    () =>
      classifyMedicationLogsForEditing(medications, existingMedLogs)
        .unclassifiedLegacyCount
  );
  const [showOptional, setShowOptional] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    existingMood?.createdAt
      ? new Date(existingMood.createdAt * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : null
  );

  const loadDayData = useCallback(async (day: string) => {
    setLoadingDay(true);
    setSaved(false);
    setLastSavedAt(null);
    try {
      const [moodRes, medRes] = await Promise.all([
        fetch(`/api/mood?day=${day}`),
        fetch(`/api/medications/log?start=${day}&end=${day}`),
      ]);
      const moodData = await moodRes.json();
      const medData = await medRes.json();

      if (moodData) {
        setMoodScore(moodData.moodScore ?? null);
        setEpisodeState(moodData.episodeState ?? null);
        setEnergy(moodData.energyScore ?? 3);
        setIrritability(moodData.irritabilityScore ?? 1);
        setAnxiety(moodData.anxietyScore ?? 1);
        setSleepSubjective(moodData.sleepSubjective ?? 3);
        setNotes(moodData.notes ?? "");
        setSelectedTags(parseTags(moodData.tags));
        setShowOptional(
          moodData.energyScore !== null ||
          moodData.irritabilityScore !== null ||
          moodData.anxietyScore !== null ||
          moodData.sleepSubjective !== null
        );
        if (moodData.createdAt) {
          setLastSavedAt(
            new Date(moodData.createdAt * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
          );
        }
      } else {
        setMoodScore(null);
        setEpisodeState(null);
        setEnergy(3);
        setIrritability(1);
        setAnxiety(1);
        setSleepSubjective(3);
        setNotes("");
        setSelectedTags([]);
        setShowOptional(false);
      }

      const loadedLogs = medData?.logs ?? [];
      setMedChecks(buildMedChecks(medications, loadedLogs));
      setMedTouched(buildMedTouched(medications, loadedLogs));
      setUnclassifiedLegacyCount(
        classifyMedicationLogsForEditing(medications, loadedLogs)
          .unclassifiedLegacyCount
      );
    } finally {
      setLoadingDay(false);
    }
  }, [medications]);

  function navigateDay(delta: number) {
    const newDay = shiftDay(selectedDay, delta);
    const todayStr = getTodayET();
    if (newDay > todayStr) return;
    setSelectedDay(newDay);
    loadDayData(newDay);
  }

  function handleDateInput(e: React.ChangeEvent<HTMLInputElement>) {
    const newDay = e.target.value;
    if (!newDay) return;
    const todayStr = getTodayET();
    if (newDay > todayStr) return;
    setSelectedDay(newDay);
    loadDayData(newDay);
  }

  async function handleSubmit() {
    if (moodScore === null) return;
    setSaving(true);
    setError(null);
    const failed: string[] = [];
    try {
      const moodRes = await fetch("/api/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: selectedDay,
          moodScore,
          energyScore: showOptional ? energy : undefined,
          irritabilityScore: showOptional ? irritability : undefined,
          anxietyScore: showOptional ? anxiety : undefined,
          sleepSubjective: showOptional ? sleepSubjective : undefined,
          notes: notes || null,
          tags: selectedTags,
          episodeState: episodeState ?? null,
        }),
      });
      if (!moodRes.ok) failed.push("mood");

      async function saveMedLog(medId: number, slot: string | null, taken: boolean, label: string) {
        const res = await fetch("/api/medications/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ medicationId: medId, day: selectedDay, slot, taken }),
        });
        if (!res.ok) failed.push(label);
      }

      for (const med of medicationsForDay(medications, selectedDay)) {
        if (med.frequency === "weekly") continue;
        const slots = slotsForMedication(med);
        const checks = medChecks[med.id] ?? {};
        const touched = medTouched[med.id] ?? {};
        if (slots.length === 0) {
          if (touched[AS_NEEDED_KEY]) {
            await saveMedLog(
              med.id,
              null,
              checks[AS_NEEDED_KEY] ?? false,
              med.name
            );
          }
        } else {
          for (const slot of slots) {
            if (!touched[slot]) continue;
            await saveMedLog(
              med.id,
              slot,
              checks[slot] ?? false,
              `${med.name} (${doseSlotLabel(slot)})`
            );
          }
        }
      }

      if (failed.length > 0) {
        setError(`Couldn't save: ${failed.join(", ")}. Please try again.`);
        return;
      }

      setSaved(true);
      setLastSavedAt(
        new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      );
    } catch {
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const todayStr = getTodayET();
  const isToday = selectedDay === todayStr;
  const dayMedications = medicationsForDay(medications, selectedDay);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-1">
        <DayNavigator
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
        <FormMessage className="text-xs">
          {lastSavedAt && `Saved ${lastSavedAt}`}
        </FormMessage>
      </div>

      {/* Held back until today's answers are in, so the model's flag cannot
          steer the self-report. */}
      {episodePattern && isToday && lastSavedAt && (
        <PatternStatus
          pattern={episodePattern}
          latestCheckedDay={null}
          paused={false}
        />
      )}

      {saved ? (
        <Callout
          tone="neutral"
          icon={CircleCheck}
          title="Check-in saved!"
          role="status"
        >
          <p>
            Your mood data has been recorded for {formatShortDate(selectedDay)}.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSaved(false)}
            className="mt-3 text-foreground"
          >
            Edit
          </Button>
        </Callout>
      ) : (
        <>
          <Panel
            id="checkin-mood"
            title={
              isToday
                ? "How are you feeling today?"
                : formatDisplayDate(selectedDay) === "Yesterday"
                  ? "How were you feeling yesterday?"
                  : `How were you feeling on ${formatDisplayDate(selectedDay)}?`
            }
            description={`Tap your mood level on your personal scale from ${formatMoodValue(-3)} to ${formatMoodValue(3)}`}
          >
            <MoodScalePicker
              value={moodScore}
              onSelect={setMoodScore}
              disabled={loadingDay}
              size="lg"
              className="mx-auto max-w-sm"
            />
            {moodScore !== null && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {moodLabel(moodScore)}
              </p>
            )}
          </Panel>

          {moodScore !== null && (
            <>
              <Panel
                id="checkin-episode"
                title="Episode State"
                description="Optional self-report used as retrospective context, not as an input to the wearable pattern score."
              >
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Optional episode-state self-report"
                >
                  {EPISODE_STATES.map((ep) => (
                    <ToggleChip
                      key={ep.value}
                      pressed={episodeState === ep.value}
                      onClick={() => setEpisodeState(episodeState === ep.value ? null : ep.value)}
                    >
                      {ep.label}
                    </ToggleChip>
                  ))}
                </div>
              </Panel>

              <details
                open={showOptional}
                onToggle={(event) => setShowOptional(event.currentTarget.open)}
                className="group rounded-xl border bg-card"
              >
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground md:px-5 [&::-webkit-details-marker]:hidden">
                  <span>
                    {showOptional ? "Hide" : "Show"} optional details (energy,
                    irritability, anxiety, sleep quality)
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <div className="space-y-4 border-t px-4 py-4 md:px-5">
                  {[
                    { label: "Energy", value: energy, set: setEnergy },
                    { label: "Irritability", value: irritability, set: setIrritability },
                    { label: "Anxiety", value: anxiety, set: setAnxiety },
                    { label: "Sleep Quality", value: sleepSubjective, set: setSleepSubjective },
                  ].map(({ label, value, set }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm">{label}</span>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        value={value}
                        aria-label={label}
                        onChange={(e) => set(Number(e.target.value))}
                        className="h-10 min-w-0 flex-1 accent-primary sm:h-8"
                      />
                      <span className="w-8 text-right text-sm tabular-nums">{value}/5</span>
                    </div>
                  ))}
                </div>
              </details>

              <Panel id="checkin-notes" title="Notes">
                <Textarea
                  aria-label="Notes"
                  placeholder="Any notes? (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="min-h-24"
                />
              </Panel>

              <Panel id="checkin-tags" title="Tags">
                <div className="flex flex-wrap gap-2">
                  {TAGS.map((tag) => (
                    <ToggleChip
                      key={tag}
                      pressed={selectedTags.includes(tag)}
                      onClick={() =>
                        setSelectedTags((prev) =>
                          prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                        )
                      }
                    >
                      {tag.replace("_", " ")}
                    </ToggleChip>
                  ))}
                </div>
              </Panel>

              {dayMedications.length > 0 && (
                <Panel id="checkin-medications" title="Medications">
                  <MedicationDoseGroups
                    medications={dayMedications}
                    checks={medChecks}
                    disabled={saving || loadingDay}
                    onCheckedChange={(dose, checked) => {
                      setMedChecks((prev) => ({
                        ...prev,
                        [dose.medId]: {
                          ...(prev[dose.medId] ?? {}),
                          [dose.slotKey]: checked,
                        },
                      }));
                      setMedTouched((prev) => ({
                        ...prev,
                        [dose.medId]: {
                          ...(prev[dose.medId] ?? {}),
                          [dose.slotKey]: true,
                        },
                      }));
                    }}
                  />
                  {unclassifiedLegacyCount > 0 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {unclassifiedLegacyCount} legacy medication{" "}
                      {unclassifiedLegacyCount === 1
                        ? "record has"
                        : "records have"}{" "}
                      an unknown dose-slot classification.{" "}
                      {unclassifiedLegacyCount === 1 ? "It is" : "They are"}{" "}
                      retained in reports but not editable here.
                    </p>
                  )}
                </Panel>
              )}

              <div className="space-y-3">
                <FormMessage kind="error" className="text-center">
                  {error}
                </FormMessage>
                <Button onClick={handleSubmit} disabled={saving || loadingDay} className="w-full">
                  {saving ? "Saving..." : "Save Check-in"}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
