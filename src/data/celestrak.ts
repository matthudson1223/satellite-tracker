import type { OMMJsonObject } from 'satellite.js';
import { getCached, type CachedResult } from './cache';

/**
 * CelesTrak OMM JSON record (FORMAT=json): the satellite.js OMM type narrowed
 * to the numeric fields CelesTrak actually emits and our code does math on.
 */
export type GpRecord = OMMJsonObject & {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  NORAD_CAT_ID: number;
};

const BASE = 'https://celestrak.org/NORAD/elements/gp.php';
const GP_TTL_MS = 8 * 3600_000; // CelesTrak asks for >= 2h between pulls per group

export async function fetchGroup(
  group: string,
  onRefresh?: (fresh: CachedResult<GpRecord[]>) => void,
): Promise<CachedResult<GpRecord[]>> {
  return getCached<GpRecord[]>(
    `gp:${group}`,
    async () => {
      const res = await fetch(`${BASE}?GROUP=${encodeURIComponent(group)}&FORMAT=json`);
      if (!res.ok) throw new Error(`CelesTrak ${group}: HTTP ${res.status}`);
      const data = (await res.json()) as GpRecord[];
      if (!Array.isArray(data)) throw new Error(`CelesTrak ${group}: unexpected payload`);
      return data;
    },
    GP_TTL_MS,
    onRefresh,
  );
}