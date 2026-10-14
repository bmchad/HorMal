import { useEffect, useState } from 'react';
import { Hub } from 'aws-amplify/utils';
import { AppShell9x16 } from './components/AppShell9x16';
import { AudioDock } from './components/AudioDock';
import { BottomNav, type TabId } from './components/BottomNav';
import { DoubtSheet } from './components/DoubtSheet';
import { GeneratorSheet } from './components/GeneratorSheet';
import { SubmitThemeSheet } from './components/SubmitThemeSheet';
import { Header } from './components/Header';
import { AppProvider, useApp } from './context/AppContext';
import { AudioProvider } from './context/AudioContext';
import { StoryProvider } from './context/StoryContext';
import { hasSession } from './lib/auth';
import { LoginScreen } from './LoginScreen';
import { PracticeTab } from './tabs/PracticeTab';
import { ProfileTab } from './tabs/ProfileTab';
import { VocabTab } from './tabs/VocabTab';

type AuthState = 'checking' | 'out' | 'in';

function Splash() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-ink-900 via-ink-800 to-brand-700">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-accent-400" aria-label="Loading" />
    </div>
  );
}

function Main() {
  const { profile } = useApp();
  const [tab, setTab] = useState<TabId>('practice');

  if (!profile) return <Splash />;

  return (
    <AudioProvider>
      <StoryProvider>
        <Header />
        <main className="relative flex min-h-0 flex-1 flex-col">
          {tab === 'practice' && <PracticeTab />}
          {tab === 'vocab' && <VocabTab />}
          {tab === 'profile' && <ProfileTab />}
        </main>
        {tab === 'practice' && <AudioDock />}
        <BottomNav tab={tab} onChange={setTab} />
        <GeneratorSheet />
        <SubmitThemeSheet />
        <DoubtSheet />
      </StoryProvider>
    </AudioProvider>
  );
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>('checking');

  useEffect(() => {
    if (window.location.pathname === '/privacy' || window.location.pathname === '/privacy/') {
      window.location.replace('/privacy.html');
      return;
    }

    let cancelled = false;
    const returningFromGoogle = new URLSearchParams(window.location.search).has('code');

    const check = async () => {
      const ok = await hasSession();
      if (!cancelled) setAuth(ok ? 'in' : 'out');
    };

    const stop = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signInWithRedirect') void check();
      if (payload.event === 'signInWithRedirect_failure') setAuth('out');
    });

    if (returningFromGoogle) {
      // Amplify is exchanging the OAuth code (PKCE); wait for its Hub event, with a safety net.
      const timer = setTimeout(() => void check(), 8000);
      return () => {
        cancelled = true;
        clearTimeout(timer);
        stop();
      };
    }
    void check();
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return (
    <AppProvider enabled={auth === 'in'}>
      <AppShell9x16>
        {auth === 'checking' && <Splash />}
        {auth === 'out' && <LoginScreen />}
        {auth === 'in' && <Main />}
      </AppShell9x16>
    </AppProvider>
  );
}
