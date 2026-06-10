import { useState } from 'preact/hooks';
import { simTime, timeRate, isLive } from '../state/store';
import { RATE_STEPS, type AppActions } from './actions';

function formatRate(rate: number): string {
  if (rate === 0) return 'paused';
  return `${rate > 0 ? '' : '−'}${Math.abs(rate)}×`;
}

function formatUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
}

export function TimeBar({ actions }: { actions: AppActions }) {
  const [showPicker, setShowPicker] = useState(false);
  const rate = timeRate.value;
  const idx = RATE_STEPS.indexOf(rate);

  const step = (dir: 1 | -1) => {
    const i = idx >= 0 ? idx : RATE_STEPS.indexOf(1);
    const next = RATE_STEPS[Math.max(0, Math.min(RATE_STEPS.length - 1, i + dir))];
    actions.setRate(next);
  };

  return (
    <div class="panel time-bar">
      <button title="Slower / reverse" onClick={() => step(-1)}>
        ⏮
      </button>
      <button
        title={rate === 0 ? 'Play' : 'Pause'}
        onClick={() => actions.setRate(rate === 0 ? 1 : 0)}
      >
        {rate === 0 ? '▶' : '⏸'}
      </button>
      <button title="Faster" onClick={() => step(1)}>
        ⏭
      </button>
      <span class="rate">{formatRate(rate)}</span>
      <button class="clock" onClick={() => setShowPicker(!showPicker)}>
        {formatUtc(simTime.value)}
      </button>
      <button class={`live ${isLive.value ? 'on' : ''}`} onClick={() => actions.goLive()}>
        LIVE
      </button>
      {showPicker && (
        <div class="panel time-input">
          <input
            type="datetime-local"
            value={new Date(simTime.value).toISOString().slice(0, 16)}
            onChange={(e) => {
              const v = (e.target as HTMLInputElement).value;
              if (v) actions.setTime(Date.parse(v + ':00Z'));
              setShowPicker(false);
            }}
          />
        </div>
      )}
    </div>
  );
}