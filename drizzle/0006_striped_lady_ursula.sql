CREATE TABLE `notification_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`destination` text NOT NULL,
	`enabled` integer DEFAULT 1,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `medications` ADD `start_date` text;--> statement-breakpoint
ALTER TABLE `medications` ADD `end_date` text;