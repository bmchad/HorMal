import { useApp } from '../context/AppContext';

export type TabId = 'practice' | 'conversation' | 'vocab' | 'profile';

const TABS: { id: TabId; emoji: string; key: string }[] = [
  { id: 'practice', emoji: '🎧', key: 'nav.practice' },
  { id: 'conversation', emoji: '🎙️', key: 'nav.conversation' },
  { id: 'vocab', emoji: '📚', key: 'nav.vocab' },
  { id: 'profile', emoji: '👤', key: 'nav.profile' },
];

export function BottomNav({ tab, onChange }: { tab: TabId; onChange: (t: TabId) => void }) {
  const { t } = useApp();
  return (
    <nav
      aria-label="Primary"
      className="relative z-20 shrink-0 border-t border-slate-200/80 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid h-16 grid-cols-4">
        {TABS.map((x) => {
          const active = tab === x.id;
          return (
            <li key={x.id} className="contents">
              <button
                id={`tab-${x.id}`}
                onClick={() => onChange(x.id)}
                aria-current={active ? 'page' : undefined}
                className="relative flex flex-col items-center justify-center gap-0.5 text-[12px] font-semibold transition-colors"
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full text-[19px] transition-all duration-300 ${
                    active ? 'bg-brand-100 scale-105' : 'scale-100 opacity-70'
                  }`}
                >
                  {x.emoji}
                </span>
                <span className={active ? 'text-brand-700' : 'text-slate-500'}>{t(x.key)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
