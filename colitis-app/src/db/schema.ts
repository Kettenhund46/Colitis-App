import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const diaryEntries = sqliteTable('diary_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  occurredAt: text('occurred_at').notNull(),
  stoolFrequency: integer('stool_frequency').notNull(),
  /**
   * Blutbeimengung in vier Stufen, nach dem Blut-Teilwert des Mayo-Scores:
   * 0 kein Blut, 1 Schlieren, 2 sichtbares Blut, 3 nur Blut.
   */
  bloodLevel: integer('blood_level').notNull().default(0),
  /**
   * Stuhlgaenge, die den Schlaf unterbrochen haben. Gehen nicht in den
   * 6-Punkte-Mayo ein -- der kennt sie nicht --, sind aber ein starker
   * Hinweis auf Aktivitaet und stehen deshalb im Arztdokument.
   */
  nocturnalStools: integer('nocturnal_stools').notNull().default(0),
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
  sideEffectsNote: text('side_effects_note'),
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

export const knowledgeFavorites = sqliteTable('knowledge_favorites', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  articleSlug: text('article_slug').notNull().unique(),
});

export const screeningReminders = sqliteTable('screening_reminders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  intervalMonths: integer('interval_months').notNull(),
  nextDueDate: text('next_due_date').notNull(),
  note: text('note'),
  notificationId: text('notification_id'),
});

export const cachedToilets = sqliteTable('cached_toilets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  osmId: text('osm_id').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  name: text('name'),
  openingHours: text('opening_hours'),
});

export const cachedFeedItems = sqliteTable('cached_feed_items', {
  id: text('id').primaryKey(),
  source: text('source', { enum: ['pubmed', 'awmf', 'fda', 'ema'] }).notNull(),
  category: text('category', { enum: ['studie', 'leitlinie', 'zulassung'] }).notNull(),
  title: text('title').notNull(),
  summaryDe: text('summary_de').notNull(),
  publishedDate: text('published_date').notNull(),
  url: text('url').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
});

export const doctorVisits = sqliteTable('doctor_visits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  visitDate: text('visit_date').notNull(),
  doctorName: text('doctor_name'),
  reason: text('reason'),
  note: text('note'),
  nextAppointmentDate: text('next_appointment_date'),
  nextAppointmentNotificationId: text('next_appointment_notification_id'),
});
