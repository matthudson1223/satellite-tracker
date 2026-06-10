import { useState, useEffect } from 'preact/hooks';
import { fetchTransmitters, formatFrequency, type Transmitter } from '../data/satnogs';

type TxState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; transmitters: Transmitter[] };

export function TransmitterList({ noradId }: { noradId: number }) {
  const [state, setState] = useState<TxState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchTransmitters(noradId)
      .then((transmitters) => {
        if (!cancelled) setState({ status: 'ready', transmitters });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ status: 'error', message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [noradId]);

  if (state.status === 'loading') {
    return <div class="tx-loading">Looking up transmitters…</div>;
  }
  if (state.status === 'error') {
    return <div class="tx-error">Transmitter lookup failed (SatNOGS unreachable)</div>;
  }
  if (state.transmitters.length === 0) {
    return <div class="tx-empty">No public transmitters known (SatNOGS DB)</div>;
  }
  return (
    <div>
      {state.transmitters.map((t, i) => (
        <div key={i} class={`tx ${t.status !== 'active' ? 'inactive' : ''}`}>
          <span class={`tx-status ${t.status === 'active' ? 'active' : 'inactive'}`}>
            {t.status}
          </span>
          <div class="desc">{t.description}</div>
          <div class="freqs">
            ↓ {formatFrequency(t.downlinkLowHz)}
            {t.uplinkLowHz != null && <> · ↑ {formatFrequency(t.uplinkLowHz)}</>}
          </div>
          <div class="meta">
            {[t.mode, t.baud != null ? `${t.baud} Bd` : null, t.service]
              .filter(Boolean)
              .join(' · ') || t.type}
          </div>
        </div>
      ))}
    </div>
  );
}