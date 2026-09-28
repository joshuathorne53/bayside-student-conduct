CREATE TABLE `breach_types` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `breach_types_label_unique` ON `breach_types` (`label`);--> statement-breakpoint
CREATE TABLE `breaches` (
	`id` text PRIMARY KEY NOT NULL,
	`record_number` integer NOT NULL,
	`kind` text NOT NULL,
	`occurred_at` text NOT NULL,
	`occurrence_date` text NOT NULL,
	`student_name` text NOT NULL,
	`homegroup` text NOT NULL,
	`breach_type` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`entered_by` text NOT NULL,
	`day_count` integer,
	`level` integer,
	`parent_email_draft` text,
	`actioned` integer DEFAULT false NOT NULL,
	`actioned_by` text,
	`actioned_at` text
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`homegroup` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
