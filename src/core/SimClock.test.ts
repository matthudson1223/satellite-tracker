import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimClock } from './SimClock';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'performance'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SimClock', () => {
  it('advances sim time at the given rate', () => {
    const c = new SimClock(1000, 2);
    vi.advanceTimersByTime(500);
    expect(c.now()).toBe(1000 + 500 * 2);
  });

  it('runs backward with a negative rate', () => {
    const c = new SimClock(10_000, -10);
    vi.advanceTimersByTime(100);
    expect(c.now()).toBe(10_000 - 1000);
  });

  it('setRate re-anchors without jumping sim time', () => {
    const c = new SimClock(0, 1);
    vi.advanceTimersByTime(1000);
    c.setRate(100);
    expect(c.now()).toBe(1000);
    vi.advanceTimersByTime(10);
    expect(c.now()).toBe(1000 + 10 * 100);
  });

  it('setTime jumps to an absolute time and keeps the rate', () => {
    const c = new SimClock(0, 5);
    vi.advanceTimersByTime(100);
    c.setTime(50_000);
    expect(c.now()).toBe(50_000);
    vi.advanceTimersByTime(10);
    expect(c.now()).toBe(50_000 + 50);
  });

  it('goLive re-anchors to the wall clock at 1x', () => {
    const c = new SimClock(0, 1000);
    vi.advanceTimersByTime(60_000);
    c.goLive();
    expect(c.rate).toBe(1);
    expect(c.now()).toBe(Date.now());
    expect(c.isLive()).toBe(true);
  });

  it('isLive is false when warped or scrubbed away from the wall clock', () => {
    const c = new SimClock(Date.now(), 1);
    expect(c.isLive()).toBe(true);
    c.setRate(60);
    expect(c.isLive()).toBe(false);
    c.setRate(1);
    c.setTime(Date.now() + 3600_000);
    expect(c.isLive()).toBe(false);
  });
});