import * as THREE from 'three';
import { KM_PER_UNIT } from '../core/frames';
import type { SatelliteLayer } from './SatelliteLayer';
import type { SatEntry } from '../data/catalog';
import { CATEGORY_BIT } from '../data/categories';

const PICK_RADIUS_PX = 14;

export class Picker {
  private v = new THREE.Vector3();
  private mvp = new THREE.Matrix4();

  pick(
    clientX: number,
    clientY: number,
    camera: THREE.PerspectiveCamera,
    layer: SatelliteLayer,
    sats: SatEntry[],
    filterMask: number,
    regimeMask: number,
    simNowMs: number,
  ): SatEntry | null {
    const pos = layer.snapshotPositions;
    const vel = layer.snapshotVelocities;
    const flags = layer.snapshotFlags;
    if (pos.length === 0) return null;

    const dtSim = (simNowMs - layer.snapshotSimMs) / 1000;
    const w = window.innerWidth;
    const h = window.innerHeight;

    camera.updateMatrixWorld();
    this.mvp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

    let best: SatEntry | null = null;
    let bestDist = PICK_RADIUS_PX;
    let bestIsDebris = true;

    const n = Math.min(sats.length, flags.length);
    for (let i = 0; i < n; i++) {
      if (flags[i]) continue;
      const s = sats[i];
      if (!(s.categoryMask & filterMask) || !(s.regime & regimeMask)) continue;

      const j = i * 3;
      this.v.set(
        (pos[j] + vel[j] * dtSim) / KM_PER_UNIT,
        (pos[j + 2] + vel[j + 2] * dtSim) / KM_PER_UNIT,
        (pos[j + 1] + vel[j + 1] * dtSim) / KM_PER_UNIT,
      );
      this.v.applyMatrix4(this.mvp);
      if (this.v.z > 1 || this.v.z < -1) continue;

      const sx = (this.v.x * 0.5 + 0.5) * w;
      const sy = (-this.v.y * 0.5 + 0.5) * h;
      const d = Math.hypot(sx - clientX, sy - clientY);
      const isDebris = (s.categoryMask & CATEGORY_BIT.debris) !== 0;

      if (d < PICK_RADIUS_PX && ((bestIsDebris && !isDebris) || (isDebris === bestIsDebris && d < bestDist))) {
        best = s;
        bestDist = d;
        bestIsDebris = isDebris;
      }
    }
    return best;
  }
}