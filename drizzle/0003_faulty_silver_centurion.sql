CREATE TABLE `daily_mood` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`mood_score` integer NOT NULL,
	`energy_score` integer,
	`irritability_score` integer,
	`anxiety_score` integer,
	`sleep_subjective` integer,
	`notes` text,
	`tags` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_mood_day_unique` ON `daily_mood` (`day`);--> statement-breakpoint
CREATE TABLE `daily_spo2` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`average_spo2` real,
	`breathing_disturbance_index` real,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_spo2_day_unique` ON `daily_spo2` (`day`);--> statement-breakpoint
CREATE TABLE `medication_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`medication_id` integer NOT NULL,
	`day` text NOT NULL,
	`taken` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `medications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`dosage` text,
	`frequency` text,
	`is_active` integer DEFAULT 1,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions_oura` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`type` text,
	`mood` text,
	`start_datetime` text,
	`end_datetime` text,
	`avg_hr` real,
	`avg_hrv` real,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`day` text NOT NULL,
	`activity` text,
	`calories` real,
	`distance` real,
	`intensity` text,
	`start_datetime` text,
	`end_datetime` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `average_spo2` real;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `breathing_disturbance_index` real;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `workout_count` integer;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `workout_calories` real;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `meditation_minutes` real;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `mood_score` integer;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `energy_score` integer;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `irritability_score` integer;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `anxiety_score` integer;--> statement-breakpoint
ALTER TABLE `daily_analysis` ADD `medication_adherence` real;