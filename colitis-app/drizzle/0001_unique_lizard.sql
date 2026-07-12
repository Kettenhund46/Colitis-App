CREATE TABLE `medication_reminder_times` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`medication_id` integer NOT NULL,
	`time` text NOT NULL,
	`notification_id` text,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `screening_reminders` ADD `notification_id` text;