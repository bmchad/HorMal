import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAudio } from '../context/AudioContext';
import { api } from '../lib/api';
import { flagFor } from '../lib/voices';
import type { Conversation, ConversationMessage, VocabWord } from '../types';

interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export function ConversationTab() {
  const { t, profile } = useApp();
  const audioContext = useAudio();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set());
  const [savedVocabWords, setSavedVocabWords] = useState<Set<string>>(new Set());
  const [playingMessageId, setPlayingMessageId] = useState<number | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [audioProgress, setAudioProgress] = useState<Record<number, { current: number; duration: number }>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Silent 1-sample WAV used to unlock mobile and desktop browser autoplay policy on user tap
  const unlockAudio = useCallback(() => {
    try {
      if (!audioElementRef.current) {
        audioElementRef.current = new Audio();
      }
      audioElementRef.current.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
      void audioElementRef.current.play().catch(() => {});
    } catch {}
  }, []);

  // Load existing conversation on mount or language change
  const loadConversation = useCallback(async () => {
    try {
      setLoading(true);
      const conv = await api.getConversation();
      setConversation(conv);
    } catch (err) {
      console.error('Failed to load conversation:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages, sending]);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  // Audio playback handler (re-uses pre-unlocked audio element for 100% reliable autoplay)
  const playAudio = useCallback(
    (msg: ConversationMessage) => {
      // If already playing this message, toggle pause
      if (playingMessageId === msg.id && audioElementRef.current) {
        if (!audioElementRef.current.paused) {
          audioElementRef.current.pause();
          setPlayingMessageId(null);
          return;
        } else {
          void audioElementRef.current.play();
          setPlayingMessageId(msg.id);
          return;
        }
      }

      if (msg.audioUrl) {
        let audio = audioElementRef.current;
        if (!audio) {
          audio = new Audio();
          audioElementRef.current = audio;
        }
        audio.pause();
        audio.src = msg.audioUrl;
        audio.playbackRate = playbackRate;
        setPlayingMessageId(msg.id);

        audio.ontimeupdate = () => {
          setAudioProgress((prev) => ({
            ...prev,
            [msg.id]: {
              current: audio.currentTime,
              duration: audio.duration || 0,
            },
          }));
        };

        audio.onended = () => {
          setPlayingMessageId(null);
        };

        audio.onerror = () => {
          console.warn('Audio playback error, falling back to speech synthesis');
          audioContext.speakOnce(msg.textTarget);
          setPlayingMessageId(null);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Autoplay blocked or error:', err);
            audioContext.speakOnce(msg.textTarget);
            setPlayingMessageId(null);
          });
        }
      } else {
        // Fallback to audioContext synthesis
        audioContext.speakOnce(msg.textTarget);
      }
    },
    [playingMessageId, playbackRate, audioContext],
  );

  // Toggle reveal text & translation
  const toggleReveal = (id: number) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle playback rate
  const toggleSpeed = () => {
    const nextRate = playbackRate === 1 ? 0.8 : 1;
    setPlaybackRate(nextRate);
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = nextRate;
    }
  };

  // Send message
  const handleSendMessage = async (textToSend?: string, wasAudio = false) => {
    const content = (textToSend ?? inputText).trim();
    if (!content || sending) return;

    // Unlock audio playback immediately on user gesture so autoplay works after async fetch
    unlockAudio();

    setInputText('');
    setSending(true);
    setSttError(null);

    try {
      const res = await api.sendConversationMessage({
        conversationId: conversation?.id,
        message: content,
        audioToText: wasAudio,
      });

      setConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          title: res.conversationTitle || prev.title,
          updatedAt: new Date().toISOString(),
          messages: [...prev.messages, res.userMessage, res.modelMessage],
        };
      });

      // Autoplay tutor audio response immediately
      if (res.modelMessage) {
        playAudio(res.modelMessage);
      }
    } catch (err) {
      console.error('Failed to send conversation message:', err);
    } finally {
      setSending(false);
    }
  };

  // Reset conversation
  const handleResetConversation = async () => {
    if (sending) return;
    unlockAudio();
    try {
      setLoading(true);
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      setPlayingMessageId(null);
      const newConv = await api.resetConversation();
      setConversation(newConv);
      setRevealedIds(new Set());
      // Autoplay initial welcome audio
      if (newConv.messages.length > 0 && newConv.messages[0].audioUrl) {
        playAudio(newConv.messages[0]);
      }
    } catch (err) {
      console.error('Failed to reset conversation:', err);
    } finally {
      setLoading(false);
    }
  };

  // Save vocab item to user's Vocab list
  const handleSaveVocab = async (w: VocabWord) => {
    if (!profile) return;
    try {
      await api.saveVocab({
        ...w,
        targetLanguage: profile.targetLanguage,
      });
      setSavedVocabWords((prev) => new Set(prev).add(w.word));
    } catch (err) {
      console.error('Failed to save vocabulary:', err);
    }
  };

  // Web Speech API STT handler
  const toggleSpeechRecognition = () => {
    const win = window as IWindow;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSttError(t('conversation.sttUnsupported'));
      setTimeout(() => setSttError(null), 5000);
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      const lang = profile?.targetLanguage ?? 'de-DE';
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecording(true);
        setSttError(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsRecording(false);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setSttError(`Microphone error: ${event.error}`);
          setTimeout(() => setSttError(null), 4000);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('STT start failed:', err);
      setIsRecording(false);
      setSttError('Could not start microphone');
      setTimeout(() => setSttError(null), 4000);
    }
  };

  const quickTopics = (() => {
    const lang = profile?.targetLanguage;
    if (lang === 'ja-JP') {
      return [
        { title: '自己紹介 (Apresentação)', prompt: 'こんにちは！自己紹介をして、日本語を練習したいです。' },
        { title: '食事の注文 (Pedir comida)', prompt: 'すみません、おすすめの日本料理は何ですか？' },
        { title: '日本旅行 (Viagem no Japão)', prompt: '日本のおすすめの旅行先を教えてください。' },
      ];
    }
    if (lang === 'zh-CN') {
      return [
        { title: '自我介绍 (Apresentação)', prompt: '你好！我想介绍一下自己，并练习普通话。' },
        { title: '餐厅点餐 (Pedir comida)', prompt: '你好！我想点餐，你有什么推荐的中国菜吗？' },
        { title: '旅行话题 (Falar de viagens)', prompt: '能给我讲讲你最喜欢的旅游目的地吗？' },
      ];
    }
    if (lang === 'fr-FR') {
      return [
        { title: 'Présentation', prompt: 'Bonjour ! Je m’appelle et je souhaite pratiquer mon français.' },
        { title: 'Au restaurant', prompt: 'Bonjour ! Qu’est-ce que vous me recommandez pour le déjeuner ?' },
        { title: 'Voyages', prompt: 'Parlez-moi de votre destination de voyage préférée !' },
      ];
    }
    if (lang === 'es-ES') {
      return [
        { title: 'Presentación', prompt: '¡Hola! Me gustaría presentarme y practicar mi español.' },
        { title: 'En el restaurante', prompt: '¡Hola! ¿Qué plato típico me recomienda para hoy?' },
        { title: 'Viajes', prompt: '¡Cuéntame sobre tu lugar favorito para viajar!' },
      ];
    }
    if (lang === 'it-IT') {
      return [
        { title: 'Presentazione', prompt: 'Ciao! Vorrei presentarmi e fare un po’ di pratica in italiano.' },
        { title: 'Al ristorante', prompt: 'Ciao! Che cosa mi consigli di mangiare oggi?' },
        { title: 'Viaggi', prompt: 'Parlami del tuo posto preferito in Italia!' },
      ];
    }
    return [
      { title: t('conversation.topic1'), prompt: 'Hallo! Ich möchte mich gerne vorstellen und mein Deutsch üben.' },
      { title: t('conversation.topic2'), prompt: 'Guten Tag! Ich möchte etwas zu essen bestellen, was empfehlen Sie?' },
      { title: t('conversation.topic3'), prompt: 'Erzähl mir von deinen Lieblingsreisezielen und warum sie so besonders sind.' },
    ];
  })();

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-ink-950 text-white">
      {/* Top Bar / Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/80 px-4 py-3 backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" />
            <h2 className="truncate font-display text-base font-bold text-slate-100">
              {conversation?.title || t('conversation.title')}
            </h2>
            {profile && <span className="text-base">{flagFor(profile.targetLanguage)}</span>}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1 rounded bg-brand-500/20 px-1.5 py-0.5 font-semibold text-brand-300">
              {profile?.cefrLevel ?? 'A2'} · {profile?.difficultyMode === 'hard' ? 'Hard' : 'Normal'}
            </span>
            <span className="text-slate-500">•</span>
            <span className="truncate text-slate-400">{t('conversation.badge')}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Speed Toggle */}
          <button
            onClick={toggleSpeed}
            title="Toggle playback speed"
            className="flex h-8 w-12 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-[12px] font-bold text-slate-300 transition hover:bg-white/10 active:scale-95"
          >
            {playbackRate}x
          </button>

          {/* New Topic / Reset Button */}
          <button
            onClick={handleResetConversation}
            disabled={loading || sending}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-medium text-slate-200 transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
          >
            <span>🔄</span>
            <span className="hidden sm:inline">{t('conversation.newTopic')}</span>
          </button>
        </div>
      </div>

      {/* Audio-First Notice Pill */}
      <div className="border-b border-brand-500/20 bg-gradient-to-r from-brand-900/40 via-purple-900/30 to-brand-900/40 px-3 py-2 text-center text-[12px] text-brand-200">
        <span className="font-semibold">{t('conversation.badgeDesc')}</span>
      </div>

      {/* Chat Messages Timeline */}
      <div className="scroll-area flex-1 space-y-4 overflow-y-auto p-4">
        {loading && (
          <div className="space-y-4 pt-4">
            <div className="skeleton h-24 rounded-2xl bg-white/10" />
            <div className="skeleton ml-auto h-16 w-3/4 rounded-2xl bg-brand-500/20" />
            <div className="skeleton h-24 rounded-2xl bg-white/10" />
          </div>
        )}

        {/* Quick topics starter when only 1 greeting message exists */}
        {!loading && conversation && conversation.messages.length <= 1 && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm animate-fade-in">
            <p className="mb-2 text-[12px] font-semibold text-brand-300">
              💡 {t('conversation.quickTopicPrompt')}
            </p>
            <div className="flex flex-wrap gap-2">
              {quickTopics.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(item.prompt)}
                  className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-left text-[12px] text-slate-200 transition hover:border-brand-400 hover:bg-brand-500/20 active:scale-95"
                >
                  {item.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {conversation?.messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isPlaying = playingMessageId === msg.id;
          const isRevealed = revealedIds.has(msg.id);
          const progress = audioProgress[msg.id];

          if (isUser) {
            return (
              <div key={msg.id} className="flex justify-end animate-rise">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-brand-600 to-brand-700 px-4 py-3 shadow-lg shadow-brand-900/40">
                  <div className="flex items-center gap-1.5 pb-1 text-[11px] font-semibold text-brand-200">
                    <span>{msg.audioUrl ? '🎙️ Audio-to-Text' : '✍️ Text'}</span>
                  </div>
                  <p className="text-[14px] leading-relaxed text-white">{msg.textTarget}</p>
                </div>
              </div>
            );
          }

          // Tutor Voice Note Message Card
          return (
            <div key={msg.id} className="flex justify-start animate-rise">
              <div className="w-full max-w-[92%] rounded-2xl rounded-tl-sm border border-white/15 bg-gradient-to-br from-slate-800/90 via-slate-850/90 to-slate-900/90 p-4 shadow-xl backdrop-blur-md">
                {/* Voice Note Header */}
                <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-brand-500 to-accent-500 text-[13px] shadow">
                      🎙️
                    </div>
                    <div>
                      <span className="text-[12px] font-bold text-slate-200">HörMal Tutor</span>
                      <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        Voice Note
                      </span>
                    </div>
                  </div>

                  {/* Playback time indicator */}
                  {progress && progress.duration > 0 && (
                    <span className="text-[11px] tabular-nums text-slate-400">
                      {Math.floor(progress.current)}s / {Math.floor(progress.duration)}s
                    </span>
                  )}
                </div>

                {/* Voice Note Player & Waveform Visualizer */}
                <div className="flex items-center gap-3 rounded-xl bg-black/30 p-3 ring-1 ring-white/10">
                  {/* Play / Pause Button */}
                  <button
                    onClick={() => playAudio(msg)}
                    className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95 ${
                      isPlaying
                        ? 'bg-gradient-to-br from-accent-500 to-rose-600 ring-4 ring-accent-400/30'
                        : 'bg-gradient-to-br from-brand-500 to-brand-700 hover:scale-105'
                    }`}
                    aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
                  >
                    <span className="text-xl">{isPlaying ? '⏸' : '▶'}</span>
                  </button>

                  {/* Waveform Bars */}
                  <div className="flex flex-1 items-center justify-between gap-1 overflow-hidden px-1">
                    {[35, 60, 20, 85, 45, 95, 30, 75, 50, 100, 65, 40, 80, 25, 70, 90, 55, 30, 85, 40, 60].map(
                      (height, idx) => (
                        <div
                          key={idx}
                          style={{ height: `${height}%` }}
                          className={`w-1 rounded-full transition-all duration-200 ${
                            isPlaying
                              ? 'bg-gradient-to-t from-brand-400 to-accent-400 animate-pulse'
                              : 'bg-slate-600'
                          }`}
                        />
                      ),
                    )}
                  </div>
                </div>

                {/* Reveal Text / Translation Toggle */}
                <div className="mt-3 flex items-center justify-between pt-1">
                  <button
                    onClick={() => toggleReveal(msg.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/10"
                  >
                    <span>{isRevealed ? '🙈' : '👁️'}</span>
                    <span>{isRevealed ? t('conversation.hide') : t('conversation.reveal')}</span>
                  </button>
                </div>

                {/* Hidden / Revealed Text & Translation */}
                <div className="mt-2.5 transition-all">
                  {isRevealed ? (
                    <div className="space-y-2 rounded-xl border border-white/10 bg-black/25 p-3 animate-fade-in">
                      <p className="text-[14px] font-medium leading-relaxed text-slate-100">
                        {msg.textTarget}
                      </p>
                      {msg.textUi && (
                        <p className="border-t border-white/10 pt-2 text-[13px] leading-relaxed text-brand-300">
                          {msg.textUi}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => toggleReveal(msg.id)}
                      className="group cursor-pointer select-none rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-3 text-center transition hover:border-brand-400/50 hover:bg-white/[0.06]"
                    >
                      <p className="text-[13px] font-medium text-slate-400 filter blur-[5px] transition group-hover:blur-[3px]">
                        {msg.textTarget.slice(0, 80)}...
                      </p>
                      <span className="mt-1 block text-[11px] font-semibold text-brand-400">
                        👆 {t('conversation.reveal')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Vocabulary Generation Chips (Persisted to Vocab Tab!) */}
                {msg.suggestedVocab && msg.suggestedVocab.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-2.5">
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      📖 {t('feedback.vocab')}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.suggestedVocab.map((w, idx) => {
                        const isSaved = savedVocabWords.has(w.word);
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-[12px] text-slate-200"
                          >
                            <span className="font-semibold text-accent-300">
                              {[w.gender, w.word].filter(Boolean).join(' ')}
                            </span>
                            {w.note && <span className="text-[11px] text-slate-400">({w.note})</span>}
                            <button
                              onClick={() => handleSaveVocab(w)}
                              disabled={isSaved}
                              title={isSaved ? t('conversation.saved') : t('conversation.saveVocab')}
                              className={`ml-1 flex h-5 items-center rounded px-1.5 text-[10px] font-bold transition active:scale-95 ${
                                isSaved
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-brand-500 hover:bg-brand-400 text-white'
                              }`}
                            >
                              {isSaved ? '✓' : `+ ${t('conversation.saveVocab')}`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Tutor Thinking & Generating Audio State */}
        {sending && (
          <div className="flex justify-start animate-fade-in">
            <div className="flex items-center gap-3 rounded-2xl border border-brand-500/30 bg-slate-800/90 px-4 py-3 shadow-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">
                <span className="animate-spin text-base">⏳</span>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-slate-200">{t('conversation.thinking')}</p>
                <div className="mt-1 flex items-center gap-1">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400" />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent-400 [animation-delay:0.2s]" />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-300 [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* STT Error Banner */}
      {sttError && (
        <div className="border-t border-rose-500/30 bg-rose-950/80 px-4 py-2 text-center text-[12px] text-rose-200">
          ⚠️ {sttError}
        </div>
      )}

      {/* Input Dock (Text & Mic Audio-to-Text) */}
      <div className="border-t border-white/10 bg-slate-900/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md">
        {/* Active recording state banner */}
        {isRecording && (
          <div className="mb-2 flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-1.5 animate-pulse">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-rose-500 animate-ping" />
              <span className="text-[12px] font-bold text-rose-300">{t('conversation.micStop')}</span>
            </div>
            <button
              onClick={toggleSpeechRecognition}
              className="rounded bg-rose-500/30 px-2 py-0.5 text-[11px] font-bold text-rose-200"
            >
              Stop
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Audio-to-Text Mic Button */}
          <button
            onClick={toggleSpeechRecognition}
            disabled={sending}
            title={isRecording ? t('conversation.micStop') : t('conversation.micStart')}
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-transform active:scale-95 disabled:opacity-50 ${
              isRecording
                ? 'bg-rose-600 ring-4 ring-rose-500/40 animate-pulse'
                : 'bg-gradient-to-tr from-accent-500 to-brand-600 hover:scale-105'
            }`}
          >
            <span className="text-xl">{isRecording ? '⏹' : '🎙️'}</span>
          </button>

          {/* Text input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSendMessage();
              }
            }}
            placeholder={isRecording ? t('conversation.listening') : t('conversation.placeholder')}
            disabled={sending}
            className="flex-1 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-[15px] text-white placeholder-slate-400 outline-none transition focus:border-brand-400 focus:bg-white/15 focus:ring-2 focus:ring-brand-400/20 disabled:opacity-50"
          />

          {/* Send Button */}
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || sending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg transition-transform active:scale-90 hover:bg-brand-500 disabled:opacity-40"
            aria-label={t('conversation.send')}
          >
            <span className="text-lg">➔</span>
          </button>
        </div>
      </div>
    </div>
  );
}
