import * as THREE from 'three';
import { json2satrec, sgp4, jday, type SatRec } from 'satellite.js';
import type { GpRecord } from '../data/celestrak';
import { KM_PER_UNIT, EARTH_RADIUS_UNITS, gmstAt } from '../core/frames';
import { eciToGeodetic } from 'satellite.js';
import type { EciVec3, Kilometer } from 'satellite.js';

const ORBIT_SAMPLES = 256;

export class OrbitLayer {
  private orbitLine: THREE.Line;
  private groundLine: THREE.Line;
  private satrec: SatRec | null = null;
  private periodMin = 0;
  private lastComputeMs = 0;
  private lastComputeSimMs = 0;

  constructor(scene: THREE.Scene, earthGroup: THREE.Group) {
    const mkGeometry = () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(ORBIT_SAMPLES * 3), 3),
      );
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ORBIT_SAMPLES * 3), 3));
      return g;
    };

    this.orbitLine = new THREE.Line(
      mkGeometry(),
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }),
    );
    this.orbitLine.frustumCulled = false;
    this.orbitLine.visible = false;
    scene.add(this.orbitLine);

    this.groundLine = new THREE.Line(
      mkGeometry(),
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75 }),
    );
    this.groundLine.frustumCulled = false;
    this.groundLine.visible = false;
    earthGroup.add(this.groundLine);
  }

  select(gp: GpRecord | null): void {
    if (!gp) {
      this.satrec = null;
      this.orbitLine.visible = false;
      this.groundLine.visible = false;
      return;
    }
    try {
      this.satrec = json2satrec(gp);
      this.periodMin = 1440 / gp.MEAN_MOTION;
      this.lastComputeMs = 0;
      this.orbitLine.visible = true;
      this.groundLine.visible = true;
    } catch {
      this.satrec = null;
    }
  }

  update(simNowMs: number, rate: number): void {
    if (!this.satrec) return;
    const wall = performance.now();
    const interval = Math.abs(rate) > 60 ? 1000 : 5000;
    const bigJump = Math.abs(simNowMs - this.lastComputeSimMs) > this.periodMin * 60_000 * 0.25;
    if (wall - this.lastComputeMs < interval && !bigJump) return;
    this.lastComputeMs = wall;
    this.lastComputeSimMs = simNowMs;

    const halfSpanMs = this.periodMin * 60_000;
    const orbitPos = this.orbitLine.geometry.getAttribute('position');
    const orbitCol = this.orbitLine.geometry.getAttribute('color');
    const groundPos = this.groundLine.geometry.getAttribute('position');
    const groundCol = this.groundLine.geometry.getAttribute('color');
    const orbitArr = orbitPos.array as Float32Array;
    const orbitColArr = orbitCol.array as Float32Array;
    const groundArr = groundPos.array as Float32Array;
    const groundColArr = groundCol.array as Float32Array;

    for (let i = 0; i < ORBIT_SAMPLES; i++) {
      const frac = i / (ORBIT_SAMPLES - 1);
      const tMs = simNowMs + (frac * 2 - 1) * halfSpanMs;
      const d = new Date(tMs);
      const jd = jday(
        d.getUTCFullYear(),
        d.getUTCMonth() + 1,
        d.getUTCDate(),
        d.getUTCHours(),
        d.getUTCMinutes(),
        d.getUTCSeconds() + d.getUTCMilliseconds() / 1000,
      );
      const result = sgp4(this.satrec, (jd - this.satrec.jdsatepoch) * 1440);
      const pos = result?.position;
      const j = i * 3;
      if (!pos || !Number.isFinite(pos.x)) {
        orbitArr[j] = orbitArr[Math.max(0, j - 3)];
        orbitArr[j + 1] = orbitArr[Math.max(0, j - 2)];
        orbitArr[j + 2] = orbitArr[Math.max(0, j - 1)];
        groundArr[j] = groundArr[Math.max(0, j - 3)];
        groundArr[j + 1] = groundArr[Math.max(0, j - 2)];
        groundArr[j + 2] = groundArr[Math.max(0, j - 1)];
        continue;
      }
      orbitArr[j] = pos.x / KM_PER_UNIT;
      orbitArr[j + 1] = pos.z / KM_PER_UNIT;
      orbitArr[j + 2] = pos.y / KM_PER_UNIT;

      const geo = eciToGeodetic(pos as EciVec3<Kilometer>, gmstAt(tMs));
      const lat = geo.latitude;
      const lon = geo.longitude;
      const r = EARTH_RADIUS_UNITS * 1.002;
      const cosLat = Math.cos(lat);
      const ex = r * cosLat * Math.cos(lon);
      const ey = r * cosLat * Math.sin(lon);
      const ez = r * Math.sin(lat);
      groundArr[j] = ex;
      groundArr[j + 1] = ez;
      groundArr[j + 2] = ey;

      const bright = 0.25 + 0.75 * frac;
      orbitColArr[j] = 0.55 * bright;
      orbitColArr[j + 1] = 0.8 * bright;
      orbitColArr[j + 2] = 1.0 * bright;
      groundColArr[j] = 1.0 * bright;
      groundColArr[j + 1] = 0.7 * bright;
      groundColArr[j + 2] = 0.35 * bright;
    }

    orbitPos.needsUpdate = true;
    orbitCol.needsUpdate = true;
    groundPos.needsUpdate = true;
    groundCol.needsUpdate = true;
  }
}