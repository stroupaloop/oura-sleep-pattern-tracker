interface StatTilesProps {
  total: number;
  thisWeek: number;
  streak: number;
  lastThought: string | null;
  /** One flat strip instead of four boxes, for the denser dashboard. */
  compact?: boolean;
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
  compact = false,
}: StatTilesProps) {
  const stats = [
    { value: String(total), label: "times, all up" },
    { value: String(thisWeek), label: "in the last 7 days" },
    { value: String(streak), label: streak === 1 ? "day running" : "days running" },
    { value: lastThought ?? "—", label: "most recently" },
  ];

  if (compact) {
    return (
      <div className="grid grid-cols-2 rounded-lg border bg-card sm:grid-cols-4 sm:divide-x">
        {stats.map((stat) => (
          <div key={stat.label} className="px-3 py-2">
            <div className="text-lg font-semibold tabular-nums">{stat.value}</div>
            <div className="text-[11px] text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
      {stats.map((stat) => (
        <Tile key={stat.label} value={stat.value} label={stat.label} />
      ))}
    </div>
  );
}
