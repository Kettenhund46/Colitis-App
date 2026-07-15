CREATE TABLE `cached_feed_items` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`summary_de` text NOT NULL,
	`published_date` text NOT NULL,
	`url` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL
);
