CREATE TABLE `contact` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`links` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deploys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_id` integer NOT NULL,
	`site` text NOT NULL,
	`dispatched_at` text NOT NULL,
	`error` text,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `educations` (
	`id` text PRIMARY KEY NOT NULL,
	`degree` text NOT NULL,
	`school` text NOT NULL,
	`start` text NOT NULL,
	`end` text,
	`details` text NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `experiences` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`company` text NOT NULL,
	`kind` text NOT NULL,
	`start` text NOT NULL,
	`end` text,
	`summary` text,
	`missions` text NOT NULL,
	`techs` text NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media` (
	`file` text PRIMARY KEY NOT NULL,
	`original_name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`city` text NOT NULL,
	`about` text,
	`search` text NOT NULL,
	`goals` text NOT NULL,
	`motivations` text NOT NULL,
	`frustrations` text NOT NULL,
	`work_style` text NOT NULL,
	`soft_skills` text NOT NULL,
	`hobbies` text NOT NULL,
	`cv_file` text
);
--> statement-breakpoint
CREATE TABLE `project_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category_id` text NOT NULL,
	`summary` text NOT NULL,
	`context` text,
	`work` text,
	`result` text,
	`techs` text NOT NULL,
	`links` text NOT NULL,
	`captures` text NOT NULL,
	`hidden` integer NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `skill_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`skills` text NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`published_at` text NOT NULL,
	`content` text NOT NULL
);
