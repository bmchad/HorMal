import fs from 'node:fs';
import path from 'node:path';

function loadEnvKeys() {
  let envContent = '';
  const rootEnv = path.resolve(process.cwd(), '../.env');
  const localEnv = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(rootEnv)) {
    envContent = fs.readFileSync(rootEnv, 'utf8');
  } else if (fs.existsSync(localEnv)) {
    envContent = fs.readFileSync(localEnv, 'utf8');
  }

  const get = (k) => {
    const m = envContent.match(new RegExp(`^${k}=["']?(.*?)["']?$`, 'm'));
    return m ? m[1].trim() : process.env[k] || '';
  };

  return {
    geminiKey: get('GEMINI_API_KEY'),
    ttsKey: get('GOOGLE_TTS_API_KEY') || get('GEMINI_API_KEY'),
    model: get('GEMINI_MODEL') || 'gemini-3.5-flash',
  };
}

const GOOGLE_TTS_MAP = {
  'de-DE': { chirp3_hd: 'de-DE-Chirp3-HD-Aoede', neural2: 'de-DE-Neural2-F' },
  'fr-FR': { chirp3_hd: 'fr-FR-Chirp3-HD-Aoede', neural2: 'fr-FR-Neural2-A' },
  'es-ES': { chirp3_hd: 'es-ES-Chirp3-HD-Aoede', neural2: 'es-ES-Neural2-A' },
  'it-IT': { chirp3_hd: 'it-IT-Chirp3-HD-Aoede', neural2: 'it-IT-Neural2-A' },
  'en-US': { chirp3_hd: 'en-US-Chirp3-HD-Aoede', neural2: 'en-US-Neural2-F' },
  'pt-BR': { chirp3_hd: 'pt-BR-Chirp3-HD-Aoede', neural2: 'pt-BR-Neural2-A' },
};

const CANDIDATE_GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

