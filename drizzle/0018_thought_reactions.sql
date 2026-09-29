CREATE TABLE `thought_reactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thought_id` integer NOT NULL,
	`email` text NOT NULL,
	`emoji` text NOT NULL,
	`notified` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `thought_reactions_thought_email` ON `thought_reactions` (`thought_id`,`email`);--> statement-breakpoint
CREATE INDEX `thought_reactions_email_idx` ON `thought_reactions` (`email`,`updated_at`);