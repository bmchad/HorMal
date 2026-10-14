import type { ReactNode } from 'react';

/**
 * Strict 9:16 smartphone shell.
 * - Mobile: full-bleed `100dvh`, safe areas respected by Header / Bottom nav.
 * - Desktop/tablet: centered inside a locked 9:16 phone frame over a dark ambient backdrop.
 */
export function AppShell9x16({ children }: { children: ReactNode }) {
  return (
    <div className="ambient flex min-h-[100dvh] w-full items-center justify-center sm:p-4">
      <div
        id="app-shell"
        className="relative mx-auto flex h-[100dvh] w-full max-w-[430px] flex-col overflow-hidden bg-slate-50 shadow-2xl sm:aspect-[9/16] sm:h-[92dvh] sm:w-auto sm:rounded-[2.5rem] sm:border-[6px] sm:border-slate-900"
      >
        {children}
      </div>
    </div>
  );
}
