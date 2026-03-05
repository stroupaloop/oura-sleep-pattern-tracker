CREATE TABLE `account` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `daily_analysis` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`total_sleep_minutes` real,
	`baseline_sleep_minutes` real,
	`sleep_duration_z_score` real,
	`bedtime_start_minutes` real,
	`baseline_bedtime_minutes` real,
	`bedtime_z_score` real,
	`wake_time_minutes` real,
	`baseline_wake_minutes` real,
	`wake_time_z_score` real,
	`rem_percentage` real,
	`deep_percentage` real,
	`efficiency` real,
	`avg_hrv` real,
	`baseline_hrv` real,
	`hrv_z_score` real,
	`avg_heart_rate` real,
	`baseline_heart_rate` real,
	`heart_rate_z_score` real,
	`temperature_delta` real,
	`onset_latency_minutes` real,
	`baseline_latency` real,
	`latency_z_score` real,
	`temperature_z_score` real,
	`baseline_temperature` real,
	`restlessness_z_score` real,
	`baseline_restlessness` real,
	`efficiency_z_score` real,
	`baseline_efficiency` real,
	`deep_pct_z_score` real,
	`baseline_deep_pct` real,
	`rem_pct_z_score` real,
	`baseline_rem_pct` real,
	`restless_periods` integer,
	`anomaly_score` real,
	`is_anomaly` integer,
	`anomaly_direction` text,
	`anomaly_notes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_analysis_day_unique` ON `daily_analysis` (`day`);--> statement-breakpoint
CREATE TABLE `daily_readiness` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`score` integer,
	`temperature_deviation` real,
	`temperature_trend_deviation` real,
	`contributor_activity_balance` integer,
	`contributor_body_temperature` integer,
	`contributor_hrv_balance` integer,
	`contributor_previous_day_activity` integer,
	`contributor_previous_night` integer,
	`contributor_recovery_index` integer,
	`contributor_resting_heart_rate` integer,
	`contributor_sleep_balance` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_readiness_day_unique` ON `daily_readiness` (`day`);--> statement-breakpoint
CREATE TABLE `daily_sleep` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`score` integer,
	`contributor_deep_sleep` integer,
	`contributor_efficiency` integer,
	`contributor_latency` integer,
	`contributor_rem_sleep` integer,
	`contributor_restfulness` integer,
	`contributor_timing` integer,
	`contributor_total_sleep` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_sleep_day_unique` ON `daily_sleep` (`day`);--> statement-breakpoint
CREATE TABLE `detection_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`version` integer NOT NULL,
	`baseline_days` integer NOT NULL,
	`min_baseline_days` integer NOT NULL,
	`baseline_trim_pct` real NOT NULL,
	`concern_threshold` real NOT NULL,
	`daily_anomaly_threshold` real NOT NULL,
	`watch_min_confidence` real NOT NULL,
	`watch_min_days` integer NOT NULL,
	`warning_min_confidence` real NOT NULL,
	`warning_min_days` integer NOT NULL,
	`alert_min_confidence` real NOT NULL,
	`alert_min_days` integer NOT NULL,
	`bounce_back_threshold` real NOT NULL,
	`metric_weights` text NOT NULL,
	`hyper_signals` text,
	`hypo_signals` text,
	`is_active` integer NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `detection_config_version_unique` ON `detection_config` (`version`);--> statement-breakpoint
CREATE TABLE `episode_assessments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`tier` text NOT NULL,
	`direction` text,
	`confidence` real NOT NULL,
	`best_window_days` integer,
	`trend_slope` real,
	`consistency_ratio` real,
	`direction_consistency` real,
	`bounce_back_score` real,
	`confounder_likelihood` real,
	`latency_cv` real,
	`latency_cv_z_score` real,
	`bedtime_cv` real,
	`sleep_duration_cv` real,
	`hrv_cv` real,
	`temperature_mean` real,
	`temperature_elevated` integer,
	`consecutive_concerning_days` integer,
	`primary_drivers` text,
	`summary` text,
	`config_version` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `episode_assessments_day_unique` ON `episode_assessments` (`day`);--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`scope` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sleep_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`type` text NOT NULL,
	`bedtime_start` text NOT NULL,
	`bedtime_end` text NOT NULL,
	`total_sleep_duration` integer,
	`deep_sleep_duration` integer,
	`light_sleep_duration` integer,
	`rem_sleep_duration` integer,
	`awake_time` integer,
	`efficiency` integer,
	`latency` integer,
	`average_heart_rate` real,
	`lowest_heart_rate` integer,
	`average_hrv` real,
	`temperature_delta` real,
	`average_breath` real,
	`restless_periods` integer,
	`time_in_bed` integer,
	`hr_5min` text,
	`hrv_5min` text,
	`hypnogram_5min` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sync_type` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`records_fetched` integer,
	`status` text NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`emailVerified` integer,
	`image` text
);
--> statement-breakpoint
CREATE TABLE `verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
