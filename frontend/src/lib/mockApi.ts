/** In-browser fake backend used by `npm run dev:mock` so the full UX can be explored without AWS. */
import type {
  ChatMessage,
  Conversation,
  ConversationMessage,
  EvalResult,
  Evaluation,
  Profile,
  SavedWord,
  Story,
  StorySummary,
  SynthesizeResponse,
  VocabWord,
} from '../types';
import type { GenerateStoryInput, StoryWithResult } from './api';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const load = <T,>(k: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(`hormal-mock:${k}`) ?? '') as T;
  } catch {
    return fallback;
  }
};
const save = (k: string, v: unknown) => localStorage.setItem(`hormal-mock:${k}`, JSON.stringify(v));

interface Seed {
  title: string;
  theme: string;
  sentences: [string, string][];
  /** questions already in non-chronological order */
  questions: { q: string; qUi: string; a: string; aUi: string }[];
}

const SEEDS: Seed[] = [
  {
    title: 'Die fleißigen Bienen',
    theme: 'science_nature',
    sentences: [
      ['Im Garten von Anna leben viele Bienen.', "Many bees live in Anna's garden."],
      ['Jeden Morgen fliegen sie zu den bunten Blumen.', 'Every morning they fly to the colorful flowers.'],
      ['Eine Biene besucht an einem Tag mehr als tausend Blumen.', 'One bee visits more than a thousand flowers in a day.'],
      ['Aus dem Nektar machen die Bienen süßen Honig.', 'The bees make sweet honey from the nectar.'],
      ['Anna isst jeden Sonntag Honig mit Brot.', 'Anna eats honey with bread every Sunday.'],
      ['Ohne Bienen gäbe es viel weniger Obst und Gemüse.', 'Without bees there would be much less fruit and vegetables.'],
    ],
    questions: [
      { q: 'Was machen die Bienen aus dem Nektar?', qUi: 'What do the bees make from the nectar?', a: 'Sie machen süßen Honig.', aUi: 'They make sweet honey.' },
      { q: 'Wo leben die Bienen?', qUi: 'Where do the bees live?', a: 'Sie leben in Annas Garten.', aUi: "They live in Anna's garden." },
      { q: 'Was passiert ohne Bienen?', qUi: 'What happens without bees?', a: 'Es gibt weniger Obst und Gemüse.', aUi: 'There is less fruit and vegetables.' },
      { q: 'Wie viele Blumen besucht eine Biene an einem Tag?', qUi: 'How many flowers does a bee visit in a day?', a: 'Sie besucht mehr als tausend Blumen.', aUi: 'It visits more than a thousand flowers.' },
      { q: 'Was isst Anna am Sonntag?', qUi: 'What does Anna eat on Sunday?', a: 'Sie isst Honig mit Brot.', aUi: 'She eats honey with bread.' },
      { q: 'Wann fliegen die Bienen zu den Blumen?', qUi: 'When do the bees fly to the flowers?', a: 'Sie fliegen jeden Morgen zu den Blumen.', aUi: 'They fly to the flowers every morning.' },
    ],
  },
  {
    title: 'Reise zum Mond',
    theme: 'space_cosmos',
    sentences: [
      ['Der Mond ist ungefähr vierhunderttausend Kilometer von der Erde entfernt.', 'The moon is about four hundred thousand kilometers from Earth.'],
      ['Er braucht etwa einen Monat für eine Reise um die Erde.', 'It takes about a month to travel around Earth.'],
      ['Auf dem Mond gibt es kein Wasser und keine Luft.', 'On the moon there is no water and no air.'],
      ['Im Jahr 1969 sind die ersten Menschen dort gelandet.', 'In 1969 the first humans landed there.'],
      ['Man sieht den Mond jede Nacht ein bisschen anders.', 'You see the moon a little differently every night.'],
      ['Viele Kinder glauben, dass ein Mann im Mond wohnt.', 'Many children believe a man lives in the moon.'],
    ],
    questions: [
      { q: 'Wann sind die ersten Menschen auf dem Mond gelandet?', qUi: 'When did the first humans land on the moon?', a: 'Sie sind im Jahr 1969 gelandet.', aUi: 'They landed in 1969.' },
      { q: 'Was gibt es auf dem Mond nicht?', qUi: 'What is there not on the moon?', a: 'Es gibt kein Wasser und keine Luft.', aUi: 'There is no water and no air.' },
      { q: 'Was glauben viele Kinder?', qUi: 'What do many children believe?', a: 'Sie glauben, dass ein Mann im Mond wohnt.', aUi: 'They believe a man lives in the moon.' },
      { q: 'Wie lange braucht der Mond um die Erde?', qUi: 'How long does the moon take around Earth?', a: 'Er braucht etwa einen Monat.', aUi: 'It takes about a month.' },
      { q: 'Wie weit ist der Mond entfernt?', qUi: 'How far away is the moon?', a: 'Er ist ungefähr vierhunderttausend Kilometer entfernt.', aUi: 'It is about four hundred thousand kilometers away.' },
      { q: 'Wann sieht man den Mond anders?', qUi: 'When do you see the moon differently?', a: 'Man sieht ihn jede Nacht anders.', aUi: 'You see it differently every night.' },
    ],
  },
];

