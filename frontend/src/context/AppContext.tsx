import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { hasSession, logout } from '../lib/auth';
import { makeTranslator, type Translate } from '../i18n';
import type { Profile, UiLanguage } from '../types';

interface AppApi {
  profile: Profile | null;
  t: Translate;
  uiLanguage: string;
  setUiLanguage: (v: string) => void;
  voiceVariant: string;
  setVoiceVariant: (v: string) => void;
  updatePreferences: (p: Partial<Pick<Profile, 'uiLanguage' | 'targetLanguage' | 'cefrLevel' | 'preferredVoiceEngine'>>) => Promise<void>;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
}

const Ctx = createContext<AppApi | null>(null);
const VARIANT_KEY = 'hormal:voiceVariant';
const UI_LANG_KEY = 'hormal:uiLanguage';

export function AppProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [voiceVariant, setVoiceVariantState] = useState(() => localStorage.getItem(VARIANT_KEY) ?? '');
  // Standard default language is English (en-US) unless user explicitly selects another language.
  const [uiLanguageState, setUiLanguageState] = useState<string>(
    () => localStorage.getItem(UI_LANG_KEY) || 'en-US',
  );

  const reloadProfile = useCallback(async () => {
    if (!(await hasSession())) return;
    const me = await api.getMe();
    const storedUi = localStorage.getItem(UI_LANG_KEY);
    if (storedUi && storedUi !== me.uiLanguage && me.uiLanguage === 'en') {
      try {
        const updated = await api.patchPreferences({ uiLanguage: storedUi as UiLanguage });
        setProfile(updated);
        return;
      } catch {
        // proceed with fetched profile
      }
    }
    setProfile(me);
    if (me.uiLanguage) {
      setUiLanguageState(me.uiLanguage);
      localStorage.setItem(UI_LANG_KEY, me.uiLanguage);
    }
  }, []);

  useEffect(() => {
    if (enabled) void reloadProfile();
  }, [enabled, reloadProfile]);

  const activeUiLanguage = profile?.uiLanguage || uiLanguageState || 'en-US';

  const t = useMemo(() => makeTranslator(activeUiLanguage), [activeUiLanguage]);

  useEffect(() => {
    document.documentElement.lang = activeUiLanguage.split('-')[0] || 'en';
  }, [activeUiLanguage]);

  const setUiLanguage = useCallback(
    (lang: string) => {
      setUiLanguageState(lang);
      localStorage.setItem(UI_LANG_KEY, lang);
      if (profile) {
        setProfile((cur) => (cur ? { ...cur, uiLanguage: lang as UiLanguage } : cur));
        void api.patchPreferences({ uiLanguage: lang as UiLanguage }).catch(() => {});
      }
    },
    [profile],
  );

  const value = useMemo<AppApi>(
    () => ({
      profile,
      t,
      uiLanguage: activeUiLanguage,
      setUiLanguage,
      voiceVariant,
      setVoiceVariant: (v) => {
        localStorage.setItem(VARIANT_KEY, v);
        setVoiceVariantState(v);
      },
      // PATCH /api/me/preferences → PostgreSQL, then the active React context is updated.
      updatePreferences: async (p) => {
        if (p.uiLanguage) {
          setUiLanguageState(p.uiLanguage);
          localStorage.setItem(UI_LANG_KEY, p.uiLanguage);
        }
        setProfile((cur) => (cur ? { ...cur, ...p } : cur)); // optimistic
        try {
          const updated = await api.patchPreferences(p);
          setProfile(updated);
          if (updated.uiLanguage) {
            setUiLanguageState(updated.uiLanguage);
            localStorage.setItem(UI_LANG_KEY, updated.uiLanguage);
          }
        } catch (e) {
          await reloadProfile();
          throw e;
        }
      },
      signOut: async () => {
        await logout();
        window.location.reload();
      },
      reloadProfile,
    }),
    [profile, t, activeUiLanguage, setUiLanguage, voiceVariant, reloadProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
