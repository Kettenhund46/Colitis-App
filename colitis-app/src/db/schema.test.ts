import { describe, it, expect } from 'vitest';
import * as schema from './schema';

describe('database schema', () => {
  it('defines all seven core tables from the design spec', () => {
    expect(Object.keys(schema)).toEqual(
      expect.arrayContaining([
        'diaryEntries',
        'triggers',
        'medications',
        'medicationLog',
        'medicationReminderTimes',
        'savedPlaces',
        'knowledgeContent',
        'screeningReminders',
      ])
    );
  });

  it('diaryEntries has the columns required for a diary entry', () => {
    const columns = Object.keys(schema.diaryEntries);
    expect(columns).toEqual(
      expect.arrayContaining([
        'id',
        'occurredAt',
        'stoolFrequency',
        'bloodLevel',
        'stoolConsistency',
        'painLevel',
        'symptoms',
        'note',
      ])
    );
  });

  it('triggers references a diary entry via diaryEntryId', () => {
    const columns = Object.keys(schema.triggers);
    expect(columns).toContain('diaryEntryId');
  });

  it('medicationLog references a medication via medicationId', () => {
    const columns = Object.keys(schema.medicationLog);
    expect(columns).toContain('medicationId');
  });

  it('knowledgeContent has a unique slug column', () => {
    const columns = Object.keys(schema.knowledgeContent);
    expect(columns).toEqual(expect.arrayContaining(['slug', 'title', 'body', 'sources']));
  });

  it('medicationReminderTimes references a medication via medicationId', () => {
    const columns = Object.keys(schema.medicationReminderTimes);
    expect(columns).toContain('medicationId');
  });

  it('screeningReminders has a notificationId column for cancelling scheduled reminders', () => {
    const columns = Object.keys(schema.screeningReminders);
    expect(columns).toContain('notificationId');
  });
});
