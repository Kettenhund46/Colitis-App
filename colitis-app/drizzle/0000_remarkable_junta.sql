CREATE TABLE `diary_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`occurred_at` text NOT NULL,
	`stool_frequency` integer NOT NULL,
	`has_blood` integer NOT NULL,
	`stool_consistency` text NOT NULL,
	`pain_level` integer NOT NULL,
	`symptoms` text NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `knowledge_content` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`sources` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_content_slug_unique` ON `knowledge_content` (`slug`);--> statement-breakpoint
CREATE TABLE `medication_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`medication_id` integer NOT NULL,
	`taken_at` text NOT NULL,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `medications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`dose` text NOT NULL,
	`schedule` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text
);
--> statement-breakpoint
CREATE TABLE `saved_places` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`note` text,
	`category` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `screening_reminders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`interval_months` integer NOT NULL,
	`next_due_date` text NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `triggers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`diary_entry_id` integer NOT NULL,
	`category` text NOT NULL,
	`note` text,
	FOREIGN KEY (`diary_entry_id`) REFERENCES `diary_entries`(`id`) ON UPDATE no action ON DELETE no action
);
