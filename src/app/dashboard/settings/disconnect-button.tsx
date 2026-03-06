"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DisconnectButton() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDisconnect() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/oura/disconnect", { method: "POST" });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  return (
    <div className="pt-4 border-t">
      {confirming && (
        <p className="text-sm text-muted-foreground mb-2">
          Are you sure? This won&apos;t delete your existing sleep data.
        </p>
      )}
      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDisconnect}
          disabled={loading}
        >
          {loading
            ? "Disconnecting..."
            : confirming
              ? "Confirm Disconnect"
              : "Disconnect Oura"}
        </Button>
        {confirming && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
