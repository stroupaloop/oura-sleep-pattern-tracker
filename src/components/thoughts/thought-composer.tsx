"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ThoughtComposer() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justLogged, setJustLogged] = useState(false);

  const busy = saving || pending;

  async function submit(body: { note?: string; link?: string }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/thoughts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Could not save that. Try again.");
        return false;
      }
      setJustLogged(true);
      window.setTimeout(() => setJustLogged(false), 2000);
      startTransition(() => router.refresh());
      return true;
    } catch {
      setError("Could not save that. Try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => submit({})}
          disabled={busy}
          className="gap-2"
          aria-label="Log that you thought of her"
        >
          {busy && !open ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <Heart className="size-4" />
          )}
          {justLogged ? "Logged" : "Thought of you"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((value) => !value)}
          className="gap-1.5 text-muted-foreground"
        >
          {open ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {open ? "Cancel" : "Add a note"}
        </Button>
      </div>

      {open && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="thought-note">Note</Label>
            <Textarea
              id="thought-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What made you think of her?"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="thought-link">Link</Label>
            <Input
              id="thought-link"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://instagram.com/reel/..."
              inputMode="url"
            />
          </div>
          <Button
            onClick={async () => {
              const saved = await submit({ note, link });
              if (saved) {
                setNote("");
                setLink("");
                setOpen(false);
              }
            }}
            disabled={busy || (note.trim() === "" && link.trim() === "")}
            className="gap-2"
          >
            {busy && (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
            )}
            Save
          </Button>
        </div>
      )}

      {error && <FormMessage kind="error">{error}</FormMessage>}
    </div>
  );
}
