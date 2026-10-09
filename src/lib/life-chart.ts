export function collectLifeChartDays(
  ...sources: ReadonlyArray<ReadonlyArray<{ day: string }>>
): string[] {
  return Array.from(
    new Set(sources.flatMap((source) => source.map((row) => row.day)))
  ).sort();
}
