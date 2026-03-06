import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DataConfidence {
  overall: number;
  oura: { days: number; total: number; rate: number };
  mood: { days: number; total: number; rate: number };
  medications: { tracked: boolean };
  suggestions: string[];
}

export function ConfidenceIndicator({ data }: { data: DataConfidence }) {
  const pct = data.overall;
  const filledBlocks = Math.round(pct / 10);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Data Confidence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className={`w-3 h-5 rounded-sm ${
                  i < filledBlocks
                    ? pct >= 80
                      ? "bg-green-500"
                      : pct >= 60
                        ? "bg-amber-500"
                        : "bg-red-500"
                    : "bg-muted"
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-medium">{pct}%</span>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            Oura Data: {data.oura.days}/{data.oura.total} days ({(data.oura.rate * 100).toFixed(0)}%)
          </p>
          <p>
            Mood Log: {data.mood.days}/{data.mood.total} days ({(data.mood.rate * 100).toFixed(0)}%)
          </p>
          <p>Medications: {data.medications.tracked ? "Tracked" : "Not tracked"}</p>
        </div>
        {data.suggestions.length > 0 && (
          <div className="text-xs text-amber-400/80 space-y-0.5">
            {data.suggestions.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
