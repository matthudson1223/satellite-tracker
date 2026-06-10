import * as THREE from 'three';
import { CATEGORIES } from '../data/categories';
import { KM_PER_UNIT } from '../core/frames';

const SAT_VERT = /* glsl */ `
attribute vec3 aPos0;
attribute vec3 aVel;
attribute float aCategory;
attribute float aFlags;
attribute float aCatMask;
attribute float aRegime;

uniform float uDtSim;
uniform float uKmPerUnit;
uniform float uFilterMask;
uniform float uRegimeMask;
uniform float uSelected;
uniform float uDimOthers;
uniform float uPixelRatio;
uniform float uTime;
uniform vec3 uSunDir;

varying vec3 vColor;
varying float vAlpha;
varying float vSelected;

const vec3 COLORS[11] = vec3[11](
  vec3(1.000, 1.000, 1.000),
  vec3(0.310, 0.847, 0.922),
  vec3(0.486, 0.514, 1.000),
  vec3(1.000, 0.784, 0.310),
  vec3(0.373, 0.910, 0.627),
  vec3(1.000, 0.553, 0.882),
  vec3(1.000, 0.627, 0.373),
  vec3(0.769, 1.000, 0.373),
  vec3(0.624, 0.831, 1.000),
  vec3(0.561, 0.639, 0.784),
  vec3(0.353, 0.376, 0.400)
);

bool maskHit(float bits, float mask) {
  float b = bits;
  float m = mask;
  for (int i = 0; i < 11; i++) {
    float bBit = mod(b, 2.0);
    float mBit = mod(m, 2.0);
    if (bBit >= 1.0 && mBit >= 1.0) return true;
    b = floor(b / 2.0);
    m = floor(m / 2.0);
  }
  return false;
}

void main() {
  bool visible = aFlags < 0.5
    && maskHit(aCatMask, uFilterMask)
    && maskHit(aRegime, uRegimeMask);

  bool isSelected = abs(float(gl_VertexID) - uSelected) < 0.5;
  if (isSelected) visible = true;
  vSelected = isSelected ? 1.0 : 0.0;

  if (!visible) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vColor = vec3(0.0);
    vAlpha = 0.0;
    return;
  }

  vec3 eci = aPos0 + aVel * uDtSim;
  vec3 posW = vec3(eci.x, eci.z, eci.y) / uKmPerUnit;

  vec4 mvPosition = viewMatrix * vec4(posW, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  int cat = int(aCategory + 0.5);
  vColor = COLORS[cat];

  float along = dot(eci, vec3(uSunDir.x, uSunDir.z, uSunDir.y));
  vec3 radial = eci - vec3(uSunDir.x, uSunDir.z, uSunDir.y) * along;
  bool eclipsed = along < 0.0 && length(radial) < 6371.0;
  float lit = eclipsed ? 0.35 : 1.0;

  float baseSize = cat == 10 ? 1.6 : (cat == 0 ? 5.0 : 2.6);
  float dist = -mvPosition.z;
  float size = baseSize * uPixelRatio * (28.0 / max(dist, 4.0) + 0.85);

  float alpha = cat == 10 ? 0.4 : 0.92;

  if (isSelected) {
    float pulse = 0.75 + 0.25 * sin(uTime * 4.0);
    vColor = mix(vColor, vec3(1.0), 0.5) * 2.2 * pulse;
    size = max(size, 9.0 * uPixelRatio);
    alpha = 1.0;
    lit = 1.0;
  } else {
    vColor *= mix(0.15, 1.0, 1.0 - uDimOthers);
    alpha *= mix(1.0, 0.25, uDimOthers);
  }

  vColor *= lit;
  vAlpha = alpha;
  gl_PointSize = size;
}
`;

const SAT_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vSelected;

