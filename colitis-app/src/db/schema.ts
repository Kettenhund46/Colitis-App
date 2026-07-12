import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const diaryEntries = sqliteTable('diary_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  occurredAt: text('occurred_at').notNull(),
  stoolFrequency: integer('stool_frequency').notNull(),
  hasBlood: integer('has_blood', { mode: 'boolean' }).notNull(),
  stoolConsistency: text('stool_consistency').notNull(),
  painLevel: integer('pain_level').notNull(),
  symptoms: text('symptoms').notNull(),
  note: text('note'),
});

export const triggers = sqliteTable('triggers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  diaryEntryId: integer('diary_entry_id')
    .notNull()
    .references(() => diaryEntries.id),
  category: text('category', {
    enum: ['ernaehrung', 'stress', 'schlaf', 'medikament', 'sonstiges'],
  }).notNull(),
  note: text('note'),
});

export const medications = sqliteTable('medications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  dose: text('dose').notNull(),
  schedule: text('schedule').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
});

export const medicationLog = sqliteTable('medication_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  medicationId: integer('medication_id')
    .notNull()
    .references(() => medications.id),
  takenAt: text('taken_at').notNull(),
});

export const medicationReminderTimes = sqliteTable('medication_reminder_times', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  medicationId: integer('medication_id')
    .notNull()
    .references(() => medications.id),
  time: text('time').notNull(),
  notificationId: text('notification_id'),
});

export const savedPlaces = sqliteTable('saved_places', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  note: text('note'),
  category: text('category').notNull(),
});

export const knowledgeContent = sqliteTable('knowledge_content', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  sources: text('sources').notNull(),
});

export const screeningReminders = sqliteTable('screening_reminders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  intervalMonths: integer('interval_months').notNull(),
  nextDueDate: text('next_due_date').notNull(),
  note: text('note'),
  notificationId: text('notification_id'),
});