const GENDERS: Record<string, [string, string]> = {
  honig: ['der', '—'],
  garten: ['der', 'die Gärten'],
  blumen: ['die', 'die Blumen'],
  obst: ['das', '—'],
  gemüse: ['das', '—'],
  mond: ['der', 'die Monde'],
  wasser: ['das', '—'],
  luft: ['die', '—'],
  jahr: ['das', 'die Jahre'],
  kinder: ['das', 'die Kinder'],
  mann: ['der', 'die Männer'],
  erde: ['die', 'die Erden'],
  monat: ['der', 'die Monate'],
  brot: ['das', 'die Brote'],
};

let counter = load<number>('counter', 0);
let qid = load<number>('qid', 100);
type AnswerKey = { a: string; aUi: string; q: string; qUi: string };
const answerKeys = {
  get: (id: number) => load<Record<number, AnswerKey>>('keys', {})[id],
  set: (id: number, v: AnswerKey) => save('keys', { ...load<Record<number, AnswerKey>>('keys', {}), [id]: v }),
};

function buildStory(seed: Seed, targetLanguage: Story['targetLanguage'], ui: Story['uiLanguage'], cefr: Story['cefrLevel'], extra?: string): Story {
  const id = crypto.randomUUID();
  return {
    id,
    title: seed.title,
    theme: seed.theme,
    additionalInstructions: extra ?? null,
    targetLanguage,
    uiLanguage: ui,
    cefrLevel: cefr,
    createdAt: new Date().toISOString(),
    sentences: seed.sentences.map(([t, u], i) => ({ index: i, target: t, ui: u })),
    questions: seed.questions.map((q, i) => {
      const id2 = ++qid;
      answerKeys.set(id2, { a: q.a, aUi: q.aUi, q: q.q, qUi: q.qUi });
      save('qid', qid);
      return { id: id2, order: i, questionTarget: q.q, questionUi: q.qUi };
    }),
  };
}

const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 3);

function evaluate(qidv: number, answer: string): Evaluation {
  const key = answerKeys.get(qidv) ?? { a: '', aUi: '', q: '', qUi: '' };
  const model = normalize(key.a);
  const user = new Set(normalize(answer));
  const hit = model.filter((w) => user.has(w)).length;
  const ratio = model.length ? hit / model.length : 0;
  const status: Evaluation['sentenceCorrection']['status'] = !answer.trim() ? 'incorrect' : ratio >= 0.5 ? 'correct' : ratio >= 0.2 ? 'partial' : 'incorrect';
  const vocab: VocabWord[] = [...new Set(normalize(key.a))]
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)
    .map((w) => ({
      word: w[0].toUpperCase() + w.slice(1),
      gender: GENDERS[w]?.[0] ?? '',
      plural: GENDERS[w]?.[1] ?? '',
      pos: GENDERS[w] ? 'noun' : 'word',
      note: GENDERS[w] ? 'Key noun from the model answer.' : 'Useful word from the model answer.',
    }));
  return {
    questionId: qidv,
    sentenceCorrection: {
      status,
      correctedUserSentence: status === 'correct' ? answer.trim() : key.a,
      feedbackNote:
        status === 'correct'
          ? 'Great listening! Your answer matches the story.'
          : status === 'partial'
            ? 'Good idea — a few details are missing. Compare with the model answer.'
            : 'Listen to this part again and compare with the model answer.',
      modelAnswer: key.a,
    },
    translation: { question: key.qUi, modelAnswer: key.aUi },
    vocabBreakdown: vocab,
    grammarAnalysis: 'In German main clauses the conjugated verb stays in position 2: “Er braucht etwa einen Monat.” (demo content)',
  };
}

