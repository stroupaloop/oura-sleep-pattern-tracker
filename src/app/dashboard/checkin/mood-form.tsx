"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const MOOD_OPTIONS = [
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

interface MedicationItem {
  id: number;
  name: string;
  dosage: string | null;
}

interface MoodFormProps {
  today: string;
  existingMood: {
    moodScore: number;
    energyScore: number | null;
    irritabilityScore: number | null;
    anxietyScore: number | null;
    sleepSubjective: number | null;
    notes: string | null;
    tags: string | null;
  } | null;
  medications: MedicationItem[];
}

export function MoodForm({ today, existingMood, medications }: MoodFormProps) {
  const [moodScore, setMoodScore] = useState<number | null>(existingMood?.moodScore ?? null);
  const [energy, setEnergy] = useState(existingMood?.energyScore ?? 3);
  const [irritability, setIrritability] = useState(existingMood?.irritabilityScore ?? 1);
  const [anxiety, setAnxiety] = useState(existingMood?.anxietyScore ?? 1);
  const [sleepSubjective, setSleepSubjective] = useState(existingMood?.sleepSubjective ?? 3);
  const [notes, setNotes] = useState(existingMood?.notes ?? "");
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    try {
      return existingMood?.tags ? JSON.parse(existingMood.tags) : [];
    } catch {
      return [];
    }
  });
  const [medChecks, setMedChecks] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(medications.map((m) => [m.id, true]))
  );
  const [showOptional, setShowOptional] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit() {
    if (moodScore === null) return;
    setSaving(true);
    try {
      await fetch("/api/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: today,
          moodScore,
          energyScore: showOptional ? energy : undefined,
          irritabilityScore: showOptional ? irritability : undefined,
          anxietyScore: showOptional ? anxiety : undefined,
          sleepSubjective: showOptional ? sleepSubjective : undefined,
          notes: notes || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
        }),
      });

      for (const med of medications) {
        await fetch("/api/medications/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            medicationId: med.id,
            day: today,
            taken: medChecks[med.id] ?? true,
          }),
        });
      }

      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-lg font-medium text-green-400">Check-in saved!</p>
          <p className="text-sm text-muted-foreground mt-1">Your mood data has been recorded for {today}.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>How are you feeling today?</CardTitle>
          <CardDescription>Tap your current mood level (NIMH Life Chart scale: -3 to +3)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 justify-center flex-wrap">
            {MOOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMoodScore(opt.value)}
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
                rows={2}
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

          <Button onClick={handleSubmit} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Check-in"}
          </Button>
        </>
      )}
    </div>
  );
}
