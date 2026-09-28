CREATE TABLE `thought_link_clicks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thought_id` integer NOT NULL,
	`email` text,
	`user_agent` text,
	`alerted` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `thought_link_clicks_thought_idx` ON `thought_link_clicks` (`thought_id`,`created_at`);