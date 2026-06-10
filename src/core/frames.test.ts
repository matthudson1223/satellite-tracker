import { describe, it, expect } from 'vitest';
import { gmstAt, earthRotationY, eciKmToWorld, eciToLatLon, KM_PER_UNIT, EARTH_RADIUS_UNITS } from './frames';

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

describe('gmstAt', () => {
  it('matches the known GMST at the J2000.0 epoch', () => {
    expect(gmstAt(J2000_MS)).toBeCloseTo(4.894961, 4);
  });

  it('advances ~360° per sidereal day (slightly more than 2π per solar day)', () => {
    const a = gmstAt(J2000_MS);
    const b = gmstAt(J2000_MS + 86_400_000);
    const advance = (b - a + 2 * Math.PI * 3) % (2 * Math.PI);
    expect(advance).toBeCloseTo(0.0172, 3);
  });
});

describe('earthRotationY', () => {
  it('is the negated GMST (Y-up axis swap flips rotation sense)', () => {
    expect(earthRotationY(J2000_MS)).toBeCloseTo(-gmstAt(J2000_MS), 12);
  });
});

describe('eciKmToWorld', () => {
  it('scales km to world units and swaps Y/Z', () => {
    const out = { x: 0, y: 0, z: 0 };
    eciKmToWorld(7000, -2000, 3000, out);
    expect(out.x).toBeCloseTo(7000 / KM_PER_UNIT);
    expect(out.y).toBeCloseTo(3000 / KM_PER_UNIT);
    expect(out.z).toBeCloseTo(-2000 / KM_PER_UNIT);
  });

  it('puts the Earth surface at EARTH_RADIUS_UNITS', () => {
    const out = { x: 0, y: 0, z: 0 };
    eciKmToWorld(6371, 0, 0, out);
    expect(out.x).toBeCloseTo(EARTH_RADIUS_UNITS);
  });
});

describe('eciToLatLon', () => {
  it('maps an equatorial-plane position to ~0° latitude with sane height', () => {
    const geo = eciToLatLon({ x: 7000, y: 0, z: 0 }, J2000_MS);
    expect(Math.abs(geo.lat)).toBeLessThan(0.01);
    expect(geo.heightKm).toBeCloseTo(7000 - 6378.137, 0);
    expect(geo.lon).toBeGreaterThanOrEqual(-180);
    expect(geo.lon).toBeLessThanOrEqual(180);
  });

  it('maps a polar-axis position to ~90° latitude', () => {
    const geo = eciToLatLon({ x: 0, y: 0, z: 7000 }, J2000_MS);
    expect(geo.lat).toBeCloseTo(90, 1);
  });
});