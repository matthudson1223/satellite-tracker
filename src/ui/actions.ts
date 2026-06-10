/** Imperative bridge from UI components into the app/scene, wired up in main.ts. */
export interface AppActions {
  selectSatellite(noradId: number | null): void;
  setRate(rate: number): void;
  setTime(simMs: number): void;
  goLive(): void;
  setIsolation(on: boolean): void;
  setFollow(on: boolean): void;
  enableDebris(): void;
}

export const RATE_STEPS = [-3600, -1800, -300, -60, -10, -1, 0, 1, 10, 60, 300, 1800, 3600];