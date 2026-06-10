import { catalogStatus } from '../state/store';

export function StatusToast() {
  const s = catalogStatus.value;
  const showWhileLoading = s.state === 'loading';
  const showError = s.state === 'error';
  const staleHours = s.dataAgeMs != null ? s.dataAgeMs / 3600_000 : 0;
  const showStale = s.state === 'ready' && staleHours > 12;

  if (!showWhileLoading && !showError && !showStale) {
    return <div class="panel toast hidden" />;
  }
  return (
    <div class="panel toast">
      {showError && <>⚠ {s.message}</>}
      {showWhileLoading && s.message}
      {showStale && <>Using cached orbital data from {staleHours.toFixed(0)} h ago</>}
    </div>
  );
}

export function Hud() {
  const s = catalogStatus.value;
  return (
    <div class="hud">
      <div>{s.count > 0 ? `${s.count.toLocaleString()} objects` : ''}</div>
      <div>
        data <a href="https://celestrak.org">CelesTrak</a> ·{' '}
        <a href="https://db.satnogs.org">SatNOGS</a> · imagery NASA
      </div>
    </div>
  );
}