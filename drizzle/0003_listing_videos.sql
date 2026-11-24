CREATE TABLE `listing_videos` (
	`id` text PRIMARY KEY NOT NULL,
	`house_id` text NOT NULL,
	`user_id` text NOT NULL,
	`settings` text NOT NULL,
	`transformation` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`public_id` text,
	`asset_id` text,
	`version` integer,
	`seconds` real,
	`bytes` integer,
	`latency_ms` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`house_id`) REFERENCES `houses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `listing_videos_house_idx` ON `listing_videos` (`house_id`);