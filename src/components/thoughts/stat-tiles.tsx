interface StatTilesProps {
  total: number;
  thisWeek: number;
  streak: number;
  lastThought: string | null;
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums md:text-3xl">
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function StatTiles({
  total,
  thisWeek,
  streak,
  lastThought,
}: StatTilesProps) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
      <Tile value={String(total)} label="times, all up" />
      <Tile value={String(thisWeek)} label="in the last 7 days" />
      <Tile
        value={String(streak)}
        label={streak === 1 ? "day running" : "days running"}
      />
      <Tile value={lastThought ?? "—"} label="most recently" />
    </div>
  );
}
