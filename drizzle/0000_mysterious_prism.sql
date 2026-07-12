CREATE TABLE `comics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`creator` text NOT NULL,
	`genre` text NOT NULL,
	`accent` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `panels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`comic_id` integer NOT NULL,
	`position` integer NOT NULL,
	`eyebrow` text NOT NULL,
	`line` text NOT NULL,
	`tone` text NOT NULL,
	FOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE cascade
);
