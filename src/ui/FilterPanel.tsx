import { useState } from 'preact/hooks';
import { CATEGORIES, CATEGORY_BIT, ALL_CATEGORIES_MASK, REGIMES } from '../data/categories';
import { filterMask, regimeMask, categoryCounts, debrisEnabled } from '../state/store';
import type { AppActions } from './actions';

export function FilterPanel({ actions }: { actions: AppActions }) {
  const [open, setOpen] = useState(true);
  const mask = filterMask.value;
  const rMask = regimeMask.value;
  const counts = categoryCounts.value;

  const toggleCategory = (id: (typeof CATEGORIES)[number]['id']) => {
    const bit = CATEGORY_BIT[id];
    if (id === 'debris' && !debrisEnabled.value && !(mask & bit)) {
      actions.enableDebris();
    }
    filterMask.value = mask ^ bit;
  };

  return (
    <div class={`panel filter-panel ${open ? '' : 'collapsed'}`}>
      <div class="filter-header" onClick={() => setOpen((o) => !o)}>
        <h3>Filters</h3>
        <span class={`filter-chevron ${open ? 'up' : 'down'}`}>›</span>
      </div>
      {open && (
        <>
          <h3 class="filter-sub">Categories</h3>
          {CATEGORIES.map((c) => (
            <label key={c.id} class="filter-row">
              <input
                type="checkbox"
                checked={(mask & CATEGORY_BIT[c.id]) !== 0}
                onChange={() => toggleCategory(c.id)}
              />
              <span class="swatch" style={{ background: c.color }} />
              <span>{c.label}</span>
              <span class="count">
                {c.id === 'debris' && !debrisEnabled.value
                  ? 'load'
                  : (counts[c.id] ?? 0).toLocaleString()}
              </span>
            </label>
          ))}
          <h3 class="filter-sub" style={{ marginTop: '14px' }}>Altitude</h3>
          <div class="regime-row">
            {REGIMES.map((r) => (
              <span
                key={r.id}
                class={`regime-chip ${(rMask & r.bit) !== 0 ? 'on' : ''}`}
                onClick={() => (regimeMask.value = rMask ^ r.bit)}
              >
                {r.label}
              </span>
            ))}
          </div>
          <div class="filter-actions">
            <button onClick={() => { filterMask.value = ALL_CATEGORIES_MASK; regimeMask.value = 15; }}>
              All
            </button>
            <button onClick={() => (filterMask.value = 0)}>None</button>
          </div>
        </>
      )}
    </div>
  );
}