CREATE TABLE `photo_edits` (
	`id` text PRIMARY KEY NOT NULL,
	`photo_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`source_edit_id` text,
	`params` text NOT NULL,
	`transformation` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`public_id` text,
	`asset_id` text,
	`version` integer,
	`width` integer,
	`height` integer,
	`bytes` integer,
	`format` text,
	`cost_transformations` integer DEFAULT 0 NOT NULL,
	`latency_ms` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `photo_edits_photo_idx` ON `photo_edits` (`photo_id`);--> statement-breakpoint
ALTER TABLE `photos` ADD `active_edit_id` text;