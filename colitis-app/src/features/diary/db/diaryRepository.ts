import { desc, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { diaryEntries, triggers } from '../../../db/schema';
import * as schema from '../../../db/schema';
import type { NewDiaryEntryInput, DiaryEntryWithTriggers } from '../types';

export type DiaryDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function createDiaryEntry(db: DiaryDb, input: NewDiaryEntryInput): Promise<number> {
  const [inserted] = await db
    .insert(diaryEntries)
    .values({
      occurredAt: input.occurredAt,
      stoolFrequency: input.stoolFrequency,
      hasBlood: input.hasBlood,
      stoolConsistency: input.stoolConsistency,
      painLevel: input.painLevel,
      symptoms: input.symptoms.join(','),
      note: input.note,
    })
    .returning({ id: diaryEntries.id });

  const entryId = inserted.id;

  for (const triggerCategory of input.triggerCategories) {
    await db.insert(triggers).values({
      diaryEntryId: entryId,
      category: triggerCategory,
      note: null,
    });
  }

  return entryId;
}

export async function deleteDiaryEntry(db: DiaryDb, entryId: number): Promise<void> {
  await db.delete(triggers).where(eq(triggers.diaryEntryId, entryId));
  await db.delete(diaryEntries).where(eq(diaryEntries.id, entryId));
}

export async function listDiaryEntries(db: DiaryDb): Promise<DiaryEntryWithTriggers[]> {
  const entries = await db.select().from(diaryEntries).orderBy(desc(diaryEntries.occurredAt));

  const result: DiaryEntryWithTriggers[] = [];
  for (const entry of entries) {
    const entryTriggers = await db.select().from(triggers).where(eq(triggers.diaryEntryId, entry.id));

    result.push({
      id: entry.id,
      occurredAt: entry.occurredAt,
      stoolFrequency: entry.stoolFrequency,
      hasBlood: entry.hasBlood,
      stoolConsistency: entry.stoolConsistency,
      painLevel: entry.painLevel,
      symptoms: entry.symptoms.length > 0 ? entry.symptoms.split(',') : [],
      note: entry.note,
      triggerCategories: entryTriggers.map((trigger) => trigger.category),
    });
  }

  return result;
}
