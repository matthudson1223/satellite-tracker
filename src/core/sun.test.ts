import { describe, it, expect } from 'vitest';
import { sunDirectionWorld } from './sun';

describe('sunDirectionWorld', () => {
  it('returns a unit vector', () => {
    const out = { x: 0, y: 0, z: 0 };
    sunDirectionWorld(Date.UTC(2026, 5, 10), out);
    expect(Math.hypot(out.x, out.y, out.z)).toBeCloseTo(1, 6);
  });

  it('lies near the equatorial plane at the March equinox', () => {
    const out = { x: 0, y: 0, z: 0 };
    sunDirectionWorld(Date.UTC(2026, 2, 20, 14, 46), out);
    expect(Math.abs(out.y)).toBeLessThan(0.02);
  });

  it('points north of the equator at the June solstice', () => {
    const out = { x: 0, y: 0, z: 0 };
    sunDirectionWorld(Date.UTC(2026, 5, 21, 12, 0), out);
    expect(out.y).toBeGreaterThan(0.38);
    expect(out.y).toBeLessThan(0.41);
  });

  it('points south of the equator at the December solstice', () => {
    const out = { x: 0, y: 0, z: 0 };
    sunDirectionWorld(Date.UTC(2026, 11, 21, 12, 0), out);
    expect(out.y).toBeLessThan(-0.38);
  });
});