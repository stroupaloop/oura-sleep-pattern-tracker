ALTER TABLE `medications` ADD `previous_version_id` integer REFERENCES medications(id);--> statement-breakpoint
CREATE UNIQUE INDEX `medications_previous_version_id_uniq` ON `medications` (`previous_version_id`) WHERE "medications"."previous_version_id" IS NOT NULL;
