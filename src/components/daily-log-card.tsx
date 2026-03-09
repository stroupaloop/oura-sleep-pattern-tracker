"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

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

interface Medication {
  id: number;
  name: string;
  dosage: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

interface DailyLogCardProps {
  initialDay: string;
  medications: Medication[];
  initialMood: { moodScore: number } | null;
  initialMedLogs: { medicationId: number; taken: number }[];
  initialEpisodeState: string | null;
}

function formatDisplayDate(dateStr: string): string {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
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
  const [medStates, setMedStates] = useState<Record<number, boolean>>(() => {
    const map: Record<number, boolean> = {};
    for (const log of initialMedLogs) {
      map[log.medicationId] = log.taken === 1;
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

      const newMap: Record<number, boolean> = {};
      if (medData.logs) {
        for (const log of medData.logs) {
          newMap[log.medicationId] = log.taken === 1;
        }
      }
      setMedStates(newMap);
    } finally {
      setLoading(false);
    }
  }

  function navigateDay(delta: number) {
    const newDay = shiftDay(selectedDay, delta);
    const todayStr = new Date().toISOString().slice(0, 10);
    if (newDay > todayStr) return;
    setSelectedDay(newDay);
    fetchDayData(newDay);
  }

  function handleDateInput(e: React.ChangeEvent<HTMLInputElement>) {
    const newDay = e.target.value;
    if (!newDay) return;
    const todayStr = new Date().toISOString().slice(0, 10);
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

  async function toggleMed(medId: number, currentState: boolean) {
    const newState = !currentState;
    setMedStates((prev) => ({ ...prev, [medId]: newState }));
    await fetch("/api/medications/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medicationId: medId,
        day: selectedDay,
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

  const todayStr = new Date().toISOString().slice(0, 10);
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
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {dayMeds.map((med) => {
                const checked = medStates[med.id] ?? false;
                return (
                  <label
                    key={med.id}
                    className="flex items-center gap-2 cursor-pointer py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMed(med.id, checked)}
                      disabled={loading}
                      className="rounded border-muted-foreground"
                    />
                    <span className="text-sm">
                      {med.name}
                      {med.dosage && (
                        <span className="text-muted-foreground ml-1 text-xs">
                          {med.dosage}
                        </span>
                      )}
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