const defaultProfile: Profile = {
  id: 'mock-user',
  email: 'demo@hormal.app',
  name: 'Demo Learner',
  avatarUrl: null,
  uiLanguage: 'en',
  targetLanguage: 'de-DE',
  cefrLevel: 'A2',
  preferredVoiceEngine: 'google_cloud_tts',
  difficultyMode: 'normal',
};

export const mockApi = {
  async getMe(): Promise<Profile> {
    await delay(150);
    return load('profile', defaultProfile);
  },
  async patchPreferences(p: Partial<Profile>): Promise<Profile> {
    await delay(150);
    const next = { ...load('profile', defaultProfile), ...p };
    save('profile', next);
    return next;
  },
  async listStories(): Promise<StorySummary[]> {
    await delay(100);
    return load<StorySummary[]>('stories', []);
  },
  async getStory(id: string): Promise<StoryWithResult> {
    await delay(100);
    const s = load<Record<string, StoryWithResult>>('store', {})[id];
    if (!s) throw new Error('Story not found');
    return s;
  },
  async generateStory(input: GenerateStoryInput): Promise<Story> {
    const p = load('profile', defaultProfile);
    try {
      const res = await fetch('/api/agents/generate-story', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          theme: input.theme,
          additionalInstructions: input.additionalInstructions,
          targetLanguage: p.targetLanguage,
          uiLanguage: p.uiLanguage,
          cefrLevel: p.cefrLevel,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { story: Story };
        if (data?.story?.sentences?.length) {
          const story = data.story;
          for (const q of story.questions) {
            const mq = q as any;
            if (mq.modelAnswerTarget) {
              answerKeys.set(q.id, {
                q: q.questionTarget,
                qUi: q.questionUi,
                a: mq.modelAnswerTarget,
                aUi: mq.modelAnswerUi || mq.modelAnswerTarget,
              });
            }
          }
          const store = load<Record<string, StoryWithResult>>('store', {});
          store[story.id] = { story, result: null };
          save('store', store);
          const list = load<StorySummary[]>('stories', []);
          list.unshift({ id: story.id, title: story.title, theme: story.theme, targetLanguage: story.targetLanguage, cefrLevel: story.cefrLevel, createdAt: story.createdAt, score: null });
          save('stories', list);
          return story;
        }
      }
    } catch (e) {
      console.warn('Dev API generate-story fallback to local seed:', e);
    }

    await delay(1200);
    const seed = SEEDS[counter++ % SEEDS.length];
    save('counter', counter);
    const story = buildStory(seed, p.targetLanguage, p.uiLanguage, p.cefrLevel, input.additionalInstructions);
    const store = load<Record<string, StoryWithResult>>('store', {});
    store[story.id] = { story, result: null };
    save('store', store);
    const list = load<StorySummary[]>('stories', []);
    list.unshift({ id: story.id, title: story.title, theme: story.theme, targetLanguage: story.targetLanguage, cefrLevel: story.cefrLevel, createdAt: story.createdAt, score: null });
    save('stories', list);
    return story;
  },
  async evaluateAnswers(storyId: string, answers: { questionId: number; userAnswer: string }[]): Promise<EvalResult & { storyId: string }> {
    const p = load('profile', defaultProfile);
    const store = load<Record<string, StoryWithResult>>('store', {});
    const currentStory = store[storyId]?.story;
    try {
      const payloadAnswers = answers.map((a) => {
        const q = currentStory?.questions.find((x) => x.id === a.questionId);
        const k = answerKeys.get(a.questionId);
        return {
          questionId: a.questionId,
          questionTarget: q?.questionTarget || k?.q || '',
          questionUi: q?.questionUi || k?.qUi || '',
          userAnswer: a.userAnswer,
          modelAnswer: k?.a || '',
        };
      });
      const res = await fetch('/api/agents/evaluate-answers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          storyId,
          answers: payloadAnswers,
          targetLanguage: p.targetLanguage,
          uiLanguage: p.uiLanguage,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as EvalResult & { storyId: string };
        if (data?.evaluations?.length) {
          if (store[storyId]) {
            store[storyId].result = { score: data.score, evaluations: data.evaluations, answers };
            save('store', store);
          }
          const list = load<StorySummary[]>('stories', []).map((s) => (s.id === storyId ? { ...s, score: data.score } : s));
          save('stories', list);
          return { storyId, score: data.score, evaluations: data.evaluations, answers };
        }
      }
    } catch (e) {
      console.warn('Dev API evaluate-answers fallback to local grading:', e);
    }

    await delay(1400);
    const evaluations = answers.map((a) => evaluate(a.questionId, a.userAnswer));
    const pts = evaluations.reduce((n, e) => n + (e.sentenceCorrection.status === 'correct' ? 1 : e.sentenceCorrection.status === 'partial' ? 0.5 : 0), 0);
    const score = Math.round((pts / Math.max(1, evaluations.length)) * 100);
    if (store[storyId]) {
      store[storyId].result = { score, evaluations, answers };
      save('store', store);
    }
    const list = load<StorySummary[]>('stories', []).map((s) => (s.id === storyId ? { ...s, score } : s));
    save('stories', list);
    return { storyId, score, evaluations, answers };
  },
  async askDoubt(input: { userQuestion: string; selectedSentenceOrQuestionContext?: string; chatHistory: ChatMessage[] }): Promise<string> {
    const p = load('profile', defaultProfile);
    try {
      const res = await fetch('/api/agents/ask-doubt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userQuestion: input.userQuestion,
          selectedSentenceOrQuestionContext: input.selectedSentenceOrQuestionContext,
          uiLanguage: p.uiLanguage,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { reply: string };
        if (data?.reply) return data.reply;
      }
    } catch {}
    await delay(700);
    return `**Tutor:** about “${input.selectedSentenceOrQuestionContext ?? 'this story'}” — German verbs sit in position 2 in main clauses. Try: *Die Bienen machen Honig.*`;
  },
  async synthesize(input: { text: string; targetLanguage: string; engine: string; voiceId?: string }): Promise<SynthesizeResponse> {
    try {
      const res = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const data = (await res.json()) as SynthesizeResponse;
        if (data?.url) return data;
      }
    } catch {}
    return { engine: 'browser_natural', voiceId: 'browser', url: null, cached: true };
  },
  async listVocab(): Promise<SavedWord[]> {
    return load<SavedWord[]>('vocab', []);
  },
  async saveVocab(w: VocabWord & { targetLanguage: string }): Promise<SavedWord> {
    const list = load<SavedWord[]>('vocab', []);
    const existing = list.find((x) => x.word === w.word && x.targetLanguage === w.targetLanguage);
    if (existing) return existing;
    const row: SavedWord = { ...w, id: Date.now(), savedAt: new Date().toISOString() };
    list.unshift(row);
    save('vocab', list);
    return row;
  },
  async deleteVocab(id: number) {
    save('vocab', load<SavedWord[]>('vocab', []).filter((w) => w.id !== id));
    return { ok: true };
  },
  async getConversation(): Promise<Conversation> {
    const p = load('profile', defaultProfile);
    const convKey = `conv:${p.targetLanguage}`;
    const existing = load<Conversation | null>(convKey, null);
    if (existing) return existing;
    const initial: Conversation = {
      id: `mock-conv-${Date.now()}`,
      targetLanguage: p.targetLanguage,
      cefrLevel: p.cefrLevel,
      difficultyMode: p.difficultyMode || 'normal',
      title: 'Tägliches Gespräch',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: 1,
          conversationId: `mock-conv-${Date.now()}`,
          role: 'model',
          textTarget:
            p.targetLanguage === 'ja-JP'
              ? 'こんにちは！お会いできて嬉しいです。今日は何について話しましょうか？'
              : p.targetLanguage === 'zh-CN'
              ? '你好！很高兴见到你。今天你想聊些什么呢？'
              : 'Hallo! Wie geht es dir heute? Worüber möchtest du sprechen?',
          textUi: 'Hello! How are you doing today? What would you like to talk about?',
          audioUrl: null,
          suggestedVocab:
            p.targetLanguage === 'ja-JP'
              ? [
                  { word: '話す', pos: 'verb', note: 'to speak' },
                  { word: '今日', pos: 'noun', note: 'today' },
                ]
              : p.targetLanguage === 'zh-CN'
              ? [
                  { word: '聊天', pos: 'verb', note: 'to chat' },
                  { word: '今天', pos: 'noun', note: 'today' },
                ]
              : [
                  { word: 'das Gespräch', gender: 'n', plural: 'die Gespräche', pos: 'noun', note: 'conversation' },
                  { word: 'sprechen', pos: 'verb', note: 'to speak' },
                ],
          createdAt: new Date().toISOString(),
        },
      ],
    };
    save(convKey, initial);
    return initial;
  },
  async sendConversationMessage(input: { conversationId?: string; message: string; audioToText?: boolean }) {
    await delay(700);
    const p = load('profile', defaultProfile);
    const convKey = `conv:${p.targetLanguage}`;
    let conv = load<Conversation | null>(convKey, null);
    if (!conv) {
      conv = await this.getConversation();
    }
    const userMsg: ConversationMessage = {
      id: Date.now(),
      conversationId: conv.id,
      role: 'user',
      textTarget: input.message,
      textUi: null,
      audioUrl: null,
      suggestedVocab: [],
      createdAt: new Date().toISOString(),
    };
    conv.messages.push(userMsg);

    const modelMsg: ConversationMessage = {
      id: Date.now() + 1,
      conversationId: conv.id,
      role: 'model',
      textTarget: `Das ist sehr interessant! Erzähl mir mehr darüber: "${input.message}".`,
      textUi: `That is very interesting! Tell me more about that: "${input.message}".`,
      audioUrl: null,
      suggestedVocab: [
        { word: 'interessant', pos: 'adjective', note: 'interesting' },
        { word: 'erzählen', pos: 'verb', note: 'to tell / recount' },
      ],
      createdAt: new Date().toISOString(),
    };
    conv.messages.push(modelMsg);
    conv.updatedAt = new Date().toISOString();
    save(convKey, conv);
    return { userMessage: userMsg, modelMessage: modelMsg, conversationTitle: conv.title };
  },
  async resetConversation(title?: string): Promise<Conversation> {
    const p = load('profile', defaultProfile);
    const convKey = `conv:${p.targetLanguage}`;
    const newConv: Conversation = {
      id: `mock-conv-${Date.now()}`,
      targetLanguage: p.targetLanguage,
      cefrLevel: p.cefrLevel,
      difficultyMode: p.difficultyMode || 'normal',
      title: title || 'Neues Gespräch',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: 1,
          conversationId: `mock-conv-${Date.now()}`,
          role: 'model',
          textTarget: 'Hallo! Ein neues Thema beginnt. Worüber möchtest du heute sprechen?',
          textUi: 'Hello! A new topic begins. What would you like to talk about today?',
          audioUrl: null,
          suggestedVocab: [
            { word: 'das Thema', gender: 'n', plural: 'die Themen', pos: 'noun', note: 'topic' },
            { word: 'beginnen', pos: 'verb', note: 'to begin' },
          ],
          createdAt: new Date().toISOString(),
        },
      ],
    };
    save(convKey, newConv);
    return newConv;
  },
};
