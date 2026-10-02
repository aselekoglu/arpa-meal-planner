CREATE TABLE `ingredients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meal_id` integer NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`measure` text NOT NULL,
	`calories` real DEFAULT 0,
	`protein` real DEFAULT 0,
	`fat` real DEFAULT 0,
	`carbs` real DEFAULT 0,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `meals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` text DEFAULT 'default' NOT NULL,
	`name` text NOT NULL,
	`tag` text,
	`image_url` text,
	`instructions` text,
	`source_url` text,
	`servings` integer DEFAULT 4 NOT NULL,
	`operation_key` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meals_operation_key_unique` ON `meals` (`operation_key`);--> statement-breakpoint
CREATE TABLE `pantry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` text DEFAULT 'default' NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`measure` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `planner` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family_id` text DEFAULT 'default' NOT NULL,
	`date` text NOT NULL,
	`meal_id` integer NOT NULL,
	`servings_override` integer,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mcp_previews` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer
);
