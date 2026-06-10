import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect } from 'postprocessing';
import { EARTH_RADIUS_UNITS } from '../core/frames';

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly composer: EffectComposer;
  /** Everything Earth-fixed parents here; rotated by GMST each frame. */
  readonly earthGroup: THREE.Group;

  private frameCallbacks: ((dtMs: number, nowMs: number) => void)[] = [];
  private lastFrame = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.01,
      400,
    );
    this.camera.position.set(EARTH_RADIUS_UNITS * 3.2, EARTH_RADIUS_UNITS * 1.4, EARTH_RADIUS_UNITS * 1.6);

    this.earthGroup = new THREE.Group();
    this.scene.add(this.earthGroup);

    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
    });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new BloomEffect({
      luminanceThreshold: 1.0,
      luminanceSmoothing: 0.25,
      intensity: 1.1,
      mipmapBlur: true,
    });
    this.composer.addPass(new EffectPass(this.camera, bloom, new SMAAEffect()));

    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  private onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  };

  onFrame(cb: (dtMs: number, nowMs: number) => void): void {
    this.frameCallbacks.push(cb);
  }

  start(): void {
    this.renderer.setAnimationLoop(() => {
      const now = performance.now();
      const dt = now - this.lastFrame;
      this.lastFrame = now;
      for (const cb of this.frameCallbacks) cb(dt, now);
      this.composer.render();
    });
  }
}