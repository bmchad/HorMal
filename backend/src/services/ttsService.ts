import { createHash } from 'node:crypto';
import { PollyClient, SynthesizeSpeechCommand, type Engine, type VoiceId } from '@aws-sdk/client-polly';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '../db/client';
import { TARGET_LANGUAGES, VOICE_ENGINES, type VoiceEngine } from '../lib/constants';
import { HttpError } from '../lib/http';

export const synthesizeInput = z.object({
  text: z.string().trim().min(1).max(700),
  targetLanguage: z.enum(TARGET_LANGUAGES),
  engine: z.enum(VOICE_ENGINES),
  voiceId: z.string().max(64).optional(),
});

/** Feminine Polly voice candidates per language, in priority order. Each tries generative → neural. */
const POLLY_VOICES: Record<string, string[]> = {
  'de-DE': ['Vicki'],
  'fr-FR': ['Gabrielle', 'Lea'],
  'es-ES': ['Lucia'],
  'it-IT': ['Beatrice', 'Bianca'],
  'en-US': ['Ruth', 'Danielle'],
  'pt-BR': ['Camila', 'Vitoria'],
};
const ES_US_VOICE = 'Lupe';

const OPENAI_DEFAULT_VOICE = 'nova'; // alternatives: shimmer, coral

const GOOGLE_TTS_VOICES: Record<string, string[]> = {
  'de-DE': ['de-DE-Chirp3-HD-Aoede', 'de-DE-Neural2-F'],
  'fr-FR': ['fr-FR-Chirp3-HD-Aoede', 'fr-FR-Neural2-A'],
  'es-ES': ['es-ES-Chirp3-HD-Aoede', 'es-ES-Neural2-A'],
  'it-IT': ['it-IT-Chirp3-HD-Aoede', 'it-IT-Neural2-A'],
  'en-US': ['en-US-Chirp3-HD-Aoede', 'en-US-Neural2-F'],
  'pt-BR': ['pt-BR-Chirp3-HD-Aoede', 'pt-BR-Neural2-A'],
};

export function defaultVoiceId(engine: VoiceEngine, language: string): string {
  switch (engine) {
    case 'google_cloud_tts':
      return (GOOGLE_TTS_VOICES[language] ?? GOOGLE_TTS_VOICES['en-US'])[0];
    case 'polly_generative':
      return (POLLY_VOICES[language] ?? POLLY_VOICES['en-US'])[0];
    case 'openai_tts':
      return OPENAI_DEFAULT_VOICE;
    default:
      return 'browser';
  }
}

let polly: PollyClient | undefined;
let s3: S3Client | undefined;
const getPolly = () => (polly ??= new PollyClient({}));
const getS3 = () => (s3 ??= new S3Client({}));

async function synthesizeGoogleCloud(text: string, language: string, voiceId: string): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpError(503, 'Google Cloud TTS API key is not configured');

  const candidates = [voiceId, ...(GOOGLE_TTS_VOICES[language] ?? [])];
  const unique = [...new Set(candidates)];
  let lastErr: unknown;

  for (const voice of unique) {
    try {
      const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: language,
            name: voice,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1.0,
          },
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(`Google TTS status ${res.status}: ${JSON.stringify(errJson)}`);
      }
      const data = (await res.json()) as { audioContent?: string };
      if (!data.audioContent) throw new Error('Google TTS returned empty audio');
      return Buffer.from(data.audioContent, 'base64');
    } catch (err) {
      lastErr = err;
    }
  }
  throw new HttpError(502, `Google Cloud TTS failed: ${String(lastErr)}`);
}

async function synthesizePolly(text: string, language: string, voiceId: string): Promise<Buffer> {
  const candidates = [voiceId, ...(POLLY_VOICES[language] ?? [])];
  if (language === 'es-ES') candidates.push(ES_US_VOICE);
  const unique = [...new Set(candidates)];
  let lastErr: unknown;
  for (const voice of unique) {
    for (const engine of ['generative', 'neural'] as Engine[]) {
      try {
        const res = await getPolly().send(
          new SynthesizeSpeechCommand({
            Text: text,
            VoiceId: voice as VoiceId,
            Engine: engine,
            OutputFormat: 'mp3',
            SampleRate: '24000',
          }),
        );
        if (!res.AudioStream) throw new Error('Polly returned an empty stream');
        return Buffer.from(await res.AudioStream.transformToByteArray());
      } catch (err) {
        lastErr = err;
      }
    }
  }
  throw new HttpError(502, `Polly synthesis failed: ${String(lastErr)}`);
}

async function synthesizeOpenAI(text: string, language: string, voiceId: string): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new HttpError(503, 'OpenAI TTS is not configured');
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
      voice: voiceId,
      input: text,
      response_format: 'mp3',
      instructions: `Speak in the language with locale ${language}, using a warm, natural, friendly feminine voice at a clear, calm pace for language learners.`,
    }),
  });
  if (!res.ok) throw new HttpError(502, `OpenAI TTS failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export interface SynthesizeResult {
  engine: VoiceEngine;
  voiceId: string;
  url: string | null;
  cached: boolean;
}

/** POST /api/tts/synthesize — deterministic S3 + CloudFront audio caching pipeline. */
export async function synthesize(input: z.infer<typeof synthesizeInput>): Promise<SynthesizeResult> {
  const { engine, targetLanguage } = input;
  const text = input.text.trim();

  // $0.00 client-side engine: the browser speaks it, nothing to synthesize or cache.
  if (engine === 'browser_natural') return { engine, voiceId: 'browser', url: null, cached: true };

  const voiceId = input.voiceId || defaultVoiceId(engine, targetLanguage);
  const hash = createHash('sha256').update(`${engine}:${voiceId}:${targetLanguage}:${text}`).digest('hex');
  const db = getDb();

  const [hit] = await db.select().from(schema.audioCache).where(eq(schema.audioCache.hash, hash)).limit(1);
  if (hit) return { engine, voiceId, url: hit.cloudfrontUrl, cached: true };

  const bucket = process.env.AUDIO_BUCKET;
  // Empty => same-origin relative URL served by the CloudFront /audio-cache/* behavior.
  const cdnDomain = process.env.AUDIO_CDN_DOMAIN;
  if (!bucket) throw new HttpError(500, 'Audio storage is not configured');

  const audio =
    engine === 'google_cloud_tts'
      ? await synthesizeGoogleCloud(text, targetLanguage, voiceId)
      : engine === 'polly_generative'
        ? await synthesizePolly(text, targetLanguage, voiceId)
        : await synthesizeOpenAI(text, targetLanguage, voiceId);

  const s3Key = `audio-cache/${hash}.mp3`;
  await getS3().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: audio,
      ContentType: 'audio/mpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  const url = cdnDomain ? `https://${cdnDomain}/${s3Key}` : `/${s3Key}`;
  await db
    .insert(schema.audioCache)
    .values({ hash, engine, voiceId, targetLanguage, s3Key, cloudfrontUrl: url })
    .onConflictDoNothing();

  return { engine, voiceId, url, cached: false };
}
