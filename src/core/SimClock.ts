/**
 * Maps wall time (performance.now) to simulation time.
 * Re-anchors on every rate change or scrub so adjustments never jump time.
 */
export class SimClock {
  private anchorSimMs: number;
  private anchorPerfMs: number;
  private _rate: number;

  constructor(startMs = Date.now(), rate = 1) {
    this.anchorSimMs = startMs;
    this.anchorPerfMs = performance.now();
    this._rate = rate;
  }

  get rate(): number {
    return this._rate;
  }

  now(): number {
    return this.anchorSimMs + (performance.now() - this.anchorPerfMs) * this._rate;
  }

  setRate(rate: number): void {
    this.anchorSimMs = this.now();
    this.anchorPerfMs = performance.now();
    this._rate = rate;
  }

  /** Jump to an absolute sim time, keeping the current rate. */
  setTime(simMs: number): void {
    this.anchorSimMs = simMs;
    this.anchorPerfMs = performance.now();
  }

  /** Re-anchor to the wall clock at 1x. */
  goLive(): void {
    this.anchorSimMs = Date.now();
    this.anchorPerfMs = performance.now();
    this._rate = 1;
  }

  /** Live = tracking the wall clock at 1x within a small tolerance. */
  isLive(): boolean {
    return this._rate === 1 && Math.abs(this.now() - Date.now()) < 2000;
  }
}