async function callGemini(apiKey, prompt, systemInstruction, isJson) {
  let lastErr;
  for (const model of CANDIDATE_GEMINI_MODELS) {
    try {
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
      };
      if (systemInstruction) {
        body.systemInstruction = { parts: [{ text: systemInstruction }] };
      }
      if (isJson) {
        body.generationConfig = { responseMimeType: 'application/json' };
      }
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
      if (data.error?.message) {
        throw new Error(data.error.message);
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Gemini call failed on all models: ${String(lastErr)}`);
}

export function devApiPlugin() {
  return {
    name: 'dev-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (!url?.startsWith('/api/')) return next();

        const { geminiKey, ttsKey } = loadEnvKeys();

        const sendJson = (status, data) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };

        const readBody = async () => {
          const chunks = [];
          for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          const text = Buffer.concat(chunks).toString('utf8');
          return text ? JSON.parse(text) : {};
        };

        try {
          if (url === '/api/tts/synthesize' && req.method === 'POST') {
            const body = await readBody();
            const text = String(body.text || '').trim();
            const lang = String(body.targetLanguage || 'de-DE');
            const variant = String(body.voiceId || '');

            if (!ttsKey) {
              return sendJson(200, { engine: 'browser_natural', voiceId: 'browser', url: null, cached: true });
            }

            const map = GOOGLE_TTS_MAP[lang] ?? GOOGLE_TTS_MAP['de-DE'];
            const candidateVoices =
              variant === 'neural2'
                ? [map.neural2, map.chirp3_hd]
                : [map.chirp3_hd, map.neural2];

            for (const voice of candidateVoices) {
              try {
                const ttsRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${ttsKey}`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({
                    input: { text },
                    voice: { languageCode: lang, name: voice },
                    audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0 },
                  }),
                });

                const data = await ttsRes.json();
                if (data.audioContent) {
                  return sendJson(200, {
                    engine: 'google_cloud_tts',
                    voiceId: voice,
                    url: `data:audio/mp3;base64,${data.audioContent}`,
                    cached: false,
                  });
                }
              } catch {}
            }

            return sendJson(200, { engine: 'browser_natural', voiceId: 'browser', url: null, cached: true });
          }

          if (url === '/api/agents/generate-story' && req.method === 'POST') {
            const body = await readBody();
            if (!geminiKey) return next();

            const theme = String(body.theme || 'science_nature');
            const targetLang = String(body.targetLanguage || 'de-DE');
            const uiLang = String(body.uiLanguage || 'en-US');
            const cefr = String(body.cefrLevel || 'A2');
            const extra = body.additionalInstructions ? `Keywords/Instructions: "${body.additionalInstructions}"` : '';

            const prompt = `Write a listening practice story for a language learner.
Target Language: ${targetLang}
Learner's Native/UI Language: ${uiLang}
Theme: ${theme}
CEFR Level: ${cefr}
${extra}

STRICT REQUIREMENTS:
1. Story must have EXACTLY 6 sentences in ${targetLang}.
2. Provide precise translation for each sentence in ${uiLang}.
3. Create EXACTLY 6 comprehension questions in ${targetLang} with their ${uiLang} translation, and model answers.
4. The 6 questions MUST NOT be in chronological order of the story. They must test deep comprehension, not sentence order.

Output ONLY valid JSON matching this schema:
{
  "title": "Short title in target language",
  "sentences": [
    { "index": 0, "target": "Sentence in target language", "ui": "Translation" }
  ],
  "questions": [
    { "order": 0, "questionTarget": "Question text in target language", "questionUi": "Translation", "modelAnswerTarget": "Model answer", "modelAnswerUi": "Answer translation" }
  ]
}`;

            const raw = await callGemini(geminiKey, prompt, 'You are an expert language teacher and storyteller.', true);
            const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
            const parsed = JSON.parse(cleaned);

            const story = {
              id: 'story_' + Date.now(),
              title: parsed.title || 'Neues Abenteuer',
              theme,
              additionalInstructions: body.additionalInstructions || null,
              targetLanguage: targetLang,
              uiLanguage: uiLang,
              cefrLevel: cefr,
              createdAt: new Date().toISOString(),
              sentences: parsed.sentences,
              questions: (parsed.questions || []).map((q, idx) => ({
                id: Date.now() + idx,
                order: q.order ?? idx,
                questionTarget: q.questionTarget,
                questionUi: q.questionUi,
                modelAnswerTarget: q.modelAnswerTarget,
                modelAnswerUi: q.modelAnswerUi,
              })),
            };

            return sendJson(200, { story });
          }

          if (url === '/api/agents/evaluate-answers' && req.method === 'POST') {
            const body = await readBody();
            if (!geminiKey) return next();

            const answers = body.answers || [];
            const targetLang = String(body.targetLanguage || 'de-DE');
            const uiLang = String(body.uiLanguage || 'en-US');

            const prompt = `You are a warm, encouraging language tutor evaluating learner answers.
Target Language: ${targetLang}
Learner UI Language for feedback: ${uiLang}

Learner answers to evaluate:
${JSON.stringify(answers, null, 2)}

For EACH question, evaluate:
- status: "correct" | "partial" | "incorrect"
- score: 0 to 100 for this answer
- correctedSentence: natural, correct version of the learner's answer
- feedback: short friendly feedback in ${uiLang}
- grammarPoints: array of short grammar notes in ${uiLang}
- vocabulary: array of { word, translation, gender?, plural? } for useful words from this item

Output ONLY JSON:
{
  "score": average overall score (0-100),
  "evaluations": [
    {
      "questionId": id,
      "sentenceCorrection": {
        "status": "correct" | "partial" | "incorrect",
        "correctedSentence": "string",
        "modelAnswer": "string",
        "translation": "string",
        "grammarFeedback": "string"
      },
      "grammarNotes": ["string"],
      "vocabularyExtracted": [{ "word": "string", "translation": "string", "article": "string", "plural": "string" }]
    }
  ]
}`;

            const raw = await callGemini(geminiKey, prompt, 'You are an empathetic, precise language tutor.', true);
            const cleaned = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
            const parsed = JSON.parse(cleaned);

            return sendJson(200, {
              storyId: body.storyId,
              score: parsed.score ?? 85,
              evaluations: parsed.evaluations ?? [],
              answers: body.answers,
            });
          }

          if (url === '/api/agents/ask-doubt' && req.method === 'POST') {
            const body = await readBody();
            if (!geminiKey) return next();

            const prompt = `Learner has a question about a listening practice story.
Context: "${body.selectedSentenceOrQuestionContext || 'Story context'}"
Question: "${body.userQuestion}"
Respond warmly and concisely in 2-4 sentences in the learner's language (${body.uiLanguage || 'the language they asked in'}). Focus on clarity and practical understanding for a mobile screen.`;

            const reply = await callGemini(geminiKey, prompt, 'You are a warm, concise language tutor on mobile.');
            return sendJson(200, { reply });
          }

          return next();
        } catch (err) {
          console.error('[devApiPlugin error]', err);
          return sendJson(500, { error: String(err) });
        }
      });
    },
  };
}
