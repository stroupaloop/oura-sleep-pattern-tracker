"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { getTodayET } from "@/lib/date-utils";

const MOODS = [
  { value: -3, label: "Depressed", color: "bg-blue-600" },
  { value: -2, label: "Low", color: "bg-blue-500" },
  { value: -1, label: "Slightly Low", color: "bg-blue-400" },
  { value: 0, label: "Neutral", color: "bg-green-500" },
  { value: 1, label: "Slightly High", color: "bg-amber-400" },
  { value: 2, label: "High", color: "bg-amber-500" },
  { value: 3, label: "Manic", color: "bg-amber-600" },
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

const SLOTS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
] as const;
type Slot = (typeof SLOTS)[number]["value"];
const AS_NEEDED_KEY = "as_needed";

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
  initialMood: { moodScore: number } | null;
  initialMedLogs: { medicationId: number; slot: string | null; taken: number }[];
  initialEpisodeState: string | null;
}

type MedCheckMap = Record<number, Record<string, boolean>>;

function parseSchedule(raw: string | null | undefined): Slot[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((s): s is Slot =>
      SLOTS.some((slot) => slot.value === s)
    );
  } catch {
    return [];
  }
}

function slotsForMed(med: Medication): Slot[] {
  if (med.frequency === "as_needed") return [];
  const parsed = parseSchedule(med.doseSchedule);
  if (parsed.length > 0) return parsed;
  return med.frequency === "twice_daily"
    ? ["morning", "evening"]
    : ["morning"];
}

function slotLabel(slot: Slot): string {
  return SLOTS.find((s) => s.value === slot)?.label ?? slot;
}

function slotPillClass(key: string): string {
  switch (key) {
    case "morning":
      return "bg-amber-500/10 text-amber-400";
    case "afternoon":
      return "bg-orange-500/10 text-orange-400";
    case "evening":
      return "bg-indigo-500/10 text-indigo-300";
    case "night":
      return "bg-slate-500/20 text-slate-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

type DoseEntry = {
  medId: number;
  medName: string;
  dosage: string | null;
  slotKey: string;
  pillLabel: string;
};

const SLOT_ORDER: Record<string, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  night: 3,
  [AS_NEEDED_KEY]: 4,
};

function buildDoses(meds: Medication[]): DoseEntry[] {
  const doses = meds.flatMap((med) => {
    const slots = slotsForMed(med);
    if (slots.length === 0) {
      return [
        {
          medId: med.id,
          medName: med.name,
          dosage: med.dosage,
          slotKey: AS_NEEDED_KEY,
          pillLabel: "PRN",
        },
      ];
    }
    return slots.map((slot) => ({
      medId: med.id,
      medName: med.name,
      dosage: med.dosage,
      slotKey: slot,
      pillLabel: slotLabel(slot).toUpperCase(),
    }));
  });
  return doses.sort((a, b) => {
    const slotDiff = (SLOT_ORDER[a.slotKey] ?? 99) - (SLOT_ORDER[b.slotKey] ?? 99);
    if (slotDiff !== 0) return slotDiff;
    return a.medName.localeCompare(b.medName);
  });
}

function formatDisplayDate(dateStr: string): string {
  const todayStr = getTodayET();
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const yesterday = new Date(ty, tm - 1, td);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";

  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function shiftDay(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return date.toISOString().slice(0, 10);
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
  initialEpisodeState,
}: DailyLogCardProps) {
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [moodScore, setMoodScore] = useState<number | null>(
    initialMood?.moodScore ?? null
  );
  const [medStates, setMedStates] = useState<MedCheckMap>(() => {
    const map: MedCheckMap = {};
    for (const med of medications) {
      map[med.id] = {};
    }
    for (const log of initialMedLogs) {
      const inner = map[log.medicationId] ?? (map[log.medicationId] = {});
      const key = log.slot ?? AS_NEEDED_KEY;
      inner[key] = log.taken === 1;
    }
    return map;
  });
  const [episodeState, setEpisodeState] = useState<string | null>(
    initialEpisodeState
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const showSaved = useCallback(() => {
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

      const newMap: MedCheckMap = {};
      for (const med of medications) {
        newMap[med.id] = {};
      }
      if (medData.logs) {
        for (const log of medData.logs) {
          const inner = newMap[log.medicationId] ?? (newMap[log.medicationId] = {});
          const key = log.slot ?? AS_NEEDED_KEY;
          inner[key] = log.taken === 1;
        }
      }
      setMedStates(newMap);
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
    setMoodScore(score);
    await fetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day: selectedDay,
        moodScore: score,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        notes: notes || undefined,
      }),
    });
    showSaved();
  }

  async function saveEpisode(value: string) {
    const newValue = episodeState === value ? null : value;
    setEpisodeState(newValue);
    await fetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day: selectedDay,
        moodScore: moodScore ?? 0,
        episodeState: newValue,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        notes: notes || undefined,
      }),
    });
    showSaved();
  }

  async function toggleMedSlot(medId: number, slot: string, currentState: boolean) {
    const newState = !currentState;
    setMedStates((prev) => ({
      ...prev,
      [medId]: { ...(prev[medId] ?? {}), [slot]: newState },
    }));
    await fetch("/api/medications/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medicationId: medId,
        day: selectedDay,
        slot: slot === AS_NEEDED_KEY ? null : slot,
        taken: newState,
      }),
    });
    showSaved();
  }

  async function toggleTag(tag: string) {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(newTags);
    await fetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day: selectedDay,
        moodScore: moodScore ?? 0,
        tags: newTags.length > 0 ? newTags : undefined,
        notes: notes || undefined,
        episodeState: episodeState ?? undefined,
      }),
    });
    showSaved();
  }

  async function saveNotes() {
    await fetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        day: selectedDay,
        moodScore: moodScore ?? 0,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        notes: notes || undefined,
        episodeState: episodeState ?? undefined,
      }),
    });
    showSaved();
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5">
              {buildDoses(dayMeds).map((d) => {
                const checked = medStates[d.medId]?.[d.slotKey] ?? false;
                return (
                  <label
                    key={`${d.medId}-${d.slotKey}`}
                    className="flex items-center gap-2 py-0.5 text-sm cursor-pointer min-w-0"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMedSlot(d.medId, d.slotKey, checked)}
                      disabled={loading}
                      className="rounded border-muted-foreground shrink-0"
                    />
                    <span className="truncate">{d.medName}</span>
                    {d.dosage && (
                      <span
                        className="text-muted-foreground text-xs truncate"
                        title={d.dosage}
                      >
                        {d.dosage}
                      </span>
                    )}
                    <span
                      className={`ml-auto shrink-0 text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded ${slotPillClass(d.slotKey)}`}
                    >
                      {d.pillLabel}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
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
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    disabled={loading}
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
                disabled={loading}
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
