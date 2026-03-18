CREATE TABLE `health_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`signal_type` text NOT NULL,
	`status` text NOT NULL,
	`confidence` real NOT NULL,
	`indicators` text,
	`summary` text,
	`details` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `health_signal_day_type` ON `health_signals` (`day`,`signal_type`);