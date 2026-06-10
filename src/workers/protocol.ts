import type { GpRecord } from '../data/celestrak';

/** Main -> worker */
export type WorkerInbound =
  | { type: 'INIT'; records: GpRecord[] }
  | { type: 'ADD'; records: GpRecord[] }
  | { type: 'SET_TIME'; anchorSimMs: number; anchorWallMs: number; rate: number }
  | { type: 'RECYCLE'; positions: ArrayBuffer; velocities: ArrayBuffer };

/** Worker -> main */
export type WorkerOutbound =
  | { type: 'READY'; count: number; failed: number }
  | {
      type: 'SNAPSHOT';
      simTimeMs: number;
      count: number;
      /** Float32Array(3N) ECI km; zeroed when flagged invalid. */
      positions: ArrayBuffer;
      /** Float32Array(3N) ECI km/s. */
      velocities: ArrayBuffer;
      /** Uint8Array(N): 0 = ok, 1 = propagation failed at this time. */
      flags: ArrayBuffer;
    };

/** Snapshot cadence by |rate|. */
export function cadenceMs(rate: number): number {
  return Math.abs(rate) > 60 ? 150 : 500;
}