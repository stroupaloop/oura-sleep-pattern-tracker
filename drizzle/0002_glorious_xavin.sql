CREATE TABLE `daily_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`score` integer,
	`active_calories` integer,
	`total_calories` integer,
	`steps` integer,
	`high_activity_time` integer,
	`medium_activity_time` integer,
	`low_activity_time` integer,
	`sedentary_time` integer,
	`resting_time` integer,
	`non_wear_time` integer,
	`average_met_minutes` real,
	`class_5min` text,
	`met` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_activity_day_unique` ON `daily_activity` (`day`);--> statement-breakpoint
CREATE TABLE `daily_resilience` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`level` text,
	`contributor_sleep_recovery` integer,
	`contributor_daytime_recovery` integer,
	`contributor_stress` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_resilience_day_unique` ON `daily_resilience` (`day`);--> statement-breakpoint
CREATE TABLE `daily_stress` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`stress_high` integer,
	`recovery_high` integer,
	`day_summary` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_stress_day_unique` ON `daily_stress` (`day`);--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `within_night_hrv_cv` real;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `within_night_hr_cv` real;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `sleep_stage_transitions` integer;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `hypnogram_fragmentation` real;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `lowest_heart_rate` integer;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `average_breath` real;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `activity_score` integer;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `steps` integer;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `active_minutes` integer;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `sedentary_minutes` integer;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `activity_class_fragmentation` real;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `stress_high` integer;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `recovery_high` integer;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `resilience_level` text;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `sleep_timing_score` integer;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `readiness_score` integer;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `temperature_deviation` real;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `temperature_trend_deviation` real;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `day_to_day_sleep_cv` real;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `day_to_day_bedtime_cv` real;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `day_to_day_wake_cv` real;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `circadian_is` real;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `circadian_iv` real;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `circadian_ra` real;--> statement-breakpoint
ALTER TABLE `episode_assessments` ADD `research_context` text;--> statement-breakpoint
ALTER TABLE `user` ADD `bipolar_type` text DEFAULT 'unspecified';