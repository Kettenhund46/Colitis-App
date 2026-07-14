CREATE TABLE `cached_toilets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`osm_id` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`name` text,
	`opening_hours` text
);
