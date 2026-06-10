import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  CATEGORY_BIT,
  ALL_CATEGORIES_MASK,
  primaryCategoryIndex,
  regimeBits,
} from './categories';

describe('category bits', () => {
  it('assigns each category a unique single bit covered by the all-mask', () => {
    const seen = new Set<number>();
    for (const c of CATEGORIES) {
      const bit = CATEGORY_BIT[c.id];
      expect(bit & (bit - 1)).toBe(0);
      expect(seen.has(bit)).toBe(false);
      seen.add(bit);
      expect(ALL_CATEGORIES_MASK & bit).toBe(bit);
    }
  });
});

describe('primaryCategoryIndex', () => {
  it('picks the lowest set bit (list order = priority)', () => {
    expect(primaryCategoryIndex(CATEGORY_BIT.stations | CATEGORY_BIT.other)).toBe(0);
    expect(primaryCategoryIndex(CATEGORY_BIT.weather | CATEGORY_BIT.debris)).toBe(
      CATEGORIES.findIndex((c) => c.id === 'weather'),
    );
  });

  it('falls back to "other" for an empty mask', () => {
    expect(CATEGORIES[primaryCategoryIndex(0)].id).toBe('other');
  });
});

describe('regimeBits', () => {
  it('classifies the ISS as LEO', () => {
    expect(regimeBits(15.5, 0.0004)).toBe(1);
  });

  it('classifies GPS as MEO', () => {
    expect(regimeBits(2.0057, 0.01)).toBe(2);
  });

  it('classifies a geostationary satellite as GEO', () => {
    expect(regimeBits(1.0027, 0.0002)).toBe(4);
  });

  it('classifies a Molniya orbit as HEO regardless of period', () => {
    expect(regimeBits(2.006, 0.74)).toBe(8);
  });

  it('puts the GEO band edges in MEO, not GEO', () => {
    expect(regimeBits(1440 / 1300, 0.001)).toBe(2);
    expect(regimeBits(1440 / 1600, 0.001)).toBe(2);
  });
});