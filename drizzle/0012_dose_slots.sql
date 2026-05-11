ALTER TABLE `medications` ADD `dose_schedule` text;--> statement-breakpoint
ALTER TABLE `medication_logs` ADD `slot` text;--> statement-breakpoint
DROP INDEX `medication_logs_med_day_uniq`;--> statement-breakpoint
UPDATE `medication_logs` SET `slot` = 'morning' WHERE `slot` IS NULL;--> statement-breakpoint
UPDATE `medications` SET `dose_schedule` = '["morning","evening"]' WHERE `dose_schedule` IS NULL AND `frequency` = 'twice_daily';--> statement-breakpoint
UPDATE `medications` SET `dose_schedule` = '["morning"]' WHERE `dose_schedule` IS NULL AND (`frequency` IS NULL OR `frequency` IN ('daily','weekly'));--> statement-breakpoint
CREATE UNIQUE INDEX `medication_logs_med_day_slot_uniq` ON `medication_logs` (`medication_id`,`day`,`slot`) WHERE `slot` IS NOT NULL;
