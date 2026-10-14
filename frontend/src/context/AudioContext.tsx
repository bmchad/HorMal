import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { getBestFeminineVoice, VOICE_VARIANTS } from '../lib/voices';
import { useApp } from './AppContext';

type Status = 'idle' | 'loading' | 'playing' | 'paused';
type Outcome = 'ended' | 'cancelled' | 'error';
export type Speed = 0.75 | 1;

interface AudioApi {
  status: Status;
  index: number;
  total: number;
  speed: Speed;
  notice: string | null;
  /** True while sentence `i` is the one being played/loaded (used for highlighting — never scrolls). */
  isActive: (i: number) => boolean;
  setQueue: (texts: string[]) => void;
  togglePlay: () => void;
  playSentence: (i: number) => void;
  next: () => void;
  prev: () => void;
  replay: () => void;
  stop: () => void;
  toggleSpeed: () => void;
  speakOnce: (text: string) => void;
  prewarm: (text: string) => void;
}

const Ctx = createContext<AudioApi | null>(null);

// 1-sample silent WAV used to unlock the persistent <audio> element on the user's first tap.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

export function AudioProvider({ children }: { children: ReactNode }) {
  const { profile, voiceVariant, t } = useApp();

  const [status, setStatus] = useState<Status>('idle');
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [speed, setSpeedState] = useState<Speed>(1);
  const [notice, setNotice] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const statusRef = useRef<Status>('idle');
  const tokenRef = useRef(0);
  const cancelRef = useRef<(() => void) | null>(null);
  const speedRef = useRef<Speed>(1);
  const unlockedRef = useRef(false);
  const urlCache = useRef(new Map<string, Promise<string | null>>());
  const usingBrowserRef = useRef(false);

  const engine = profile?.preferredVoiceEngine ?? 'browser_natural';
  const lang = profile?.targetLanguage ?? 'de-DE';
  const live = useRef({ engine, lang, voiceVariant, t });
  live.current = { engine, lang, voiceVariant, t };

  const setStatusBoth = (s: Status) => {
    statusRef.current = s;
    setStatus(s);
  };
  const setIndexBoth = (i: number) => {
    indexRef.current = i;
    setIndex(i);
  };

  // One persistent, inline-playable <audio> element for the whole session (mobile autoplay compliance).
  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'auto';
      a.setAttribute('playsinline', 'true');
      a.setAttribute('webkit-playsinline', 'true');
      a.preservesPitch = true;
      audioRef.current = a;
    }
    return audioRef.current;
  }, []);

  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    const a = getAudio();
    a.src = SILENT_WAV;
    a.play().catch(() => undefined);
  }, [getAudio]);

  useEffect(() => {
    // Voices load asynchronously in most browsers.
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.getVoices();
    return () => {
      speechSynthesis?.cancel();
      audioRef.current?.pause();
    };
  }, []);

  const getUrl = useCallback((text: string): Promise<string | null> => {
    const { engine: e, lang: l, voiceVariant: v } = live.current;
    if (e === 'browser_natural') return Promise.resolve(null);
    // Only forward a voice id that belongs to the selected engine (Polly picks its own feminine voice per language).
    const variants = e === 'openai_tts' || e === 'google_cloud_tts' ? VOICE_VARIANTS[e] : [];
    const voiceId = variants.find((x) => x.id === v)?.id;
    const key = `${e}|${voiceId ?? ''}|${l}|${text}`;
    let p = urlCache.current.get(key);
    if (!p) {
      p = api
        .synthesize({ text, targetLanguage: l, engine: e, voiceId })
        .then((r) => r.url)
        .catch(() => {
          urlCache.current.delete(key);
          return null;
        });
      urlCache.current.set(key, p);
    }
    return p;
  }, []);

  const playRemote = useCallback(
    (url: string): Promise<Outcome> =>
      new Promise((resolve) => {
        const a = getAudio();
        const cleanup = () => {
          a.removeEventListener('ended', onEnd);
          a.removeEventListener('error', onErr);
          cancelRef.current = null;
        };
        const onEnd = () => {
          cleanup();
          resolve('ended');
        };
        const onErr = () => {
          cleanup();
          resolve('error');
        };
        a.addEventListener('ended', onEnd);
        a.addEventListener('error', onErr);
        cancelRef.current = () => {
          cleanup();
          a.pause();
          resolve('cancelled');
        };
        usingBrowserRef.current = false;
        a.src = url;
        a.playbackRate = speedRef.current;
        a.preservesPitch = true;
        a.play().catch(() => {
          cleanup();
          resolve('error');
        });
      }),
    [getAudio],
  );

  const playBrowser = useCallback(
    (text: string): Promise<Outcome> =>
      new Promise((resolve) => {
        if (typeof speechSynthesis === 'undefined') return resolve('error');
        const u = new SpeechSynthesisUtterance(text);
        const voice = getBestFeminineVoice(live.current.lang);
        u.lang = live.current.lang;
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang;
        }
        u.rate = speedRef.current === 0.75 ? 0.8 : 1;
        u.pitch = 1.05;
        let done = false;
        const finish = (o: Outcome) => {
          if (done) return;
          done = true;
          cancelRef.current = null;
          resolve(o);
        };
        u.onend = () => finish('ended');
        u.onerror = (e) => finish(e.error === 'canceled' || e.error === 'interrupted' ? 'cancelled' : 'error');
        cancelRef.current = () => {
          speechSynthesis.cancel();
          finish('cancelled');
        };
        usingBrowserRef.current = true;
        speechSynthesis.cancel();
        setTimeout(() => speechSynthesis.speak(u), 30);
      }),
    [],
  );

  const playText = useCallback(
    async (text: string, token: number): Promise<Outcome> => {
      if (live.current.engine !== 'browser_natural') {
        setStatusBoth('loading');
        const url = await getUrl(text);
        if (token !== tokenRef.current) return 'cancelled';
        if (url) {
          setStatusBoth('playing');
          const out = await playRemote(url);
          if (out !== 'error' || token !== tokenRef.current) return out;
        }
        setNotice(live.current.t('error.audio'));
        setTimeout(() => setNotice(null), 4000);
      }
      if (token !== tokenRef.current) return 'cancelled';
      setStatusBoth('playing');
      return playBrowser(text);
    },
    [getUrl, playBrowser, playRemote],
  );

  const hardStop = useCallback(() => {
    tokenRef.current++;
    cancelRef.current?.();
    cancelRef.current = null;
    audioRef.current?.pause();
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }, []);

  const runFrom = useCallback(
    async (start: number, mode: 'story' | 'single') => {
      unlock();
      hardStop();
      const token = tokenRef.current;
      const q = queueRef.current;
      for (let k = start; k < q.length; k++) {
        if (token !== tokenRef.current) return;
        setIndexBoth(k);
        if (q[k + 1]) void getUrl(q[k + 1]); // pre-fetch next sentence while this one plays
        const out = await playText(q[k], token);
        if (token !== tokenRef.current || out === 'cancelled') return;
        if (mode === 'single') break;
      }
      if (token === tokenRef.current) setStatusBoth('idle');
    },
    [getUrl, hardStop, playText, unlock],
  );

  const api2: AudioApi = useMemo(
    () => ({
      status,
      index,
      total,
      speed,
      notice,
      isActive: (i) => i === index && (status === 'playing' || status === 'loading' || status === 'paused'),
      setQueue: (texts) => {
        hardStop();
        queueRef.current = texts;
        setTotal(texts.length);
        setIndexBoth(0);
        setStatusBoth('idle');
      },
      togglePlay: () => {
        unlock();
        const s = statusRef.current;
        if (s === 'playing') {
          if (usingBrowserRef.current) speechSynthesis.pause();
          else audioRef.current?.pause();
          setStatusBoth('paused');
        } else if (s === 'paused') {
          if (usingBrowserRef.current) speechSynthesis.resume();
          else void audioRef.current?.play();
          setStatusBoth('playing');
        } else if (s === 'loading') {
          hardStop();
          setStatusBoth('idle');
        } else {
          const last = queueRef.current.length - 1;
          // Finished the story before? Restart from the top.
          void runFrom(last > 0 && indexRef.current >= last ? 0 : indexRef.current, 'story');
        }
      },
      playSentence: (i) => void runFrom(i, 'single'),
      next: () => {
        const n = Math.min(queueRef.current.length - 1, indexRef.current + 1);
        if (statusRef.current === 'idle') setIndexBoth(n);
        else void runFrom(n, 'story');
      },
      prev: () => {
        const n = Math.max(0, indexRef.current - 1);
        if (statusRef.current === 'idle') setIndexBoth(n);
        else void runFrom(n, 'story');
      },
      replay: () => void runFrom(indexRef.current, 'single'),
      stop: () => {
        hardStop();
        setStatusBoth('idle');
        setIndexBoth(0);
      },
      toggleSpeed: () => {
        const next: Speed = speedRef.current === 1 ? 0.75 : 1;
        speedRef.current = next;
        setSpeedState(next);
        if (audioRef.current) {
          audioRef.current.playbackRate = next;
          audioRef.current.preservesPitch = true;
        }
      },
      speakOnce: (text) => {
        unlock();
        hardStop();
        const token = tokenRef.current;
        void playText(text, token).then(() => {
          if (token === tokenRef.current) setStatusBoth('idle');
        });
      },
      prewarm: (text) => {
        void getUrl(text);
      },
    }),
    [status, index, total, speed, notice, hardStop, runFrom, unlock, playText, getUrl],
  );

  return <Ctx.Provider value={api2}>{children}</Ctx.Provider>;
}

export function useAudio(): AudioApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAudio must be used inside AudioProvider');
  return v;
}
