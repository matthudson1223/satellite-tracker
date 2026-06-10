import { gstime, eciToGeodetic, degreesLat, degreesLong } from 'satellite.js';
import type { EciVec3, Kilometer } from 'satellite.js';

/**
 * Frame conventions for the whole app:
 *
 * - World space is ECI (TEME). SGP4 output is used directly, scaled to world units.
 * - The Earth group rotates by +GMST around +Y each frame; everything Earth-fixed
 *   (globe mesh, ground tracks) lives inside it.
 * - Three.js is Y-up; ECI is Z-up. We map ECI (x, y, z) -> world (x, z, y),
 *   which keeps the frame right-handed with the north pole on world +Y.
 *   GMST rotation about world +Y then corresponds to rotation about ECI +Z.
 *   NOTE: under this map a positive ECI rotation about +Z appears as a NEGATIVE
 *   rotation about world +Y, so earthGroup.rotation.y = -gmst (verified by the
 *   GOES longitude check in scripts/check-accuracy.ts).
 */

/** World unit scale: 1 unit = 1000 km. */
export const KM_PER_UNIT = 1000;
export const EARTH_RADIUS_KM = 6371;
export const EARTH_RADIUS_UNITS = EARTH_RADIUS_KM / KM_PER_UNIT;

export { gstime };

/** GMST (radians) at a JS timestamp. */
export function gmstAt(ms: number): number {
  return gstime(new Date(ms));
}

/** Earth group Y-rotation for a given sim time (see axis-map note above). */
export function earthRotationY(ms: number): number {
  return -gmstAt(ms);
}

/** ECI km -> world units (Y-up swap). Writes into `out` [x,y,z]. */
export function eciKmToWorld(
  x: number,
  y: number,
  z: number,
  out: { x: number; y: number; z: number },
): void {
  out.x = x / KM_PER_UNIT;
  out.y = z / KM_PER_UNIT;
  out.z = y / KM_PER_UNIT;
}

/** Geodetic lat/lon (degrees) + height (km) for an ECI position at a time. */
export function eciToLatLon(
  posEciKm: { x: number; y: number; z: number },
  ms: number,
): { lat: number; lon: number; heightKm: number } {
  const geo = eciToGeodetic(posEciKm as EciVec3<Kilometer>, gmstAt(ms));
  return {
    lat: degreesLat(geo.latitude),
    lon: degreesLong(geo.longitude),
    heightKm: geo.height,
  };
}