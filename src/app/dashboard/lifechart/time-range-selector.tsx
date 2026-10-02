"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { resolveLifeChartRange } from "@/lib/life-chart";

const RANGES = [
  { value: "30", label: "30d", spoken: "30 days" },
  { value: "90", label: "90d", spoken: "90 days" },
  { value: "180", label: "180d", spoken: "180 days" },
  { value: "365", label: "1y", spoken: "1 year" },
] as const;

type Range = (typeof RANGES)[number]["value"];

const OPTIONS = RANGES.map((range) => ({
  value: range.value,
  label: (
    <>
      <span aria-hidden="true">{range.label}</span>
      <span className="sr-only">{range.spoken}</span>
    </>
  ),
}));

export function TimeRangeSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The same fallback as the page, so the chosen range is always the one shown.
  const current = String(
    resolveLifeChartRange(searchParams.get("range") ?? undefined)
  ) as Range;

  return (
    <SegmentedControl
      label="Time range"
      options={OPTIONS}
      value={current}
      onValueChange={(range) =>
        router.push(`/dashboard/lifechart?range=${range}`)
      }
    />
  );
}
