import { asc, eq, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { visitQuestions } from '../../../db/schema';
import * as schema from '../../../db/schema';
import type { VisitQuestion } from '../types';

export type VisitQuestionsDb = BaseSQLiteDatabase<'sync', any, typeof schema>;

export async function createVisitQuestion(
  db: VisitQuestionsDb,
  text: string,
  createdAt: string
): Promise<VisitQuestion> {
  const [inserted] = await db
    .insert(visitQuestions)
    .values({ text, createdAt, answeredAt: null })
    .returning({ id: visitQuestions.id });

  return { id: inserted.id, text, createdAt, answeredAt: null };
}

/** Alle Fragen, aelteste zuerst -- offene wie beantwortete. */
export async function listVisitQuestions(db: VisitQuestionsDb): Promise<VisitQuestion[]> {
  return db.select().from(visitQuestions).orderBy(asc(visitQuestions.createdAt));
}

/** Nur die offenen -- das ist, was in die Zusammenfassung gehoert. */
export async function listOpenVisitQuestions(db: VisitQuestionsDb): Promise<VisitQuestion[]> {
  return db
    .select()
    .from(visitQuestions)
    .where(isNull(visitQuestions.answeredAt))
    .orderBy(asc(visitQuestions.createdAt));
}

/** `answeredAt` null macht eine Frage wieder offen. */
export async function setVisitQuestionAnswered(
  db: VisitQuestionsDb,
  questionId: number,
  answeredAt: string | null
): Promise<void> {
  await db.update(visitQuestions).set({ answeredAt }).where(eq(visitQuestions.id, questionId));
}

export async function deleteVisitQuestion(db: VisitQuestionsDb, questionId: number): Promise<void> {
  await db.delete(visitQuestions).where(eq(visitQuestions.id, questionId));
}
