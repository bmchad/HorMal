import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { getDb, schema } from '../db/client';
import { CEFR_LEVELS, TARGET_LANGUAGES, UI_LANGUAGES, VOICE_ENGINES } from '../lib/constants';
import { HttpError } from '../lib/http';

const { users } = schema;

export type UserRow = typeof users.$inferSelect;

export function toClientUser(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl,
    uiLanguage: u.uiLanguage,
    targetLanguage: u.targetLanguage,
    cefrLevel: u.cefrLevel,
    preferredVoiceEngine: u.preferredVoiceEngine,
  };
}

/** Resolves (and lazily creates) the DB user from the verified Cognito JWT claims. */
export async function getOrCreateUser(event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<UserRow> {
  const claims = event.requestContext.authorizer?.jwt?.claims as Record<string, string> | undefined;
  const sub = claims?.sub;
  if (!sub) throw new HttpError(401, 'Unauthorized');
  const email = claims?.email ?? `${sub}@unknown.local`;
  const name = claims?.name ?? claims?.given_name ?? null;
  const avatar = claims?.picture ?? null;

  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.cognitoSub, sub)).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({ cognitoSub: sub, email, name, avatarUrl: avatar })
    .onConflictDoUpdate({ target: users.cognitoSub, set: { email, name, avatarUrl: avatar, updatedAt: new Date() } })
    .returning();
  return created;
}

export const preferencesSchema = z
  .object({
    uiLanguage: z.enum(UI_LANGUAGES),
    targetLanguage: z.enum(TARGET_LANGUAGES),
    cefrLevel: z.enum(CEFR_LEVELS),
    preferredVoiceEngine: z.enum(VOICE_ENGINES),
  })
  .partial();

export async function updatePreferences(userId: string, input: z.infer<typeof preferencesSchema>) {
  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}
