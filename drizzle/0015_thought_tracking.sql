CREATE TABLE `site_visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`visitor_id` text NOT NULL,
	`path` text NOT NULL,
	`email` text,
	`is_authed` integer NOT NULL,
	`ip` text,
	`city` text,
	`region` text,
	`country` text,
	`user_agent` text,
	`referrer` text,
	`alerted` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `site_visits_visitor_idx` ON `site_visits` (`visitor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `site_visits_created_idx` ON `site_visits` (`created_at`);--> statement-breakpoint
CREATE TABLE `thoughts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text NOT NULL,
	`kind` text DEFAULT 'thought' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`slot` text,
	`note` text,
	`link` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `thoughts_day_idx` ON `thoughts` (`day`);--> statement-breakpoint
CREATE INDEX `thoughts_created_idx` ON `thoughts` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `thoughts_slot_uniq` ON `thoughts` (`slot`) WHERE "thoughts"."slot" IS NOT NULL;