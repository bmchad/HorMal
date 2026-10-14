import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import { CloseIcon } from './icons';

function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

/** Mobile slide-up bottom sheet that rides above the virtual keyboard. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  id,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  id: string;
}) {
  const { t } = useApp();
  const inset = useKeyboardInset();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
      <button
        aria-label={t('common.close')}
        className="absolute inset-0 animate-fade-in bg-ink-950/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <section
        id={id}
        className="absolute inset-x-0 flex animate-sheet-up flex-col rounded-t-3xl bg-white shadow-[0_-20px_60px_-20px_rgba(76,29,149,0.5)]"
        style={{ bottom: inset, maxHeight: 'min(85dvh, calc(100% - 8px))' }}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-slate-300" />
        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-3">
          <h2 className="font-display text-lg font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full bg-slate-100 text-slate-600 active:scale-90"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-5 pb-3">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-slate-100 bg-white px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        )}
      </section>
    </div>
  );
}
