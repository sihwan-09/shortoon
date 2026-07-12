CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`comic_id` integer NOT NULL,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `comics` ADD `publisher` text DEFAULT 'NAVER' NOT NULL;--> statement-breakpoint
ALTER TABLE `comics` ADD `full_url` text DEFAULT 'https://comic.naver.com' NOT NULL;