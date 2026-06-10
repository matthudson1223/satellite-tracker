import type { GpRecord } from './celestrak';
import { fetchGroup } from './celestrak';
import { fetchSatcat, type SatcatEntry } from './satcat';
import {
  CATEGORIES,
  CATEGORY_BIT,
  DEBRIS_GROUPS,
  regimeBits,
  primaryCategoryIndex,
  type CategoryId,
} from './categories';
import { catalogStatus, categoryCounts } from '../state/store';

export interface SatEntry {
  /** Index into the packed render/worker arrays. */
  index: number;
  noradId: number;
  name: string;
  intlDesignator: string;
  gp: GpRecord;
  categoryMask: number;
  /** Bit index used by the shader color LUT. */
  primaryCategory: number;
  regime: number;
  satcat?: SatcatEntry;
}

const CORE_GROUPS = CATEGORIES.filter((c) => c.group !== null && c.id !== 'other').map((c) => ({
  group: c.group as string,
  bit: CATEGORY_BIT[c.id],
}));

function nameHeuristicMask(name: string): number {
  const n = name.toUpperCase();
  if (n.includes('DEB')) return CATEGORY_BIT.debris;
  if (n.startsWith('STARLINK')) return CATEGORY_BIT.starlink;
  if (n.startsWith('ONEWEB')) return CATEGORY_BIT.oneweb;
  if (n.startsWith('NAVSTAR') || n.startsWith('GPS') || n.startsWith('GSAT') || n.startsWith('BEIDOU') || n.startsWith('COSMOS') && n.includes('GLONASS')) return CATEGORY_BIT.gnss;
  if (n.startsWith('IRIDIUM')) return CATEGORY_BIT.iridium;
  if (n.startsWith('NOAA') || n.startsWith('GOES') || n.startsWith('METOP') || n.startsWith('METEOSAT') || n.startsWith('HIMAWARI')) return CATEGORY_BIT.weather;
  if (n.includes('ISS') || n.includes('TIANGONG') || n.includes('CSS')) return CATEGORY_BIT.stations;
  return 0;
}

export class Catalog {
  /** Ordered by packed index. */
  sats: SatEntry[] = [];
  byNorad = new Map<number, SatEntry>();
  satcat: Map<number, SatcatEntry> | null = null;

  private addRecords(records: GpRecord[], groupBit: number): SatEntry[] {
    const added: SatEntry[] = [];
    for (const gp of records) {
      const existing = this.byNorad.get(gp.NORAD_CAT_ID);
      if (existing) {
        existing.categoryMask |= groupBit;
        existing.primaryCategory = primaryCategoryIndex(existing.categoryMask);
        if (gp.EPOCH > existing.gp.EPOCH) existing.gp = gp;
        continue;
      }
      const heuristic = nameHeuristicMask(gp.OBJECT_NAME);
      let mask = groupBit | heuristic;
      if ((mask & ~CATEGORY_BIT.other) === 0) mask |= CATEGORY_BIT.other;
      const entry: SatEntry = {
        index: this.sats.length,
        noradId: gp.NORAD_CAT_ID,
        name: gp.OBJECT_NAME,
        intlDesignator: gp.OBJECT_ID,
        gp,
        categoryMask: mask,
        primaryCategory: primaryCategoryIndex(mask),
        regime: regimeBits(gp.MEAN_MOTION, gp.ECCENTRICITY),
        satcat: this.satcat?.get(gp.NORAD_CAT_ID),
      };
      this.sats.push(entry);
      this.byNorad.set(entry.noradId, entry);
      added.push(entry);
    }
    return added;
  }

  private updateCounts(): void {
    const counts: Partial<Record<CategoryId, number>> = {};
    for (const c of CATEGORIES) counts[c.id] = 0;
    for (const s of this.sats) {
      for (const c of CATEGORIES) {
        if (s.categoryMask & CATEGORY_BIT[c.id]) counts[c.id]= (counts[c.id] ?? 0) + 1;
      }
    }
    categoryCounts.value = counts;
  }

  async loadCore(): Promise<void> {
    catalogStatus.value = { ...catalogStatus.value, message: 'Loading satellite catalog…' };

    const satcatPromise = fetchSatcat().catch(() => null);

    let oldestFetch = Infinity;
    const groupResults = await Promise.allSettled(
      CORE_GROUPS.map(async ({ group, bit }) => {
        const res = await fetchGroup(group);
        oldestFetch = Math.min(oldestFetch, res.fetchedAt);
        return { records: res.payload, bit };
      }),
    );

    let activeRecords: GpRecord[] = [];
    try {
      const res = await fetchGroup('active');
      activeRecords = res.payload;
      oldestFetch = Math.min(oldestFetch, res.fetchedAt);
    } catch (err) {
      if (groupResults.every((r) => r.status === 'rejected')) {
        catalogStatus.value = {
          state: 'error',
          message: `Could not reach CelesTrak: ${(err as Error).message}`,
          count: 0,
          dataAgeMs: null,
        };
        throw err;
      }
    }

    this.satcat = await satcatPromise;

    for (const r of groupResults) {
      if (r.status === 'fulfilled') this.addRecords(r.value.records, r.value.bit);
    }
    this.addRecords(activeRecords, CATEGORY_BIT.other);

    if (this.satcat) {
      for (const s of this.sats) {
        s.satcat = this.satcat.get(s.noradId);
        if (s.satcat?.objectType === 'DEB' && !(s.categoryMask & CATEGORY_BIT.debris)) {
          s.categoryMask |= CATEGORY_BIT.debris;
        }
      }
    }

    this.updateCounts();
    catalogStatus.value = {
      state: 'ready',
      message: `${this.sats.length.toLocaleString()} objects tracked`,
      count: this.sats.length,
      dataAgeMs: oldestFetch === Infinity ? null : Date.now() - oldestFetch,
    };
  }

  async loadDebris(): Promise<SatEntry[]> {
    const results = await Promise.allSettled(DEBRIS_GROUPS.map((g) => fetchGroup(g)));
    const added: SatEntry[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        added.push(...this.addRecords(r.value.payload, CATEGORY_BIT.debris));
      }
    }
    this.updateCounts();
    catalogStatus.value = {
      ...catalogStatus.value,
      count: this.sats.length,
      message: `${this.sats.length.toLocaleString()} objects tracked`,
    };
    return added;
  }
}