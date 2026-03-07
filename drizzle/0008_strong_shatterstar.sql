CREATE TABLE `cycle_predictions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cycle_number` integer NOT NULL,
	`period_start_day` text,
	`ovulation_day` text,
	`next_period_day` text,
	`cycle_length` integer,
	`confidence` real,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cycle_predictions_cycle_number_unique` ON `cycle_predictions` (`cycle_number`);--> statement-breakpoint
CREATE TABLE `daily_cardiovascular_age` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`vascular_age` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_cardiovascular_age_day_unique` ON `daily_cardiovascular_age` (`day`);--> statement-breakpoint
CREATE TABLE `daily_location` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`city` text,
	`description` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_location_day_unique` ON `daily_location` (`day`);--> statement-breakpoint
CREATE TABLE `enhanced_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`tag_type_code` text,
	`start_time` text,
	`end_time` text,
	`comment` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `personal_info` (
	`id` text PRIMARY KEY NOT NULL,
	`age` integer,
	`weight` real,
	`height` real,
	`biological_sex` text,
	`email` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rest_mode_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`start_day` text,
	`end_day` text,
	`start_time` text,
	`end_time` text,
	`episodes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sleep_time` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`optimal_bedtime_start` text,
	`optimal_bedtime_end` text,
	`recommendation` text,
	`status` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sleep_time_day_unique` ON `sleep_time` (`day`);--> statement-breakpoint
CREATE TABLE `vo2_max` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`vo2_max` real,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vo2_max_day_unique` ON `vo2_max` (`day`);