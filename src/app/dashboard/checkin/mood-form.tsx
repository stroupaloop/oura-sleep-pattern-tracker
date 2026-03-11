"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTodayET } from "@/lib/date-utils";

const MOOD_OPTIONS = [
  { value: -3, label: "Very Low", color: "bg-blue-600" },
  { value: -2, label: "Low", color: "bg-blue-500" },
  { value: -1, label: "Slightly Low", color: "bg-blue-400" },
  { value: 0, label: "Neutral", color: "bg-green-500" },
  { value: 1, label: "Slightly High", color: "bg-amber-400" },
  { value: 2, label: "High", color: "bg-amber-500" },
  { value: 3, label: "Very High", color: "bg-amber-600" },
];

const EPISODE_STATES = [
  { value: "none", label: "None" },
  { value: "depressive", label: "Depressive" },
  { value: "hypomanic", label: "Hypo/Manic" },
  { value: "mixed", label: "Mixed" },
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

interface MedicationItem {
  id: number;
  name: string;
  dosage: string | null;
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

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  try {
    return JSON.parse(tags);
  } catch {
    return [];
  }
}

export function MoodForm({ initialDay, existingMood, medications }: MoodFormProps) {
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [moodScore, setMoodScore] = useState<number | null>(existingMood?.moodScore ?? null);
  const [energy, setEnergy] = useState(existingMood?.energyScore ?? 3);
  const [irritability, setIrritability] = useState(existingMood?.irritabilityScore ?? 1);
  const [anxiety, setAnxiety] = useState(existingMood?.anxietyScore ?? 1);
  const [sleepSubjective, setSleepSubjective] = useState(existingMood?.sleepSubjective ?? 3);
  const [episodeState, setEpisodeState] = useState<string | null>(existingMood?.episodeState ?? null);
  const [notes, setNotes] = useState(existingMood?.notes ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(parseTags(existingMood?.tags ?? null));
  const [medChecks, setMedChecks] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(medications.map((m) => [m.id, true]))
  );
  const [showOptional, setShowOptional] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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

      const newMedMap: Record<number, boolean> = {};
      if (medData?.logs) {
        for (const log of medData.logs) {
          newMedMap[log.medicationId] = log.taken === 1;
        }
      }
      for (const med of medications) {
        if (!(med.id in newMedMap)) newMedMap[med.id] = !moodData;
      }
      setMedChecks(newMedMap);
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
    try {
      await fetch("/api/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: selectedDay,
          moodScore,
          energyScore: showOptional ? energy : undefined,
          irritabilityScore: showOptional ? irritability : undefined,
          anxietyScore: showOptional ? anxiety : undefined,
          sleepSubjective: showOptional ? sleepSubjective : undefined,
          notes: notes || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          episodeState: episodeState ?? undefined,
        }),
      });

      for (const med of medications) {
        await fetch("/api/medications/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            medicationId: med.id,
            day: selectedDay,
            taken: medChecks[med.id] ?? true,
          }),
        });
      }

      setSaved(true);
      setLastSavedAt(
        new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      );
    } finally {
      setSaving(false);
    }
  }

  const todayStr = getTodayET();
  const isToday = selectedDay === todayStr;

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
        <button
          onClick={() => navigateDay(-1)}
          className="p-1.5 rounded hover:bg-muted transition-colors"
          aria-label="Previous day"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <label className="relative cursor-pointer">
          <span className="px-3 py-1 rounded hover:bg-muted transition-colors text-sm font-medium">
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
          className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-30"
          aria-label="Next day"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        </div>
        {lastSavedAt && (
          <span className="text-xs text-muted-foreground">
            Saved {lastSavedAt}
          </span>
        )}
      </div>

      {saved ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg font-medium text-green-400">Check-in saved!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your mood data has been recorded for {selectedDay}.
            </p>
            <button
              onClick={() => setSaved(false)}
              className="text-sm text-primary mt-3 underline"
            >
              Edit
            </button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {isToday ? "How are you feeling today?" : `How were you feeling on ${formatDisplayDate(selectedDay)}?`}
              </CardTitle>
              <CardDescription>Tap your mood level (NIMH Life Chart scale: -3 to +3)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 justify-center flex-wrap">
                {MOOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setMoodScore(opt.value)}
                    disabled={loadingDay}
                    className={`w-12 h-12 rounded-lg text-sm font-bold transition-all ${opt.color} ${
                      moodScore === opt.value
                        ? "ring-2 ring-white scale-110"
                        : "opacity-60 hover:opacity-80"
                    }`}
                  >
                    {opt.value > 0 ? `+${opt.value}` : opt.value}
                  </button>
                ))}
              </div>
              {moodScore !== null && (
                <p className="text-center text-sm text-muted-foreground mt-2">
                  {MOOD_OPTIONS.find((o) => o.value === moodScore)?.label}
                </p>
              )}
            </CardContent>
          </Card>

          {moodScore !== null && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Episode State</CardTitle>
                  <CardDescription>Do you think you&apos;re in an episode?</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    {EPISODE_STATES.map((ep) => (
                      <button
                        key={ep.value}
                        onClick={() => setEpisodeState(episodeState === ep.value ? null : ep.value)}
                        className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                          episodeState === ep.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {ep.label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <button
                onClick={() => setShowOptional(!showOptional)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showOptional ? "Hide" : "Show"} optional details (energy, irritability, anxiety, sleep quality)
              </button>

              {showOptional && (
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    {[
                      { label: "Energy", value: energy, set: setEnergy },
                      { label: "Irritability", value: irritability, set: setIrritability },
                      { label: "Anxiety", value: anxiety, set: setAnxiety },
                      { label: "Sleep Quality", value: sleepSubjective, set: setSleepSubjective },
                    ].map(({ label, value, set }) => (
                      <div key={label} className="flex items-center gap-3">
                        <span className="text-sm w-24 shrink-0">{label}</span>
                        <input
                          type="range"
                          min={1}
                          max={5}
                          value={value}
                          onChange={(e) => set(Number(e.target.value))}
                          className="flex-1"
                        />
                        <span className="text-sm w-6 text-right">{value}/5</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {TAGS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() =>
                          setSelectedTags((prev) =>
                            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                          )
                        }
                        className={`px-3 py-1 text-xs rounded-full transition-colors ${
                          selectedTags.includes(tag)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tag.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="Any notes? (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-3 w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground"
                    rows={4}
                  />
                </CardContent>
              </Card>

              {medications.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Medications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {medications.map((med) => (
                        <label key={med.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={medChecks[med.id] ?? true}
                            onChange={(e) =>
                              setMedChecks((prev) => ({ ...prev, [med.id]: e.target.checked }))
                            }
                            className="rounded"
                          />
                          <span>{med.name}</span>
                          {med.dosage && <span className="text-muted-foreground">({med.dosage})</span>}
                        </label>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button onClick={handleSubmit} disabled={saving || loadingDay} className="w-full">
                {saving ? "Saving..." : "Save Check-in"}
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}
