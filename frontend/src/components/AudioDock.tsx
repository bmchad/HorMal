import { useAudio } from '../context/AudioContext';
import { useApp } from '../context/AppContext';
import { NextIcon, PauseIcon, PlayIcon, PrevIcon, ReplayIcon, StopIcon } from './icons';

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-7 items-center gap-[2px] pr-1" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`block w-[3px] origin-center rounded-full bg-gradient-to-t from-brand-600 to-accent-500 ${active ? 'animate-wave' : ''}`}
          style={{
            height: '100%',
            transform: active ? undefined : `scaleY(${[0.3, 0.6, 0.4, 0.65][i]})`,
            animationDelay: `${i * 0.13}s`,
          }}
        />
      ))}
    </div>
  );
}

const btn =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-700 transition active:scale-90 active:bg-brand-100 disabled:opacity-40';

/** Fixed bottom thumb-zone mini-player, docked directly above the bottom navigation. */
export function AudioDock() {
  const a = useAudio();
  const { t } = useApp();
  if (!a.total) return null;

  const playing = a.status === 'playing';
  const loading = a.status === 'loading';
  const busy = playing || loading || a.status === 'paused';

  return (
    <div
      id="audio-dock"
      className="glass relative z-20 shrink-0 border-t border-brand-100 px-3 py-1.5 shadow-[0_-8px_24px_-12px_rgba(76,29,149,0.25)]"
      role="region"
      aria-label="Audio player"
    >
      {a.notice && (
        <p className="mb-1 rounded-lg bg-amber-100 px-2 py-1 text-center text-[11px] font-medium text-amber-800 animate-fade-in">
          {a.notice}
        </p>
      )}
      <div className="flex items-center justify-between gap-0.5">
        <button
          id="dock-play"
          className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-500 text-white shadow-lg shadow-brand-600/40 transition active:scale-90"
          onClick={a.togglePlay}
          aria-label={playing || loading ? t('player.pause') : t('player.play')}
        >
          {loading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : playing ? (
            <PauseIcon width={22} height={22} />
          ) : (
            <PlayIcon width={22} height={22} />
          )}
        </button>

        <div className="flex items-center">
          <button id="dock-prev" className={btn} onClick={a.prev} aria-label={t('player.prev')}>
            <PrevIcon />
          </button>
          <span className="min-w-[38px] text-center font-display text-[13px] font-bold tabular-nums text-slate-700">
            {a.index + 1}/{a.total}
          </span>
          <button id="dock-next" className={btn} onClick={a.next} aria-label={t('player.next')}>
            <NextIcon />
          </button>
        </div>

        <button id="dock-replay" className={btn} onClick={a.replay} aria-label={t('player.replay')}>
          <ReplayIcon />
        </button>

        <button
          id="dock-speed"
          onClick={a.toggleSpeed}
          aria-label={t('player.speed')}
          className="inline-flex min-h-[44px] min-w-[52px] items-center justify-center rounded-full bg-brand-100 px-2.5 text-[13px] font-bold text-brand-700 tabular-nums transition active:scale-90"
        >
          {a.speed === 1 ? '1.0x' : '0.75x'}
        </button>

        <button id="dock-stop" className={btn} onClick={a.stop} disabled={!busy} aria-label={t('player.stop')}>
          <StopIcon width={18} height={18} />
        </button>

        <Waveform active={playing} />
      </div>
    </div>
  );
}
