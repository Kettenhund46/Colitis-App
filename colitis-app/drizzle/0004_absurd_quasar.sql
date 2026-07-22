CREATE TABLE `knowledge_favorites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_favorites_article_slug_unique` ON `knowledge_favorites` (`article_slug`);