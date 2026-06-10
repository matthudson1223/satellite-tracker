import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EARTH_RADIUS_UNITS, KM_PER_UNIT } from '../core/frames';

export class CameraRig {
  readonly controls: OrbitControls;
  private camera: THREE.PerspectiveCamera;
  private followTarget = new THREE.Vector3();
  private following = false;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = EARTH_RADIUS_UNITS * 1.06;
    this.controls.maxDistance = 120;
    this.controls.enablePan = false;
    this.controls.zoomSpeed = 0.7;
  }

  private adaptSpeed(): void {
    const dist = this.camera.position.distanceTo(this.controls.target);
    const t = THREE.MathUtils.clamp(
      (dist - this.controls.minDistance) / (EARTH_RADIUS_UNITS * 4),
      0.02,
      1,
    );
    this.controls.rotateSpeed = t;
  }

  flyTo(worldPos: THREE.Vector3): void {
    const dist = Math.max(
      this.camera.position.length(),
      worldPos.length() + EARTH_RADIUS_UNITS * 0.6,
    );
    const dir = worldPos.clone().normalize();
    this.camera.position.copy(dir.multiplyScalar(dist));
    this.controls.target.set(0, 0, 0);
  }

  setFollow(on: boolean): void {
    this.following = on;
    if (!on) this.controls.target.set(0, 0, 0);
  }

  updateFollow(eciKm: { x: number; y: number; z: number } | null): void {
    if (!this.following || !eciKm) return;
    this.followTarget.set(eciKm.x / KM_PER_UNIT, eciKm.z / KM_PER_UNIT, eciKm.y / KM_PER_UNIT);
    this.controls.target.lerp(this.followTarget, 0.15);
  }

  update(): void {
    this.adaptSpeed();
    this.controls.update();
  }
}