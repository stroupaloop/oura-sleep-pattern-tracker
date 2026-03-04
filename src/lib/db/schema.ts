import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
} from "drizzle-orm/sqlite-core";

// NextAuth required tables
export const users = sqliteTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
});

export const accounts = sqliteTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// Oura API tokens (separate from NextAuth)
export const oauthTokens = sqliteTable("oauth_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: integer("expires_at").notNull(),
  scope: text("scope").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const sleepPeriods = sqliteTable("sleep_periods", {
  id: text("id").primaryKey(),
  day: text("day").notNull(),
  type: text("type").notNull(),
  bedtimeStart: text("bedtime_start").notNull(),
  bedtimeEnd: text("bedtime_end").notNull(),
  totalSleepDuration: integer("total_sleep_duration"),
  deepSleepDuration: integer("deep_sleep_duration"),
  lightSleepDuration: integer("light_sleep_duration"),
  remSleepDuration: integer("rem_sleep_duration"),
  awakeTime: integer("awake_time"),
  efficiency: integer("efficiency"),
  latency: integer("latency"),
  averageHeartRate: real("average_heart_rate"),
  lowestHeartRate: integer("lowest_heart_rate"),
  averageHrv: real("average_hrv"),
  temperatureDelta: real("temperature_delta"),
  averageBreath: real("average_breath"),
  restlessPeriods: integer("restless_periods"),
  timeInBed: integer("time_in_bed"),
  hr5min: text("hr_5min"),
  hrv5min: text("hrv_5min"),
  hypnogram5min: text("hypnogram_5min"),
  createdAt: integer("created_at").notNull(),
});

export const dailySleep = sqliteTable("daily_sleep", {
  id: text("id").primaryKey(),
  day: text("day").notNull().unique(),
  score: integer("score"),
  contributorDeepSleep: integer("contributor_deep_sleep"),
  contributorEfficiency: integer("contributor_efficiency"),
  contributorLatency: integer("contributor_latency"),
  contributorRemSleep: integer("contributor_rem_sleep"),
  contributorRestfulness: integer("contributor_restfulness"),
  contributorTiming: integer("contributor_timing"),
  contributorTotalSleep: integer("contributor_total_sleep"),
  createdAt: integer("created_at").notNull(),
});

export const dailyReadiness = sqliteTable("daily_readiness", {
  id: text("id").primaryKey(),
  day: text("day").notNull().unique(),
  score: integer("score"),
  temperatureDeviation: real("temperature_deviation"),
  temperatureTrendDeviation: real("temperature_trend_deviation"),
  contributorActivityBalance: integer("contributor_activity_balance"),
  contributorBodyTemperature: integer("contributor_body_temperature"),
  contributorHrvBalance: integer("contributor_hrv_balance"),
  contributorPreviousDayActivity: integer("contributor_previous_day_activity"),
  contributorPreviousNight: integer("contributor_previous_night"),
  contributorRecoveryIndex: integer("contributor_recovery_index"),
  contributorRestingHeartRate: integer("contributor_resting_heart_rate"),
  contributorSleepBalance: integer("contributor_sleep_balance"),
  createdAt: integer("created_at").notNull(),
});

export const dailyAnalysis = sqliteTable("daily_analysis", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  day: text("day").notNull().unique(),
  totalSleepMinutes: real("total_sleep_minutes"),
  baselineSleepMinutes: real("baseline_sleep_minutes"),
  sleepDurationZScore: real("sleep_duration_z_score"),
  bedtimeStartMinutes: real("bedtime_start_minutes"),
  baselineBedtimeMinutes: real("baseline_bedtime_minutes"),
  bedtimeZScore: real("bedtime_z_score"),
  wakeTimeMinutes: real("wake_time_minutes"),
  baselineWakeMinutes: real("baseline_wake_minutes"),
  wakeTimeZScore: real("wake_time_z_score"),
  remPercentage: real("rem_percentage"),
  deepPercentage: real("deep_percentage"),
  efficiency: real("efficiency"),
  avgHrv: real("avg_hrv"),
  baselineHrv: real("baseline_hrv"),
  hrvZScore: real("hrv_z_score"),
  avgHeartRate: real("avg_heart_rate"),
  baselineHeartRate: real("baseline_heart_rate"),
  heartRateZScore: real("heart_rate_z_score"),
  temperatureDelta: real("temperature_delta"),
  onsetLatencyMinutes: real("onset_latency_minutes"),
  baselineLatency: real("baseline_latency"),
  latencyZScore: real("latency_z_score"),
  anomalyScore: real("anomaly_score"),
  isAnomaly: integer("is_anomaly"),
  anomalyDirection: text("anomaly_direction"),
  anomalyNotes: text("anomaly_notes"),
  createdAt: integer("created_at").notNull(),
});

export const syncLog = sqliteTable("sync_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  syncType: text("sync_type").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  recordsFetched: integer("records_fetched"),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  createdAt: integer("created_at").notNull(),
});
