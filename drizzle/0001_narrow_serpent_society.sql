CREATE INDEX `idx_breaches_student_date` ON `breaches` (`student_name`,`occurrence_date`);--> statement-breakpoint
CREATE INDEX `idx_breaches_homegroup_actioned` ON `breaches` (`homegroup`,`actioned`);--> statement-breakpoint
CREATE INDEX `idx_breaches_occurred_at` ON `breaches` (`occurred_at`);--> statement-breakpoint
PRAGMA optimize;
