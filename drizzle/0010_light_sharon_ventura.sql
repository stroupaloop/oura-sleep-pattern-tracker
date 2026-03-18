CREATE TABLE `hourly_heartrate` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`hour` integer NOT NULL,
	`avg_bpm` real,
	`min_bpm` integer,
	`max_bpm` integer,
	`sample_count` integer,
	`source` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hourly_hr_day_hour` ON `hourly_heartrate` (`day`,`hour`);