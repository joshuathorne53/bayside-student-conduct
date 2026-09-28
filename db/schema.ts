import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const students = sqliteTable('students', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  homegroup: text('homegroup').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

export const breachTypes = sqliteTable('breach_types', {
  id: text('id').primaryKey(),
  label: text('label').notNull().unique(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

export const breaches = sqliteTable('breaches', {
  id: text('id').primaryKey(),
  recordNumber: integer('record_number').notNull(),
  kind: text('kind', { enum: ['uniform', 'phone'] }).notNull(),
  occurredAt: text('occurred_at').notNull(),
  occurrenceDate: text('occurrence_date').notNull(),
  studentName: text('student_name').notNull(),
  homegroup: text('homegroup').notNull(),
  breachType: text('breach_type').notNull(),
  notes: text('notes').notNull().default(''),
  enteredBy: text('entered_by').notNull(),
  dayCount: integer('day_count'),
  level: integer('level'),
  parentEmailDraft: text('parent_email_draft'),
  actioned: integer('actioned', { mode: 'boolean' }).notNull().default(false),
  actionedBy: text('actioned_by'),
  actionedAt: text('actioned_at'),
}, (table) => [
  index('idx_breaches_student_date').on(table.studentName, table.occurrenceDate),
  index('idx_breaches_homegroup_actioned').on(table.homegroup, table.actioned),
  index('idx_breaches_occurred_at').on(table.occurredAt),
]);
