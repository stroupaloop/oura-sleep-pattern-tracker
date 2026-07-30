"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MedicationDoseGroups } from "@/components/medication-dose-groups";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { AS_NEEDED_KEY } from "@/lib/medication-schedule";
import { getTodayET, shiftIsoDay } from "@/lib/date-utils";
import { classifyMedicationLogsForEditing } from "@/lib/medication-log";

const MOODS = [
  { value: -3, label: "Very Low", color: "bg-blue-600" },
  { value: -2, label: "Low", color: "bg-blue-500" },
  { value: -1, label: "Slightly Low", color: "bg-blue-400" },
  { value: 0, label: "Neutral", color: "bg-green-500" },
  { value: 1, label: "Slightly High", color: "bg-amber-400" },
  { value: 2, label: "High", color: "bg-amber-500" },
  { value: 3, label: "Very High", color: "bg-amber-600" },
];

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

export function DailyLogCard({
  initialDay,
  medications,
  initialMood,
  initialMedLogs,
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
  const [showMore, setShowMore] = useState(false);
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
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Daily Log</CardTitle>
            {lastSavedAt && (
              <span className="text-xs text-muted-foreground">
                Saved {lastSavedAt}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm">
            <button
              onClick={() => navigateDay(-1)}
              className="p-1 rounded hover:bg-muted transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <label className="relative cursor-pointer">
              <span className="px-2 py-0.5 rounded hover:bg-muted transition-colors text-sm font-medium">
                {formatDisplayDate(selectedDay)}
              </span>
              <input
                type="date"
                value={selectedDay}
                max={todayStr}
                onChange={handleDateInput}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
            <button
              onClick={() => navigateDay(1)}
              disabled={isToday}
              className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-30"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Mood</p>
          <div className="flex items-start gap-1.5">
            {MOODS.map((m) => {
              const isSelected = moodScore === m.value;
              return (
                <div key={m.value} className="flex flex-col items-center gap-0.5">
                  <button
                    onClick={() => saveMood(m.value)}
                    disabled={loading}
                    className={`w-9 h-9 rounded-md text-xs font-bold transition-all ${m.color} ${
                      isSelected
                        ? "opacity-100 ring-2 ring-white ring-offset-1 ring-offset-background scale-110"
                        : "opacity-50 hover:opacity-80"
                    }`}
                  >
                    {m.value > 0 ? `+${m.value}` : m.value}
                  </button>
                  {isSelected && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {m.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {dayMeds.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Medications</p>
            <MedicationDoseGroups
              medications={dayMeds}
              checks={medStates}
              disabled={loading}
              compact
              onCheckedChange={(dose, checked) =>
                saveMedSlot(dose.medId, dose.slotKey, checked)
              }
            />
            {unclassifiedLegacyCount > 0 && (
              <p className="mt-2 text-xs text-amber-300">
                {unclassifiedLegacyCount} legacy medication{" "}
                {unclassifiedLegacyCount === 1 ? "record has" : "records have"}{" "}
                an unknown dose-slot classification.{" "}
                {unclassifiedLegacyCount === 1 ? "It is" : "They are"} retained
                in reports but not editable here.
              </p>
            )}
          </div>
        )}

        {saveError && (
          <p className="text-xs text-red-400" role="alert">
            {saveError}
          </p>
        )}

        {moodScore != null && (moodScore <= -2 || moodScore >= 2) && (
          <div>
            <button
              onClick={() =>
                saveEpisode(moodScore <= -2 ? "depressive" : "hypomanic")
              }
              disabled={loading}
              className={`px-3 py-1 text-xs rounded-full transition-all ${
                episodeState === (moodScore <= -2 ? "depressive" : "hypomanic")
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {moodScore <= -2
                ? "Log as depressive episode?"
                : "Log as hypo/manic episode?"}
            </button>
          </div>
        )}

        <button
          onClick={() => setShowMore(!showMore)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {showMore ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showMore ? "Less" : "More"} (tags, notes)
        </button>

        {showMore && (
          <div className="space-y-3 pt-1">
            {moodScore == null && (
              <p className="text-xs text-muted-foreground">
                Choose a mood before adding tags or notes.
              </p>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    disabled={loading || moodScore == null}
                    className={`px-2.5 py-0.5 text-xs rounded-full transition-colors ${
                      selectedTags.includes(tag)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tag.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Notes</p>
              <textarea
                placeholder="Any notes? (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveNotes}
                disabled={loading || moodScore == null}
                className="w-full rounded-md border bg-transparent px-2 py-1.5 text-sm placeholder:text-muted-foreground"
                rows={4}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
