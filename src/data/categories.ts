/** Satellite categories. Each is one bit in the filter mask. */
export const CATEGORIES = [
  { id: 'stations', label: 'Space Stations', color: '#ffffff', group: 'stations' },
  { id: 'starlink', label: 'Starlink', color: '#4fd8eb', group: 'starlink' },
  { id: 'oneweb', label: 'OneWeb', color: '#7c83ff', group: 'oneweb' },
  { id: 'gnss', label: 'Navigation (GNSS)', color: '#ffc84f', group: 'gnss' },
  { id: 'weather', label: 'Weather', color: '#5fe8a0', group: 'weather' },
  { id: 'science', label: 'Science', color: '#ff8de1', group: 'science' },
  { id: 'geo', label: 'Communications (GEO)', color: '#ffa05f', group: 'geo' },
  { id: 'amateur', label: 'Amateur Radio', color: '#c4ff5f', group: 'amateur' },
  { id: 'iridium', label: 'Iridium', color: '#9fd4ff', group: 'iridium-NEXT' },
  { id: 'other', label: 'Other Active', color: '#8fa3c8', group: 'active' },
  { id: 'debris', label: 'Debris', color: '#5a6066', group: null }, // lazy-loaded
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export const CATEGORY_BIT: Record<CategoryId, number> = Object.fromEntries(
  CATEGORIES.map((c, i) => [c.id, 1 << i]),
) as Record<CategoryId, number>;

export const ALL_CATEGORIES_MASK = (1 << CATEGORIES.length) - 1;

/** Index into the shader color LUT = bit index of the highest-priority category. */
export function primaryCategoryIndex(mask: number): number {
  for (let i = 0; i < CATEGORIES.length; i++) {
    if (mask & (1 << i)) return i;
  }
  return CATEGORIES.length - 2; // 'other'
}

export const DEBRIS_GROUPS = [
  'cosmos-1408-debris',
  'fengyun-1c-debris',
  'iridium-33-debris',
  'cosmos-2251-debris',
];

/** Altitude regimes (bits for regimeMask). */
export const REGIMES = [
  { id: 'leo', label: 'LEO', bit: 1 },
  { id: 'meo', label: 'MEO', bit: 2 },
  { id: 'geo', label: 'GEO', bit: 4 },
  { id: 'heo', label: 'HEO', bit: 8 },
] as const;

/**
 * Regime from mean motion (rev/day) and eccentricity.
 * GEO band: period within ~5% of sidereal day and near-circular.
 */
export function regimeBits(meanMotion: number, eccentricity: number): number {
  if (eccentricity > 0.25) return 8; // HEO
  const periodMin = 1440 / meanMotion;
  if (periodMin < 128) return 1; // LEO (< ~2000 km)
  if (periodMin > 1360 && periodMin < 1510) return 4; // GEO band
  return 2; // MEO
}