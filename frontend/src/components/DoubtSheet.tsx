import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import { useStory } from '../context/StoryContext';
import { api } from '../lib/api';
import type { ChatMessage } from '../types';
import { BottomSheet } from './BottomSheet';
import { SendIcon } from './icons';

/** Tiny safe renderer for **bold** and *italic* in short tutor replies. */
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <span key={i}>{part}</span>;
  });
}

/** "💬 Agent 3 Doubt Tutor" chat as a slide-up sheet. */
export function DoubtSheet() {
  const { t } = useApp();
  const { story, doubt, closeDoubt, answers } = useStory();
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const storyId = story?.id;

  useEffect(() => {
    setChat([]);
  }, [storyId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || !story || busy) return;
    const history = chat;
    setChat([...history, { role: 'user', text }]);
    setInput('');
    setBusy(true);
    setFailed(false);
    try {
      const reply = await api.askDoubt({
        storyId: story.id,
        userQuestion: text,
        selectedSentenceOrQuestionContext: doubt.context,
        userAnswers: Object.entries(answers).map(([questionId, userAnswer]) => ({ questionId: Number(questionId), userAnswer })),
        chatHistory: history,
      });
      setChat((c) => [...c, { role: 'model', text: reply }]);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      id="sheet-doubt"
      open={doubt.open}
      onClose={closeDoubt}
      title={t('doubt.title')}
      footer={
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            id="doubt-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            enterKeyHint="send"
            autoComplete="off"
            placeholder={t('doubt.placeholder')}
            className="min-h-[48px] min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-500/15"
          />
          <button
            id="doubt-send"
            type="submit"
            disabled={busy || !input.trim()}
            aria-label={t('doubt.send')}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-500 text-white shadow-lg shadow-brand-600/30 transition active:scale-90 disabled:opacity-40"
          >
            <SendIcon width={20} height={20} />
          </button>
        </form>
      }
    >
      {doubt.context && (
        <div className="mb-3 rounded-xl border-l-4 border-brand-500 bg-brand-50 px-3 py-2 text-[13px] text-brand-700">
          <span className="font-bold">{t('doubt.context')}: </span>
          <span className="italic">“{doubt.context}”</span>
        </div>
      )}
      <div ref={listRef} className="scroll-area flex max-h-[48dvh] min-h-[120px] flex-col gap-2.5 overflow-y-auto">
        {chat.length === 0 && <p className="py-6 text-center text-[14px] text-slate-400">{t('doubt.empty')}</p>}
        {chat.map((m, i) => (
          <div
            key={i}
            className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug animate-rise ${
              m.role === 'user'
                ? 'self-end rounded-br-md bg-gradient-to-br from-brand-600 to-brand-500 text-white'
                : 'self-start rounded-bl-md bg-slate-100 text-slate-800'
            }`}
          >
            {renderInline(m.text)}
          </div>
        ))}
        {busy && (
          <div className="self-start rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-2.5 text-[14px] text-slate-500">
            <span className="animate-pulse">{t('doubt.thinking')}</span>
          </div>
        )}
        {failed && <p className="self-center text-[13px] text-rose-600">{t('error.generic')}</p>}
      </div>
    </BottomSheet>
  );
}
