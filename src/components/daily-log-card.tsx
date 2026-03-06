"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";

const EPISODE_STATES = [
  { value: "none", label: "None" },
  { value: "depressive", label: "Depressive" },
  { value: "hypomanic", label: "Hypo/Manic" },
  { value: "mixed", label: "Mixed" },
];

const MOODS = [
  { value: -3, label: "Depressed", color: "bg-blue-600" },
  { value: -2, label: "Low", color: "bg-blue-500" },
  { value: -1, label: "Slightly Low", color: "bg-blue-400" },
  { value: 0, label: "Neutral", color: "bg-green-500" },
  { value: 1, label: "Slightly High", color: "bg-amber-400" },
  { value: 2, label: "High", color: "bg-amber-500" },
  { value: 3, label: "Manic", color: "bg-amber-600" },
];

interface Medication {
  id: number;
  name: string;
  dosage: string | null;
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
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [loading, setLoading] = useState(false);

  const showSaved = useCallback(() => {
    setSavedIndicator(true);
    setTimeout(() => setSavedIndicator(false), 1500);
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
      body: JSON.stringify({ day: selectedDay, moodScore: score }),
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = selectedDay === todayStr;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Daily Log</CardTitle>
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
            {savedIndicator && (
              <span className="text-xs text-green-400 ml-2 animate-pulse">
                Saved
              </span>
            )}
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

        {medications.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Medications</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {medications.map((med) => {
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

        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Episode</p>
          <div className="flex gap-1.5 flex-wrap">
            {EPISODE_STATES.map((ep) => {
              const isSelected = episodeState === ep.value;
              return (
                <button
                  key={ep.value}
                  onClick={() => saveEpisode(ep.value)}
                  disabled={loading}
                  className={`px-3 py-1 text-xs rounded-full transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {ep.label}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
