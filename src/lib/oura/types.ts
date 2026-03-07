export interface OuraApiResponse<T> {
  data: T[];
  next_token: string | null;
}

export interface OuraSleepPeriod {
  id: string;
  day: string;
  type: string;
  bedtime_start: string;
  bedtime_end: string;
  total_sleep_duration: number | null;
  deep_sleep_duration: number | null;
  light_sleep_duration: number | null;
  rem_sleep_duration: number | null;
  awake_time: number | null;
  efficiency: number | null;
  latency: number | null;
  average_heart_rate: number | null;
  lowest_heart_rate: number | null;
  average_hrv: number | null;
  temperature_delta: number | null;
  average_breath: number | null;
  restless_periods: number | null;
  time_in_bed: number | null;
  heart_rate: { interval: number; items: (number | null)[]; timestamp: string } | null;
  hrv: { interval: number; items: (number | null)[]; timestamp: string } | null;
  sleep_phase_5_min: string | null;
}

export interface OuraDailySleep {
  id: string;
  day: string;
  score: number | null;
  timestamp: string;
  contributors: {
    deep_sleep: number | null;
    efficiency: number | null;
    latency: number | null;
    rem_sleep: number | null;
    restfulness: number | null;
    timing: number | null;
    total_sleep: number | null;
  };
}

export interface OuraDailyReadiness {
  id: string;
  day: string;
  score: number | null;
  timestamp: string;
  temperature_deviation: number | null;
  temperature_trend_deviation: number | null;
  contributors: {
    activity_balance: number | null;
    body_temperature: number | null;
    hrv_balance: number | null;
    previous_day_activity: number | null;
    previous_night: number | null;
    recovery_index: number | null;
    resting_heart_rate: number | null;
    sleep_balance: number | null;
  };
}

export interface OuraDailyActivity {
  id: string;
  day: string;
  score: number | null;
  active_calories: number | null;
  total_calories: number | null;
  steps: number | null;
  high_activity_time: number | null;
  medium_activity_time: number | null;
  low_activity_time: number | null;
  sedentary_time: number | null;
  resting_time: number | null;
  non_wear_time: number | null;
  average_met_minutes: number | null;
  class_5min: string | null;
  met: {
    interval: number;
    items: number[];
    timestamp: string;
  } | null;
  timestamp: string;
}

export interface OuraDailyStress {
  id: string;
  day: string;
  stress_high: number | null;
  recovery_high: number | null;
  day_summary: string | null;
}

export interface OuraDailyResilience {
  id: string;
  day: string;
  level: string | null;
  contributors: {
    sleep_recovery: number | null;
    daytime_recovery: number | null;
    stress: number | null;
  };
}

export interface OuraDailySpO2 {
  id: string;
  day: string;
  spo2_percentage: {
    average: number | null;
  } | null;
  breathing_disturbance_index: number | null;
}

export interface OuraWorkout {
  id: string;
  day: string;
  activity: string | null;
  calories: number | null;
  distance: number | null;
  intensity: string | null;
  start_datetime: string | null;
  end_datetime: string | null;
}

export interface OuraSession {
  id: string;
  day: string;
  type: string | null;
  mood: string | null;
  start_datetime: string | null;
  end_datetime: string | null;
  heart_rate: { average: number | null } | null;
  heart_rate_variability: { average: number | null } | null;
}

export interface OuraEnhancedTag {
  id: string;
  day: string;
  tag_type_code: string | null;
  start_time: string | null;
  end_time: string | null;
  comment: string | null;
}

export interface OuraRestModePeriod {
  id: string;
  start_day: string | null;
  end_day: string | null;
  start_time: string | null;
  end_time: string | null;
  episodes: unknown[] | null;
}

export interface OuraDailyCardiovascularAge {
  day: string;
  vascular_age: number | null;
}

export interface OuraVo2Max {
  id: string;
  day: string;
  vo2_max: number | null;
}

export interface OuraSleepTime {
  id: string;
  day: string;
  optimal_bedtime: {
    day_tz: number | null;
    end_offset: number | null;
    start_offset: number | null;
  } | null;
  recommendation: string | null;
  status: string | null;
}

export interface OuraPersonalInfo {
  id: string;
  age: number | null;
  weight: number | null;
  height: number | null;
  biological_sex: string | null;
  email: string | null;
}
