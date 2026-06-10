/**
 * Positional accuracy gate. Run with: npm run check-accuracy
 *
 * 1. gstime() vs published GMST at J2000.0 epoch.
 * 2. A GEO satellite's subsatellite longitude must stay nearly fixed over a
 *    simulated day (catches GMST sign errors, frame confusion, time-unit bugs).
 * 3. ISS propagated at its own epoch must sit at a sane LEO altitude/speed.
 */
import {
  twoline2satrec,
  sgp4,
  gstime,
  eciToGeodetic,
  degreesLat,
  degreesLong,
  jday,
} from 'satellite.js';
import type { EciVec3, Kilometer } from 'satellite.js';

let failures = 0;

function check(name: string, ok: boolean, detail: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
  if (!ok) failures++;
}

// ---- 1. GMST at J2000.0 ----
{
  const gmst = gstime(new Date(Date.UTC(2000, 0, 1, 12, 0, 0)));
  const expected = 4.894961;
  const err = Math.abs(gmst - expected);
  check('GMST @ J2000.0', err < 0.001, `got ${gmst.toFixed(6)} rad, expected ~${expected}`);
}

async function fetchTle(catnr: number): Promise<[string, string, string]> {
  const res = await fetch(
    `https://celestrak.org/NORAD/elements/gp.php?CATNR=${catnr}&FORMAT=tle`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const lines = (await res.text()).trim().split('\n').map((l) => l.trim());
  return [lines[0], lines[1], lines[2]];
}

function jdayOf(ms: number): number {
  const d = new Date(ms);
  return jday(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds() + d.getUTCMilliseconds() / 1000,
  );
}

// ---- 2. GOES-East longitude stability ----
{
  const [, l1, l2] = await fetchTle(60133);
  const satrec = twoline2satrec(l1, l2);
  const epochMs = (satrec.jdsatepoch - 2440587.5) * 86400_000;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (let h = 0; h <= 24; h++) {
    const t = epochMs + h * 3600_000;
    const result = sgp4(satrec, (jdayOf(t) - satrec.jdsatepoch) * 1440);
    if (!result?.position) throw new Error('GOES propagation failed');
    const geo = eciToGeodetic(result.position as EciVec3<Kilometer>, gstime(new Date(t)));
    const lon = degreesLong(geo.longitude);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }
  const drift = maxLon - minLon;
  check(
    'GOES-East longitude stability over 24h',
    drift < 0.5 && minLon < -74.5 && maxLon > -75.9,
    `lon range [${minLon.toFixed(2)}, ${maxLon.toFixed(2)}]° (expected ~-75.2°, drift ${drift.toFixed(3)}°)`,
  );
}

// ---- 3. ISS at its own epoch ----
{
  const [, l1, l2] = await fetchTle(25544);
  const satrec = twoline2satrec(l1, l2);
  const result = sgp4(satrec, 0);
  if (!result?.position || !result.velocity) throw new Error('ISS propagation failed');
  const p = result.position;
  const v = result.velocity;
  const alt = Math.hypot(p.x, p.y, p.z) - 6371;
  const speed = Math.hypot(v.x, v.y, v.z);
  check('ISS altitude @ epoch', alt > 370 && alt < 460, `${alt.toFixed(1)} km`);
  check('ISS speed @ epoch', speed > 7.5 && speed < 7.8, `${speed.toFixed(3)} km/s`);

  const epochMs = (satrec.jdsatepoch - 2440587.5) * 86400_000;
  const geo = eciToGeodetic(result.position as EciVec3<Kilometer>, gstime(new Date(epochMs)));
  check(
    'ISS latitude within inclination bounds',
    Math.abs(degreesLat(geo.latitude)) <= 51.7,
    `lat ${degreesLat(geo.latitude).toFixed(2)}° (|lat| must be ≤ 51.6°)`,
  );
}

console.log(failures === 0 ? '\nAll accuracy checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);