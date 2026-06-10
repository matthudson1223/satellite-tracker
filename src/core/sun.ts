import { sunPos, jday } from 'satellite.js';

/**
 * Unit vector toward the Sun in ECI (TEME ≈ J2000 at visual accuracy),
 * mapped to world axes (Y-up swap, matching frames.ts).
 */
export function sunDirectionWorld(ms: number, out: { x: number; y: number; z: number }): void {
  const d = new Date(ms);
  const jd = jday(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
  );
  const { rsun } = sunPos(jd);
  const len = Math.hypot(rsun[0], rsun[1], rsun[2]);
  // ECI (x, y, z) -> world (x, z, y)
  out.x = rsun[0] / len;
  out.y = rsun[2] / len;
  out.z = rsun[1] / len;
}