void main() {
  if (vAlpha <= 0.001) discard;
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float falloff = vSelected > 0.5
    ? smoothstep(1.0, 0.0, d)
    : smoothstep(1.0, 0.55, d);
  if (falloff <= 0.01) discard;
  gl_FragColor = vec4(vColor, vAlpha * falloff);
}
`;

export class SatelliteLayer {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  private geometry: THREE.BufferGeometry;
  private capacity = 0;
  private _count = 0;

  snapshotPositions: Float32Array = new Float32Array(0);
  snapshotVelocities: Float32Array = new Float32Array(0);
  snapshotFlags: Uint8Array = new Uint8Array(0);
  snapshotSimMs = 0;

  constructor(scene: THREE.Scene) {
    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.ShaderMaterial({
      vertexShader: SAT_VERT,
      fragmentShader: SAT_FRAG,
      uniforms: {
        uDtSim: { value: 0 },
        uKmPerUnit: { value: KM_PER_UNIT },
        uFilterMask: { value: (1 << CATEGORIES.length) - 1 },
        uRegimeMask: { value: 15 },
        uSelected: { value: -1 },
        uDimOthers: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  get count(): number {
    return this._count;
  }

  setCatalog(categories: Float32Array, catMasks: Float32Array, regimes: Float32Array): void {
    const n = categories.length;
    this._count = n;
    if (n > this.capacity) {
      this.capacity = Math.ceil(n * 1.2);
      const mk = (itemSize: number) =>
        new THREE.BufferAttribute(new Float32Array(this.capacity * itemSize), itemSize);
      this.geometry.dispose();
      this.geometry = new THREE.BufferGeometry();
      this.geometry.setAttribute('position', mk(3));
      this.geometry.setAttribute('aPos0', mk(3));
      this.geometry.setAttribute('aVel', mk(3));
      this.geometry.setAttribute('aCategory', mk(1));
      this.geometry.setAttribute('aFlags', mk(1));
      this.geometry.setAttribute('aCatMask', mk(1));
      this.geometry.setAttribute('aRegime', mk(1));
      this.points.geometry = this.geometry;
    }
    (this.geometry.getAttribute('aCategory').array as Float32Array).set(categories);
    (this.geometry.getAttribute('aCatMask').array as Float32Array).set(catMasks);
    (this.geometry.getAttribute('aRegime').array as Float32Array).set(regimes);
    this.geometry.getAttribute('aCategory').needsUpdate = true;
    this.geometry.getAttribute('aCatMask').needsUpdate = true;
    this.geometry.getAttribute('aRegime').needsUpdate = true;
    const flags = this.geometry.getAttribute('aFlags').array as Float32Array;
    for (let i = this.snapshotFlags.length; i < n; i++) flags[i] = 1;
    this.geometry.getAttribute('aFlags').needsUpdate = true;
    this.geometry.setDrawRange(0, n);
  }

  applySnapshot(
    simTimeMs: number,
    positions: Float32Array,
    velocities: Float32Array,
    flags: Uint8Array,
  ): void {
    this.snapshotSimMs = simTimeMs;
    this.snapshotPositions = positions;
    this.snapshotVelocities = velocities;
    this.snapshotFlags = flags;

    const n = Math.min(flags.length, this._count);
    (this.geometry.getAttribute('aPos0').array as Float32Array).set(
      positions.subarray(0, n * 3),
    );
    (this.geometry.getAttribute('aVel').array as Float32Array).set(
      velocities.subarray(0, n * 3),
    );
    const f = this.geometry.getAttribute('aFlags').array as Float32Array;
    for (let i = 0; i < n; i++) f[i] = flags[i];
    this.geometry.getAttribute('aPos0').needsUpdate = true;
    this.geometry.getAttribute('aVel').needsUpdate = true;
    this.geometry.getAttribute('aFlags').needsUpdate = true;
  }

  update(
    simNowMs: number,
    sunDirWorld: THREE.Vector3,
    filterMask: number,
    regimeMask: number,
    selectedIndex: number,
    dimOthers: number,
  ): void {
    const u = this.material.uniforms;
    u.uDtSim.value = (simNowMs - this.snapshotSimMs) / 1000;
    u.uFilterMask.value = filterMask;
    u.uRegimeMask.value = regimeMask;
    u.uSelected.value = selectedIndex;
    u.uDimOthers.value = dimOthers;
    u.uTime.value = performance.now() / 1000;
    (u.uSunDir.value as THREE.Vector3).copy(sunDirWorld);
  }
}