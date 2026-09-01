ALTER TABLE `diary_entries` ADD `blood_level` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `diary_entries` SET `blood_level` = 1 WHERE `has_blood` = 1;
