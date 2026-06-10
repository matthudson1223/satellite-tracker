import { useState, useMemo, useRef } from 'preact/hooks';
import type { Catalog, SatEntry } from '../data/catalog';
import type { AppActions } from './actions';

function fuzzyScore(name: string, query: string): number {
  const n = name.toUpperCase();
  const q = query.toUpperCase();
  if (n === q) return 1000;
  if (n.startsWith(q)) return 500 - n.length;
  const idx = n.indexOf(q);
  if (idx >= 0) return 200 - idx - n.length * 0.1;
  let qi = 0;
  for (let i = 0; i < n.length && qi < q.length; i++) {
    if (n[i] === q[qi]) qi++;
  }
  return qi === q.length ? 50 - n.length * 0.1 : -1;
}

export function SearchBar({ catalog, actions }: { catalog: Catalog; actions: AppActions }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo((): SatEntry[] => {
    const q = query.trim();
    if (q.length < 2) return [];
    const asId = parseInt(q, 10);
    if (Number.isFinite(asId) && /^\d+$/.test(q)) {
      const exact = catalog.byNorad.get(asId);
      if (exact) return [exact];
    }
    const scored: { s: SatEntry; score: number }[] = [];
    for (const s of catalog.sats) {
      const score = fuzzyScore(s.name, q);
      if (score > 0) scored.push({ s, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 20).map((x) => x.s);
  }, [query, catalog.sats.length]);

  const select = (s: SatEntry) => {
    actions.selectSatellite(s.noradId);
    setQuery('');
    setActive(0);
    inputRef.current?.blur();
  };

  return (
    <div class="search-wrap">
      <p class="brand">
        <b>ORBITAL</b> · satellite tracker
      </p>
      <div class="panel">
        <input
          ref={inputRef}
          class="search-input"
          type="text"
          placeholder="Search name or NORAD ID…"
          value={query}
          onInput={(e) => {
            setQuery((e.target as HTMLInputElement).value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && results[active]) {
              select(results[active]);
            } else if (e.key === 'Escape') {
              setQuery('');
            }
          }}
        />
        {results.length > 0 && (
          <div class="search-results">
            {results.map((s, i) => (
              <div
                key={s.noradId}
                class={`search-result ${i === active ? 'active' : ''}`}
                onClick={() => select(s)}
              >
                <span>{s.name}</span>
                <span class="norad">{s.noradId}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}