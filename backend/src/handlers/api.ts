import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { ZodError } from 'zod';
import { runAnswerCorrectionAgent, evaluateInput } from '../agents/answerCorrection';
import { askDoubtInput, runDoubtSolverAgent } from '../agents/doubtSolver';
import { generateStoryInput, runStoryGeneratorAgent } from '../agents/storyGenerator';
import { HttpError, json, parseBody } from '../lib/http';
import { listStories, loadProgress, loadStoryRows, toClientStory } from '../services/storyService';
import { synthesize, synthesizeInput } from '../services/ttsService';
import { getOrCreateUser, preferencesSchema, toClientUser, updatePreferences } from '../services/userService';
import { deleteVocab, listVocab, saveVocab, vocabInput } from '../services/vocabService';
import { runConversationAgent, sendMessageInput } from '../agents/conversationAgent';
import { getOrCreateActiveConversation, createNewConversation } from '../services/conversationService';

type Event = APIGatewayProxyEventV2WithJWTAuthorizer;
type Ctx = { event: Event; params: string[] };
type Handler = (ctx: Ctx, user: Awaited<ReturnType<typeof getOrCreateUser>>) => Promise<unknown>;

const body = <T>(event: Event) => parseBody<T>(event.body, event.isBase64Encoded);

const routes: { method: string; pattern: RegExp; handler: Handler }[] = [
  { method: 'GET', pattern: /^\/api\/me$/, handler: async (_c, user) => toClientUser(user) },
  {
    method: 'PATCH',
    pattern: /^\/api\/me\/preferences$/,
    handler: async ({ event }, user) => {
      const input = preferencesSchema.parse(body(event));
      return toClientUser(await updatePreferences(user.id, input));
    },
  },
  { method: 'GET', pattern: /^\/api\/stories$/, handler: async (_c, user) => ({ stories: await listStories(user.id) }) },
  {
    method: 'GET',
    pattern: /^\/api\/stories\/([0-9a-f-]{36})$/i,
    handler: async ({ params }, user) => {
      const rows = await loadStoryRows(params[0], user.id);
      const progress = await loadProgress(params[0], user.id);
      const fb = progress?.aiFeedbackJson as { evaluations?: unknown[]; answers?: unknown[] } | undefined;
      return {
        story: toClientStory(rows),
        result: progress ? { score: progress.score, evaluations: fb?.evaluations ?? [], answers: fb?.answers ?? [] } : null,
      };
    },
  },
  {
    method: 'POST',
    pattern: /^\/api\/agents\/generate-story$/,
    handler: async ({ event }, user) => ({ story: await runStoryGeneratorAgent(user, generateStoryInput.parse(body(event))) }),
  },
  {
    method: 'POST',
    pattern: /^\/api\/agents\/evaluate-answers$/,
    handler: async ({ event }, user) => runAnswerCorrectionAgent(user, evaluateInput.parse(body(event))),
  },
  {
    method: 'POST',
    pattern: /^\/api\/agents\/ask-doubt$/,
    handler: async ({ event }, user) => runDoubtSolverAgent(user, askDoubtInput.parse(body(event))),
  },
  {
    method: 'POST',
    pattern: /^\/api\/tts\/synthesize$/,
    handler: async ({ event }) => synthesize(synthesizeInput.parse(body(event))),
  },
  { method: 'GET', pattern: /^\/api\/vocab$/, handler: async (_c, user) => ({ words: await listVocab(user.id) }) },
  {
    method: 'POST',
    pattern: /^\/api\/vocab$/,
    handler: async ({ event }, user) => ({ word: await saveVocab(user.id, vocabInput.parse(body(event))) }),
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/vocab\/(\d+)$/,
    handler: async ({ params }, user) => {
      await deleteVocab(user.id, Number(params[0]));
      return { ok: true };
    },
  },
  {
    method: 'GET',
    pattern: /^\/api\/conversation$/,
    handler: async (_c, user) => getOrCreateActiveConversation(user),
  },
  {
    method: 'POST',
    pattern: /^\/api\/conversation\/message$/,
    handler: async ({ event }, user) => runConversationAgent(user, sendMessageInput.parse(body(event))),
  },
  {
    method: 'POST',
    pattern: /^\/api\/conversation\/reset$/,
    handler: async ({ event }, user) => createNewConversation(user, body<{ title?: string }>(event)?.title),
  },
];

export const handler = async (event: Event): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath.replace(/\/+$/, '') || '/';
    if (method === 'OPTIONS') return { statusCode: 204 };

    for (const route of routes) {
      if (route.method !== method) continue;
      const m = route.pattern.exec(path);
      if (!m) continue;
      const user = await getOrCreateUser(event);
      return json(200, await route.handler({ event, params: m.slice(1) }, user));
    }
    return json(404, { error: 'Not found' });
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message });
    if (err instanceof ZodError) return json(400, { error: 'Invalid request', details: err.flatten() });
    console.error('Unhandled error', err);
    return json(500, { error: 'Internal server error' });
  }
};
