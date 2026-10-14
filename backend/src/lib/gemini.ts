import { GoogleGenAI, type Schema } from '@google/genai';
import { z } from 'zod';
import { HttpError } from './http';

let client: GoogleGenAI | undefined;

export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpError(500, 'GEMINI_API_KEY is not configured');
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

const CANDIDATE_MODELS = [
  GEMINI_MODEL,
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-flash-latest',
];

/** Calls Gemini with strict JSON-schema output and validates the result with zod. */
export async function generateStructured<T>(opts: {
  systemInstruction: string;
  prompt: string;
  responseSchema: Schema;
  validator: z.ZodType<T, z.ZodTypeDef, unknown>;
  temperature?: number;
}): Promise<T> {
  const ai = getClient();
  let lastError: unknown;
  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: opts.prompt,
          config: {
            systemInstruction: opts.systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: opts.responseSchema,
            temperature: opts.temperature ?? 0.8,
          },
        });
        const raw = (res.text ?? '').trim();
        const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        return opts.validator.parse(JSON.parse(cleaned));
      } catch (err) {
        lastError = err;
        console.warn(`Gemini structured call failed with ${model} (attempt ${attempt + 1})`, err);
      }
    }
  }
  throw new HttpError(502, `AI agent failed to produce a valid response: ${String(lastError)}`);
}

export async function generateChat(opts: {
  systemInstruction: string;
  history: { role: 'user' | 'model'; text: string }[];
  message: string;
}): Promise<string> {
  const ai = getClient();
  let lastError: unknown;
  for (const model of CANDIDATE_MODELS) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [
          ...opts.history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
          { role: 'user', parts: [{ text: opts.message }] },
        ],
        config: { systemInstruction: opts.systemInstruction, temperature: 0.5, maxOutputTokens: 700 },
      });
      return (res.text ?? '').trim();
    } catch (err) {
      lastError = err;
      console.warn(`Gemini chat call failed with ${model}`, err);
    }
  }
  throw new HttpError(502, `AI chat failed: ${String(lastError)}`);
}
