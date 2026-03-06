"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const QUICK_MOODS = [
  { value: -2, label: "Low", color: "bg-blue-500" },
  { value: -1, label: "Slightly Low", color: "bg-blue-400" },
  { value: 0, label: "Neutral", color: "bg-green-500" },
  { value: 1, label: "Slightly High", color: "bg-amber-400" },
  { value: 2, label: "High", color: "bg-amber-500" },
];

export function MoodPromptCard({ today }: { today: string }) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function quickSave(moodScore: number) {
    setSaving(true);
    try {
      await fetch("/api/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: today, moodScore }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <Card>
        <CardContent className="py-3 text-center">
          <p className="text-sm text-green-400">Mood logged! <Link href="/dashboard/checkin" className="underline">Add details</Link></p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-medium">How are you feeling today?</p>
          <div className="flex items-center gap-2">
            {QUICK_MOODS.map((m) => (
              <button
                key={m.value}
                onClick={() => quickSave(m.value)}
                disabled={saving}
                className={`w-8 h-8 rounded-md text-xs font-bold ${m.color} opacity-70 hover:opacity-100 transition-opacity`}
                title={m.label}
              >
                {m.value > 0 ? `+${m.value}` : m.value}
              </button>
            ))}
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/checkin">More</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
