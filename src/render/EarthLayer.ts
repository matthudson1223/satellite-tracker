import * as THREE from 'three';
import { EARTH_RADIUS_UNITS } from '../core/frames';

const EARTH_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vUv = uv;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vPosW = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vPosW, 1.0);
}
`;

const EARTH_FRAG = /* glsl */ `
uniform sampler2D uDayTex;
uniform sampler2D uNightTex;
uniform sampler2D uWaterMask;
uniform vec3 uSunDir;
uniform vec3 uCameraPos;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vec3 normal = normalize(vNormalW);
  float sunDot = dot(normal, uSunDir);

  float dayMix = smoothstep(-0.12, 0.12, sunDot);

  vec3 dayColor = texture2D(uDayTex, vUv).rgb;
  dayColor *= 0.25 + 0.85 * clamp(sunDot, 0.0, 1.0);

  vec3 nightLights = texture2D(uNightTex, vUv).rgb;
  vec3 nightColor = nightLights * vec3(1.0, 0.85, 0.6) * 2.2;
  nightColor *= 1.0 - smoothstep(-0.2, 0.0, sunDot) * 0.85;
  nightColor += texture2D(uDayTex, vUv).rgb * vec3(0.04, 0.05, 0.09);

  vec3 color = mix(nightColor, dayColor, dayMix);

  float water = texture2D(uWaterMask, vUv).r;
  vec3 viewDir = normalize(uCameraPos - vPosW);
  vec3 halfVec = normalize(uSunDir + viewDir);
  float spec = pow(max(dot(normal, halfVec), 0.0), 25.0);
  color += vec3(1.0, 0.95, 0.8) * spec * water * dayMix * 0.6;

  float twilight = pow(clamp(1.0 - abs(sunDot) * 4.0, 0.0, 1.0), 3.0);
  color += vec3(0.9, 0.45, 0.2) * twilight * 0.25;

  float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
  color += vec3(0.3, 0.55, 1.0) * fresnel * (0.25 + 0.55 * dayMix);

  gl_FragColor = vec4(color, 1.0);
}
`;

const CLOUDS_FRAG = /* glsl */ `
uniform sampler2D uCloudTex;
uniform vec3 uSunDir;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vec4 cloud = texture2D(uCloudTex, vUv);
  float alpha = cloud.a * max(cloud.r, 0.01);
  float sunDot = dot(normalize(vNormalW), uSunDir);
  float dayMix = smoothstep(-0.12, 0.12, sunDot);
  float lit = 0.25 + 0.85 * clamp(sunDot, 0.0, 1.0);
  vec3 color = vec3(1.0) * lit;
  float twilight = pow(clamp(1.0 - abs(sunDot) * 4.0, 0.0, 1.0), 3.0);
  color += vec3(0.6, 0.25, 0.1) * twilight;
  color = mix(vec3(0.04, 0.05, 0.09), color, dayMix);
  gl_FragColor = vec4(color, alpha * 0.9);
}
`;

const ATMO_VERT = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vPosW = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vPosW, 1.0);
}
`;

const ATMO_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uCameraPos;

varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vec3 normal = normalize(vNormalW);
  vec3 viewDir = normalize(uCameraPos - vPosW);
  float rim = pow(1.0 - abs(dot(viewDir, normal)), 3.5);
  float sunDot = dot(normal, uSunDir);
  float dayMix = smoothstep(-0.25, 0.25, sunDot);
  vec3 dayGlow = vec3(0.3, 0.55, 1.0);
  vec3 duskGlow = vec3(1.0, 0.45, 0.15);
  float twilight = pow(clamp(1.0 - abs(sunDot) * 3.0, 0.0, 1.0), 2.0);
  vec3 color = mix(dayGlow * 0.15, dayGlow, dayMix);
  color = mix(color, duskGlow, twilight * 0.55);
  gl_FragColor = vec4(color * rim, rim);
}
`;

export class EarthLayer {
  readonly globe: THREE.Mesh;
  readonly clouds: THREE.Mesh;
  readonly atmosphere: THREE.Mesh;
  readonly stars: THREE.Mesh;

  private earthMat: THREE.ShaderMaterial;
  private cloudsMat: THREE.ShaderMaterial;
  private atmoMat: THREE.ShaderMaterial;
  private cloudDrift = 0;

  constructor(earthGroup: THREE.Group, scene: THREE.Scene) {
    const loader = new THREE.TextureLoader();
    const tex = (url: string, srgb = true): THREE.Texture => {
      const t = loader.load(url);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      return t;
    };

    const sunDir = new THREE.Vector3(1, 0, 0);

    this.earthMat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VERT,
      fragmentShader: EARTH_FRAG,
      uniforms: {
        uDayTex: { value: tex('/textures/earth-day.jpg') },
        uNightTex: { value: tex('/textures/earth-night.jpg') },
        uWaterMask: { value: tex('/textures/earth-water.png', false) },
        uSunDir: { value: sunDir },
        uCameraPos: { value: new THREE.Vector3() },
      },
    });
    this.globe = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 128, 96),
      this.earthMat,
    );
    earthGroup.add(this.globe);

    this.cloudsMat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VERT,
      fragmentShader: CLOUDS_FRAG,
      uniforms: {
        uCloudTex: { value: tex('/textures/clouds.png') },
        uSunDir: { value: sunDir },
      },
      transparent: true,
      depthWrite: false,
    });
    this.clouds = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.004, 96, 72),
      this.cloudsMat,
    );
    earthGroup.add(this.clouds);

    this.atmoMat = new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      uniforms: {
        uSunDir: { value: sunDir },
        uCameraPos: { value: new THREE.Vector3() },
      },
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS_UNITS * 1.045, 96, 72),
      this.atmoMat,
    );
    scene.add(this.atmosphere);

    const starTex = tex('/textures/milkyway.jpg');
    starTex.mapping = THREE.EquirectangularReflectionMapping;
    this.stars = new THREE.Mesh(
      new THREE.SphereGeometry(350, 48, 32),
      new THREE.MeshBasicMaterial({
        map: starTex,
        side: THREE.BackSide,
        color: new THREE.Color(0.35, 0.35, 0.42),
        depthWrite: false,
      }),
    );
    scene.add(this.stars);
  }

  update(sunDirWorld: THREE.Vector3, cameraPos: THREE.Vector3, dtMs: number): void {
    (this.earthMat.uniforms.uSunDir.value as THREE.Vector3).copy(sunDirWorld);
    (this.earthMat.uniforms.uCameraPos.value as THREE.Vector3).copy(cameraPos);
    (this.cloudsMat.uniforms.uSunDir.value as THREE.Vector3).copy(sunDirWorld);
    (this.atmoMat.uniforms.uSunDir.value as THREE.Vector3).copy(sunDirWorld);
    (this.atmoMat.uniforms.uCameraPos.value as THREE.Vector3).copy(cameraPos);
    this.cloudDrift += dtMs * 0.0000004;
    this.clouds.rotation.y = this.cloudDrift;
  }
}