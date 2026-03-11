CREATE TABLE `daily_heartrate` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`avg_bpm` real,
	`min_bpm` integer,
	`max_bpm` integer,
	`resting_bpm` real,
	`awake_bpm` real,
	`sample_count` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_heartrate_day_unique` ON `daily_heartrate` (`day`);