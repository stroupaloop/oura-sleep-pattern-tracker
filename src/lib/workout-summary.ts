interface WorkoutForSummary {
  day: string;
  activity: string | null;
  calories: number | null;
}

export interface WorkoutDaySummary {
  count: number;
  calories: number | null;
  types: string[];
}

export function summarizeWorkoutsByDay(
  workouts: ReadonlyArray<WorkoutForSummary>
): Map<string, WorkoutDaySummary> {
  const summaries = new Map<string, WorkoutDaySummary>();

  for (const workout of workouts) {
    const summary = summaries.get(workout.day) ?? {
      count: 0,
      calories: 0,
      types: [],
    };

    summary.count += 1;
    summary.calories =
      summary.calories == null || workout.calories == null
        ? null
        : summary.calories + workout.calories;

    if (
      workout.activity &&
      !summary.types.includes(workout.activity)
    ) {
      summary.types.push(workout.activity);
    }

    summaries.set(workout.day, summary);
  }

  return summaries;
}
