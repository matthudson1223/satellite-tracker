import { signal, computed } from '@preact/signals';
import type { CategoryId } from '../data/categories';

/** Simulation time in ms since Unix epoch. Updated once per frame by the scene loop. */
export const simTime = signal<number>(Date.now());

/** Sim seconds per wall second. 0 = paused, negative = reverse. */
export const timeRate = signal<number>(1);

/** True when the clock is anchored to the wall clock at 1x. */
export const isLive = signal<boolean>(true);

/** Bitmask of enabled categories (see data/categories.ts). */
export const filterMask = signal<number>(~0 >>> 0);

/** Altitude regime filters. All on by default. */
export const regimeMask = signal<number>(0b1111); // LEO | MEO | GEO | HEO

/** NORAD ID of the selected satellite, or null. */
export const selectedId = signal<number | null>(null);

/** Isolation mode: dim everything but the selected satellite. */
export const isolation = signal<boolean>(false);

/** Camera follows the selected satellite. */
export const followSelected = signal<boolean>(false);

/** Catalog load status for the status toast / boot screen. */
export const catalogStatus = signal<{
  state: 'loading' | 'ready' | 'error';
  message: string;
  count: number;
  dataAgeMs: number | null;
}>({ state: 'loading', message: 'Loading catalog…', count: 0, dataAgeMs: null });

/** Whether debris groups have been requested (lazy-loaded). */
export const debrisEnabled = signal<boolean>(false);

/** Count of satellites currently passing the filters (for the HUD). */
export const visibleCount = signal<number>(0);

/** Live per-category counts for the filter panel. */
export const categoryCounts = signal<Partial<Record<CategoryId, number>>>({});

export const hasSelection = computed(() => selectedId.value !== null);

/** Live readout for the selected satellite, updated ~10 Hz by the frame loop. */
export const liveTelemetry = signal<{
  lat: number;
  lon: number;
  altKm: number;
  velKms: number;
} | null>(null);