ALTER TABLE `medications` ADD `units_per_intake` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `medications` ADD `pack_units` integer;--> statement-breakpoint
ALTER TABLE `medications` ADD `stock_units` integer;--> statement-breakpoint
ALTER TABLE `medications` ADD `supply_notification_id` text;