"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ContributorScore {
  name: string;
  score: number | null;
}

interface ScoreBreakdownProps {
  title: string;
  contributors: ContributorScore[];
  day?: string;
}

function getBarColor(score: number): string {
  if (score < 60) return "#ef4444";
  if (score < 75) return "#f59e0b";
  if (score < 85) return "#22c55e";
  return "#86efac";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BreakdownTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as ContributorScore;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{p.name}</p>
      <p style={{ color: getBarColor(p.score ?? 0) }}>
        {p.score ?? "--"}
      </p>
    </div>
  );
}

export function ScoreBreakdown({ title, contributors, day }: ScoreBreakdownProps) {
  const data = contributors.filter((c) => c.score != null);
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {day && <p className="text-xs text-muted-foreground">{day}</p>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={data.length * 32 + 16}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<BreakdownTooltip />} />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={18}>
              {data.map((d, i) => (
                <Cell key={i} fill={getBarColor(d.score ?? 0)} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
