CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`union_id` text,
	`nickname` text,
	`avatar_url` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_provider_uid` ON `accounts` (`provider`,`provider_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_user_provider` ON `accounts` (`user_id`,`provider`);--> statement-breakpoint
CREATE TABLE `mock_oauth_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`profile_json` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer
);
--> statement-breakpoint
CREATE TABLE `mock_trades` (
	`out_trade_no` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`amount_fen` integer NOT NULL,
	`state` text NOT NULL,
	`trade_no` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`out_trade_no` text NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`subject` text NOT NULL,
	`amount_fen` integer NOT NULL,
	`currency` text DEFAULT 'CNY' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider_trade_no` text,
	`code_url` text,
	`failure_reason` text,
	`expires_at` integer NOT NULL,
	`paid_at` integer,
	`closed_at` integer,
	`last_queried_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_out_trade_no_unique` ON `orders` (`out_trade_no`);--> statement-breakpoint
CREATE INDEX `orders_user_created` ON `orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`event_id` text NOT NULL,
	`source` text NOT NULL,
	`out_trade_no` text NOT NULL,
	`event_type` text NOT NULL,
	`outcome` text NOT NULL,
	`detail` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_events_provider_event` ON `payment_events` (`provider`,`event_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
