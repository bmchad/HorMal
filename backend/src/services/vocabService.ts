import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '../db/client';

const { userVocabulary } = schema;

export const vocabInput = z.object({
  targetLanguage: z.string().max(16),
  word: z.string().trim().min(1).max(255),
  gender: z.string().max(16).optional().default(''),
  plural: z.string().max(255).optional().default(''),
  pos: z.string().max(32).optional().default(''),
  note: z.string().max(1000).optional().default(''),
});

export async function listVocab(userId: string) {
  const rows = await getDb()
    .select()
    .from(userVocabulary)
    .where(eq(userVocabulary.userId, userId))
    .orderBy(desc(userVocabulary.savedAt));
  return rows.map((r) => ({ ...r, savedAt: r.savedAt.toISOString() }));
}

export async function saveVocab(userId: string, input: z.infer<typeof vocabInput>) {
  const [row] = await getDb()
    .insert(userVocabulary)
    .values({ userId, ...input })
    .onConflictDoUpdate({
      target: [userVocabulary.userId, userVocabulary.targetLanguage, userVocabulary.word],
      set: { gender: input.gender, plural: input.plural, pos: input.pos, note: input.note },
    })
    .returning();
  return { ...row, savedAt: row.savedAt.toISOString() };
}

export async function deleteVocab(userId: string, id: number) {
  await getDb().delete(userVocabulary).where(and(eq(userVocabulary.id, id), eq(userVocabulary.userId, userId)));
}
