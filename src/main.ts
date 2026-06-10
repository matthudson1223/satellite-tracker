import * as THREE from 'three';
import { h, render } from 'preact';
import { SceneManager } from './render/SceneManager';
import { EarthLayer } from './render/EarthLayer';
import { SatelliteLayer } from './render/SatelliteLayer';
import { OrbitLayer } from './render/OrbitLayer';
import { Picker } from './render/Picker';
import { CameraRig } from './render/CameraRig';
import { SimClock } from './core/SimClock';
import { earthRotationY, eciToLatLon } from './core/frames';
import { sunDirectionWorld } from './core/sun';
import { Catalog } from './data/catalog';
import type { WorkerInbound, WorkerOutbound } from './workers/protocol';
import {
  simTime,
  timeRate,
  isLive,
  filterMask,
  regimeMask,
  selectedId,
  isolation,
  followSelected,
  debrisEnabled,
  liveTelemetry,
} from './state/store';
import { App } from './ui/App';
import type { AppActions } from './ui/actions';
import './ui/styles.css';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const bootEl = document.getElementById('boot')!;
const bootMsg = document.getElementById('boot-msg')!;

const scene = new SceneManager(canvas);
const earth = new EarthLayer(scene.earthGroup, scene.scene);
const satLayer = new SatelliteLayer(scene.scene);
const orbitLayer = new OrbitLayer(scene.scene, scene.earthGroup);
const picker = new Picker();
const rig = new CameraRig(scene.camera, canvas);
const clock = new SimClock();
const catalog = new Catalog();

const worker = new Worker(new URL('./workers/propagator.worker.ts', import.meta.url), {
  type: 'module',
});

function send(msg: WorkerInbound, transfer?: Transferable[]): void {
  worker.postMessage(msg, transfer ?? []);
}

function syncWorkerTime(): void {
  send({
    type: 'SET_TIME',
    anchorSimMs: clock.now(),
    anchorWallMs: Date.now(),
    rate: clock.rate,
  });
}

worker.onmessage = (ev: MessageEvent<WorkerOutbound>) => {
  const msg = ev.data;
  if (msg.type === 'SNAPSHOT') {
    const positions = new Float32Array(msg.positions);
    const velocities = new Float32Array(msg.velocities);
    const flags = new Uint8Array(msg.flags);
    satLayer.applySnapshot(msg.simTimeMs, positions, velocities, flags);
  }
};

const actions: AppActions = {
  selectSatellite(noradId) {
    selectedId.value = noradId;
    if (noradId == null) {
      isolation.value = false;
      followSelected.value = false;
      rig.setFollow(false);
      orbitLayer.select(null);
      liveTelemetry.value = null;
      return;
    }
    const sat = catalog.byNorad.get(noradId);
    if (!sat) return;
    orbitLayer.select(sat.gp);
    const i = sat.index;
    const p = satLayer.snapshotPositions;
    if (p.length > i * 3) {
      const dt = (clock.now() - satLayer.snapshotSimMs) / 1000;
      const v = satLayer.snapshotVelocities;
      rig.flyTo(
        new THREE.Vector3(
          (p[i * 3] + v[i * 3] * dt) / 1000,
          (p[i * 3 + 2] + v[i * 3 + 2] * dt) / 1000,
          (p[i * 3 + 1] + v[i * 3 + 1] * dt) / 1000,
        ),
      );
    }
  },
  setRate(rate) {
    clock.setRate(rate);
    timeRate.value = rate;
    isLive.value = clock.isLive();
    syncWorkerTime();
  },
  setTime(ms) {
    if (!Number.isFinite(ms)) return;
    clock.setTime(ms);
    isLive.value = clock.isLive();
    syncWorkerTime();
  },
  goLive() {
    clock.goLive();
    timeRate.value = 1;
    isLive.value = true;
    syncWorkerTime();
  },
  setIsolation(on) {
    isolation.value = on;
  },
  setFollow(on) {
    followSelected.value = on;
    rig.setFollow(on);
  },
  enableDebris() {
    if (debrisEnabled.value) return;
    debrisEnabled.value = true;
    catalog.loadDebris().then(() => pushCatalogToLayers(true));
  },
};

let pushedCount = 0;

function pushCatalogToLayers(incremental: boolean): void {
  const sats = catalog.sats;
  const n = sats.length;
  const categories = new Float32Array(n);
  const catMasks = new Float32Array(n);
  const regimes = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    categories[i] = sats[i].primaryCategory;
    catMasks[i] = sats[i].categoryMask;
    regimes[i] = sats[i].regime;
  }
  satLayer.setCatalog(categories, catMasks, regimes);

  if (incremental && pushedCount > 0) {
    send({ type: 'ADD', records: sats.slice(pushedCount).map((s) => s.gp) });
  } else {
    send({ type: 'INIT', records: sats.map((s) => s.gp) });
  }
  pushedCount = n;
  syncWorkerTime();
}

let downX = 0;
let downY = 0;
canvas.addEventListener('pointerdown', (e) => {
  downX = e.clientX;
  downY = e.clientY;
});
canvas.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
  const hit = picker.pick(
    e.clientX,
    e.clientY,
    scene.camera,
    satLayer,
    catalog.sats,
    filterMask.value,
    regimeMask.value,
    clock.now(),
  );
  actions.selectSatellite(hit ? hit.noradId : null);
});

const sunDir = new THREE.Vector3(1, 0, 0);
let lastSunUpdate = 0;
let lastTelemetry = 0;
let lastUiClock = 0;

scene.onFrame((dtMs) => {
  const now = clock.now();

  const wall = performance.now();
  if (wall - lastSunUpdate > (Math.abs(clock.rate) > 60 ? 100 : 1000)) {
    lastSunUpdate = wall;
    sunDirectionWorld(now, sunDir);
  }

  scene.earthGroup.rotation.y = earthRotationY(now);
  earth.update(sunDir, scene.camera.position, dtMs * Math.sign(clock.rate || 1));

  const selected = selectedId.value != null ? catalog.byNorad.get(selectedId.value) : undefined;
  satLayer.update(
    now,
    sunDir,
    filterMask.value,
    regimeMask.value,
    selected ? selected.index : -1,
    isolation.value ? 1 : 0,
  );
  orbitLayer.update(now, clock.rate);

  if (selected) {
    const i = selected.index;
    const p = satLayer.snapshotPositions;
    const v = satLayer.snapshotVelocities;
    if (p.length > i * 3 + 2 && !satLayer.snapshotFlags[i]) {
      const dt = (now - satLayer.snapshotSimMs) / 1000;
      const eci = {
        x: p[i * 3] + v[i * 3] * dt,
        y: p[i * 3 + 1] + v[i * 3 + 1] * dt,
        z: p[i * 3 + 2] + v[i * 3 + 2] * dt,
      };
      rig.updateFollow(eci);
      if (wall - lastTelemetry > 100) {
        lastTelemetry = wall;
        const geo = eciToLatLon(eci, now);
        liveTelemetry.value = {
          lat: geo.lat,
          lon: geo.lon,
          altKm: geo.heightKm,
          velKms: Math.hypot(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]),
        };
      }
    }
  }

  if (wall - lastUiClock > 200) {
    lastUiClock = wall;
    simTime.value = now;
    isLive.value = clock.isLive();
  }

  rig.update();
});

render(h(App, { catalog, actions }), document.getElementById('app')!);

scene.start();
bootMsg.textContent = 'Loading orbital data';

catalog
  .loadCore()
  .then(() => {
    pushCatalogToLayers(false);
    bootEl.classList.add('done');
  })
  .catch(() => {
    bootEl.classList.add('done');
  });