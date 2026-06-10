import { json2satrec, sgp4, jday, type SatRec } from 'satellite.js';
import type { WorkerInbound, WorkerOutbound } from './protocol';
import { cadenceMs } from './protocol';

let satrecs: (SatRec | null)[] = [];
let epochJd: Float64Array = new Float64Array(0);

let anchorSimMs = Date.now();
let anchorWallMs = Date.now();
let rate = 1;
let timer: ReturnType<typeof setInterval> | null = null;

const recycledPos: ArrayBuffer[] = [];
const recycledVel: ArrayBuffer[] = [];

function post(msg: WorkerOutbound, transfer?: Transferable[]): void {
  (self as unknown as Worker).postMessage(msg, transfer ?? []);
}

function simNow(): number {
  return anchorSimMs + (Date.now() - anchorWallMs) * rate;
}

function addSatrecs(records: Parameters<typeof json2satrec>[0][]): number {
  let failed = 0;
  for (const rec of records) {
    try {
      const sr = json2satrec(rec);
      satrecs.push(sr);
    } catch {
      satrecs.push(null);
      failed++;
    }
  }
  const next = new Float64Array(satrecs.length);
  next.set(epochJd);
  for (let i = epochJd.length; i < satrecs.length; i++) {
    next[i] = satrecs[i]?.jdsatepoch ?? 0;
  }
  epochJd = next;
  return failed;
}

function propagateAll(): void {
  const n = satrecs.length;
  if (n === 0) return;

  const posBuf = recycledPos.pop() ?? new ArrayBuffer(n * 3 * 4);
  const velBuf = recycledVel.pop() ?? new ArrayBuffer(n * 3 * 4);
  const positions =
    posBuf.byteLength >= n * 12 ? new Float32Array(posBuf, 0, n * 3) : new Float32Array(n * 3);
  const velocities =
    velBuf.byteLength >= n * 12 ? new Float32Array(velBuf, 0, n * 3) : new Float32Array(n * 3);
  const flags = new Uint8Array(n);

  const t = simNow();
  const d = new Date(t);
  const jd = jday(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds() + d.getUTCMilliseconds() / 1000,
  );

  for (let i = 0; i < n; i++) {
    const sr = satrecs[i];
    if (!sr) {
      flags[i] = 1;
      continue;
    }
    const tsinceMin = (jd - epochJd[i]) * 1440;
    const result = sgp4(sr, tsinceMin);
    const pos = result?.position;
    const vel = result?.velocity;
    if (!pos || !vel) {
      flags[i] = 1;
      positions[i * 3] = positions[i * 3 + 1] = positions[i * 3 + 2] = 0;
      continue;
    }
    const r = Math.hypot(pos.x, pos.y, pos.z);
    if (!Number.isFinite(r) || r < 6471 || r > 500_000) {
      flags[i] = 1;
      positions[i * 3] = positions[i * 3 + 1] = positions[i * 3 + 2] = 0;
      continue;
    }
    positions[i * 3] = pos.x;
    positions[i * 3 + 1] = pos.y;
    positions[i * 3 + 2] = pos.z;
    velocities[i * 3] = vel.x;
    velocities[i * 3 + 1] = vel.y;
    velocities[i * 3 + 2] = vel.z;
  }

  post(
    {
      type: 'SNAPSHOT',
      simTimeMs: t,
      count: n,
      positions: positions.buffer,
      velocities: velocities.buffer,
      flags: flags.buffer,
    },
    [positions.buffer, velocities.buffer, flags.buffer],
  );
}

function restartTimer(): void {
  if (timer !== null) clearInterval(timer);
  propagateAll();
  if (rate === 0) {
    timer = null;
    return;
  }
  timer = setInterval(propagateAll, cadenceMs(rate));
}

self.onmessage = (ev: MessageEvent<WorkerInbound>) => {
  const msg = ev.data;
  switch (msg.type) {
    case 'INIT': {
      satrecs = [];
      epochJd = new Float64Array(0);
      const failed = addSatrecs(msg.records);
      post({ type: 'READY', count: satrecs.length, failed });
      restartTimer();
      break;
    }
    case 'ADD': {
      const failed = addSatrecs(msg.records);
      post({ type: 'READY', count: satrecs.length, failed });
      restartTimer();
      break;
    }
    case 'SET_TIME': {
      anchorSimMs = msg.anchorSimMs;
      anchorWallMs = msg.anchorWallMs;
      rate = msg.rate;
      restartTimer();
      break;
    }
    case 'RECYCLE': {
      if (recycledPos.length < 3) recycledPos.push(msg.positions);
      if (recycledVel.length < 3) recycledVel.push(msg.velocities);
      break;
    }
  }
};