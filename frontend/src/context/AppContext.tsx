import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { hasSession, logout } from '../lib/auth';
import { makeTranslator, type Translate } from '../i18n';
import type { Profile } from '../types';

interface AppApi {
  profile: Profile | null;
  t: Translate;
  voiceVariant: string;
  setVoiceVariant: (v: string) => void;
  updatePreferences: (p: Partial<Pick<Profile, 'uiLanguage' | 'targetLanguage' | 'cefrLevel' | 'preferredVoiceEngine'>>) => Promise<void>;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
}

const Ctx = createContext<AppApi | null>(null);
const VARIANT_KEY = 'hormal:voiceVariant';

export function AppProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [voiceVariant, setVoiceVariantState] = useState(() => localStorage.getItem(VARIANT_KEY) ?? '');

  const reloadProfile = useCallback(async () => {
    if (!(await hasSession())) return;
    setProfile(await api.getMe());
  }, []);

  useEffect(() => {
    if (enabled) void reloadProfile();
  }, [enabled, reloadProfile]);

  const t = useMemo(() => makeTranslator(profile?.uiLanguage ?? navigatorLanguage()), [profile?.uiLanguage]);

  useEffect(() => {
    document.documentElement.lang = profile?.uiLanguage ?? 'en';
  }, [profile?.uiLanguage]);

  const value = useMemo<AppApi>(
    () => ({
      profile,
      t,
      voiceVariant,
      setVoiceVariant: (v) => {
        localStorage.setItem(VARIANT_KEY, v);
        setVoiceVariantState(v);
      },
      // PATCH /api/me/preferences → PostgreSQL, then the active React context is updated.
      updatePreferences: async (p) => {
        setProfile((cur) => (cur ? { ...cur, ...p } : cur)); // optimistic
        try {
          setProfile(await api.patchPreferences(p));
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
    [profile, t, voiceVariant, reloadProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function navigatorLanguage() {
  const l = (navigator.language || '').toLowerCase();
  if (l.startsWith('de')) return 'de-DE';
  if (l.startsWith('fr')) return 'fr-FR';
  if (l.startsWith('it')) return 'it-IT';
  if (l.startsWith('pt')) return 'pt-BR';
  if (l.startsWith('es')) return 'es-ES';
  return 'en-US';
}

export function useApp(): AppApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
