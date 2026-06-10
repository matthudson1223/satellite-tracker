import { describe, it, expect } from 'vitest';
import { mapTransmitters, formatFrequency } from './satnogs';

const raw = (over: Record<string, unknown>) => ({
  description: 'Telemetry',
  type: 'Transmitter',
  status: 'active',
  mode: 'BPSK',
  baud: 9600,
  downlink_low: 437_500_000,
  downlink_high: null,
  uplink_low: null,
  uplink_high: null,
  invert: false,
  service: 'Amateur',
  alive: true,
  ...over,
});

describe('mapTransmitters', () => {
  it('drops invalid transmitters', () => {
    const out = mapTransmitters([raw({ status: 'invalid' }), raw({ description: 'Beacon' })]);
    expect(out).toHaveLength(1);
    expect(out[0].description).toBe('Beacon');
  });

  it('sorts active transmitters before inactive ones', () => {
    const out = mapTransmitters([
      raw({ status: 'inactive', description: 'Old' }),
      raw({ status: 'active', description: 'Current' }),
    ]);
    expect(out.map((t) => t.description)).toEqual(['Current', 'Old']);
  });

  it('maps snake_case fields to the camelCase interface', () => {
    const [t] = mapTransmitters([raw({})]);
    expect(t.downlinkLowHz).toBe(437_500_000);
    expect(t.uplinkLowHz).toBeNull();
    expect(t.mode).toBe('BPSK');
    expect(t.baud).toBe(9600);
  });
});

describe('formatFrequency', () => {
  it('formats MHz below 1 GHz', () => {
    expect(formatFrequency(437_500_000)).toBe('437.500 MHz');
  });

  it('formats GHz at or above 1 GHz', () => {
    expect(formatFrequency(10_450_000_000)).toBe('10.4500 GHz');
  });

  it('renders a dash for missing values', () => {
    expect(formatFrequency(null)).toBe('—');
  });
});