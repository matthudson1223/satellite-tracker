import { selectedId, liveTelemetry, isolation, followSelected, simTime } from '../state/store';
import { CATEGORIES, CATEGORY_BIT } from '../data/categories';
import type { Catalog } from '../data/catalog';
import type { AppActions } from './actions';
import { TransmitterList } from './TransmitterList';

const EARTH_MU = 398600.4418; // km^3/s^2

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div class="stat">
      <div class="label">{label}</div>
      <div class="value">
        {value} {unit && <small>{unit}</small>}
      </div>
    </div>
  );
}

export function DetailPanel({ catalog, actions }: { catalog: Catalog; actions: AppActions }) {
  const id = selectedId.value;
  if (id == null) return null;
  const sat = catalog.byNorad.get(id);
  if (!sat) return null;

  const gp = sat.gp;
  const live = liveTelemetry.value;

  const periodMin = 1440 / gp.MEAN_MOTION;
  const nRadS = (gp.MEAN_MOTION * 2 * Math.PI) / 86400;
  const sma = Math.cbrt(EARTH_MU / (nRadS * nRadS));
  const apogee = sma * (1 + gp.ECCENTRICITY) - 6371;
  const perigee = sma * (1 - gp.ECCENTRICITY) - 6371;

  const epochAgeDays = Math.abs(simTime.value - Date.parse(gp.EPOCH + 'Z')) / 86400_000;

  return (
    <div class="panel detail-panel">
      <button class="close" onClick={() => actions.selectSatellite(null)}>
        ✕
      </button>
      <h2>{sat.name}</h2>
      <div class="sub">
        NORAD {sat.noradId} · {sat.intlDesignator}
      </div>
      <div>
        {CATEGORIES.filter((c) => sat.categoryMask & CATEGORY_BIT[c.id]).map((c) => (
          <span key={c.id} class="cat-chip" style={{ color: c.color }}>
            {c.label}
          </span>
        ))}
      </div>

      {live && (
        <div class="stat-grid">
          <Stat label="Altitude" value={live.altKm.toFixed(1)} unit="km" />
          <Stat label="Velocity" value={live.velKms.toFixed(2)} unit="km/s" />
          <Stat label="Latitude" value={`${live.lat.toFixed(3)}°`} />
          <Stat label="Longitude" value={`${live.lon.toFixed(3)}°`} />
        </div>
      )}

      <div class="detail-section">
        <h4>Orbit</h4>
        <div class="stat-grid">
          <Stat label="Period" value={periodMin.toFixed(1)} unit="min" />
          <Stat label="Inclination" value={`${gp.INCLINATION.toFixed(2)}°`} />
          <Stat label="Apogee" value={apogee.toFixed(0)} unit="km" />
          <Stat label="Perigee" value={perigee.toFixed(0)} unit="km" />
          <Stat label="Eccentricity" value={gp.ECCENTRICITY.toFixed(5)} />
          <Stat label="Revs/day" value={gp.MEAN_MOTION.toFixed(2)} />
        </div>
        {epochAgeDays > 5 && (
          <div class="epoch-warning">
            ⚠ Viewing {epochAgeDays.toFixed(0)} days from element epoch — position accuracy
            degrades with distance from epoch.
          </div>
        )}
      </div>

      {sat.satcat && (
        <div class="detail-section">
          <h4>Launch</h4>
          <div class="stat-grid">
            <Stat label="Date" value={sat.satcat.launchDate || '—'} />
            <Stat label="Country" value={sat.satcat.country || '—'} />
            <Stat label="Site" value={sat.satcat.launchSite || '—'} />
            <Stat label="Type" value={sat.satcat.objectType || '—'} />
          </div>
        </div>
      )}

      <div class="toggle-row">
        <button
          class={isolation.value ? 'on' : ''}
          onClick={() => actions.setIsolation(!isolation.value)}
        >
          {isolation.value ? '◉ Isolated' : '○ Isolate'}
        </button>
        <button
          class={followSelected.value ? 'on' : ''}
          onClick={() => actions.setFollow(!followSelected.value)}
        >
          {followSelected.value ? '◉ Following' : '○ Follow'}
        </button>
      </div>

      <div class="detail-section">
        <h4>Communication</h4>
        <TransmitterList noradId={sat.noradId} />
      </div>
    </div>
  );
}