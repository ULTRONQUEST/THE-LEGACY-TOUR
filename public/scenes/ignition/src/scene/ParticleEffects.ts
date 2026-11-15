import * as THREE from 'three';
import { SpriteAndSurfaceTextures } from './textures';

interface PadSmokeSeed {
  angle: number;
  speed: number;
  lift: number;
  phase: number;
  baseScale: number;
  swirl: number;
}

const _warmSmoke = new THREE.Color('#ffcf99');
const _coolSmoke = new THREE.Color('#dce2ea');
const _tempColor = new THREE.Color();

export class ParticleEffects {
  public readonly group = new THREE.Group();

  private padSmokeSprites: THREE.Sprite[] = [];
  private padSmokeSeeds: PadSmokeSeed[] = [];

  private ventSprites: THREE.Sprite[] = [];
  private trailSprites: THREE.Sprite[] = [];
  private skyClouds: THREE.Sprite[] = [];

  private exhaustGlowSprite: THREE.Sprite;
  private exhaustLight: THREE.PointLight;

  private materials: THREE.Material[] = [];

  constructor(textures: SpriteAndSurfaceTextures) {
    // 1. Billowing Launchpad Smoke & Steam Deluge Plume (Shots 3-4)
    const padSmokeCount = 140;
    for (let i = 0; i < padSmokeCount; i++) {
      const mat = new THREE.SpriteMaterial({
        map: textures.smokeTexture,
        color: '#e6ecf2',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      this.materials.push(mat);
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      this.group.add(sp);
      this.padSmokeSprites.push(sp);

      const h1 = Math.sin(i * 12.9898) * 43758.5453;
      const h2 = Math.sin(i * 78.233 + 1.5) * 43758.5453;
      const h3 = Math.sin(i * 39.123 + 4.2) * 43758.5453;
      const r1 = h1 - Math.floor(h1);
      const r2 = h2 - Math.floor(h2);
      const r3 = h3 - Math.floor(h3);

      this.padSmokeSeeds.push({
        angle: r1 * Math.PI * 2,
        speed: 14 + r2 * 44,
        lift: 5 + r3 * 24,
        phase: (i / padSmokeCount) * 3.8,
        baseScale: 14 + r2 * 24,
        swirl: (r3 - 0.5) * 0.6,
      });
    }

    // 2. Cryogenic LOX Venting Wisps (Shots 1-3)
    const ventCount = 22;
    for (let i = 0; i < ventCount; i++) {
      const mat = new THREE.SpriteMaterial({
        map: textures.smokeTexture,
        color: '#f8fafc',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      this.materials.push(mat);
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      this.group.add(sp);
      this.ventSprites.push(sp);
    }

    // 3. Ascending Exhaust Smoke Trail (Shots 4-5)
    const trailCount = 48;
    for (let i = 0; i < trailCount; i++) {
      const mat = new THREE.SpriteMaterial({
        map: textures.smokeTexture,
        color: '#f2ede4',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      this.materials.push(mat);
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      this.group.add(sp);
      this.trailSprites.push(sp);
    }

    // 4. High-altitude Atmospheric Cloud Deck (Shots 1-5)
    const cloudCount = 56;
    for (let i = 0; i < cloudCount; i++) {
      const mat = new THREE.SpriteMaterial({
        map: textures.smokeTexture,
        color: '#f6f9ff',
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      this.materials.push(mat);
      const sp = new THREE.Sprite(mat);
      const ang = (i / cloudCount) * Math.PI * 2 + (i % 5) * 0.4;
      const dist = 340 + (i % 7) * 230;
      const alt = 220 + (i % 4) * 52;
      sp.position.set(Math.cos(ang) * dist, alt, Math.sin(ang) * dist - 260);
      sp.scale.set(220 + (i % 3) * 90, 85 + (i % 3) * 35, 1);
      this.group.add(sp);
      this.skyClouds.push(sp);
    }

    // 5. Intense Radial Exhaust Bloom + Ground Illumination PointLight
    const glowMat = new THREE.SpriteMaterial({
      map: textures.glowTexture,
      color: '#ffdf9e',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.materials.push(glowMat);
    this.exhaustGlowSprite = new THREE.Sprite(glowMat);
    this.exhaustGlowSprite.visible = false;
    this.group.add(this.exhaustGlowSprite);

    this.exhaustLight = new THREE.PointLight('#ffaa44', 0, 260, 1.5);
    this.exhaustLight.position.set(0, 2, 0);
    this.group.add(this.exhaustLight);
  }

  public update(
    elapsedTime: number,
    ignitionIntensity: number,
    ventIntensity: number,
    rocketPos: THREE.Vector3,
    rocketForwardUp: THREE.Vector3,
    padVisibility: number,
    cloudDeckOpacity: number
  ): void {
    // 1. Cryogenic LOX venting wisps around upper stage & pad
    const showVent = ventIntensity > 0.02 && padVisibility > 0.05;
    for (let i = 0; i < this.ventSprites.length; i++) {
      const sp = this.ventSprites[i];
      if (!showVent) {
        sp.visible = false;
        continue;
      }
      const cycle = ((elapsedTime * 0.45 + i / this.ventSprites.length) % 1);
      const originY = i % 2 === 0 ? 78 : 54;
      sp.visible = true;
      sp.position.set(
        rocketPos.x + 3.2 + cycle * 15,
        rocketPos.y + originY + cycle * 6 + Math.sin(elapsedTime + i) * 0.8,
        rocketPos.z + Math.cos(i * 1.7) * (1.2 + cycle * 3.5)
      );
      const s = 2.8 + cycle * 9.5;
      sp.scale.set(s, s * 0.72, 1);
      (sp.material as THREE.SpriteMaterial).opacity =
        Math.sin(cycle * Math.PI) * 0.36 * ventIntensity * padVisibility;
    }

    // 2. Launchpad Deluge & Smoke Billow (deterministic cycle so scrubbing always renders accurately)
    const showPadSmoke = ignitionIntensity > 0.02 && padVisibility > 0.02;
    for (let i = 0; i < this.padSmokeSprites.length; i++) {
      const sp = this.padSmokeSprites[i];
      if (!showPadSmoke) {
        sp.visible = false;
        continue;
      }
      const seed = this.padSmokeSeeds[i];
      const cycleLen = 3.8;
      const age = ((elapsedTime + seed.phase) % cycleLen) / cycleLen;
      const radialDist = 4 + Math.pow(age, 0.78) * seed.speed * (0.45 + ignitionIntensity * 0.75);
      const ang = seed.angle + age * seed.swirl;

      sp.visible = true;
      sp.position.set(
        Math.cos(ang) * radialDist,
        -7.5 + Math.pow(age, 0.9) * seed.lift * (0.6 + ignitionIntensity * 0.6),
        Math.sin(ang) * radialDist
      );

      const scale = seed.baseScale * (0.45 + age * 2.15) * (0.55 + 0.45 * ignitionIntensity);
      sp.scale.set(scale, scale * 0.82, 1);

      const fade = Math.sin(age * Math.PI);
      const mat = sp.material as THREE.SpriteMaterial;
      mat.opacity = Math.min(0.72, fade * 0.65 * ignitionIntensity * padVisibility);

      // Warm engine glow near the flame trench fading to sunlit grey steam outward
      const warmMix = Math.max(0, 1 - age * 2.1) * ignitionIntensity;
      _tempColor.copy(_coolSmoke).lerp(_warmSmoke, warmMix);
      mat.color.copy(_tempColor);
    }

    // 3. Ascending Exhaust Plume Trail behind rocket
    const climbing = rocketPos.y > 4 && ignitionIntensity > 0.1 && padVisibility > 0.01;
    for (let i = 0; i < this.trailSprites.length; i++) {
      const sp = this.trailSprites[i];
      if (!climbing) {
        sp.visible = false;
        continue;
      }
      const lag = i / this.trailSprites.length;
      const trailDist = 10 + lag * Math.min(260, rocketPos.y * 0.85 + 25);
      sp.visible = true;
      sp.position.set(
        rocketPos.x - rocketForwardUp.x * trailDist + Math.sin(i * 2.3 + elapsedTime * 2) * (lag * 9),
        Math.max(-6, rocketPos.y - rocketForwardUp.y * trailDist),
        rocketPos.z - rocketForwardUp.z * trailDist + Math.cos(i * 1.9 + elapsedTime * 2) * (lag * 9)
      );
      const s = (9 + lag * 44) * Math.min(1.3, 0.6 + ignitionIntensity * 0.6);
      sp.scale.set(s, s, 1);
      const mat = sp.material as THREE.SpriteMaterial;
      mat.opacity = (1 - lag) * 0.55 * ignitionIntensity * padVisibility;
      _tempColor.copy(_coolSmoke).lerp(_warmSmoke, Math.max(0, 1 - lag * 4.5));
      mat.color.copy(_tempColor);
    }

    // 4. Exhaust Bloom Sprite & Pad Point Light
    const glowActive = ignitionIntensity > 0.02 && rocketPos.y < 1400;
    this.exhaustGlowSprite.visible = glowActive;
    if (glowActive) {
      const flicker = 0.92 + 0.08 * Math.sin(elapsedTime * 48);
      this.exhaustGlowSprite.position.set(
        rocketPos.x - rocketForwardUp.x * 8,
        rocketPos.y - rocketForwardUp.y * 8,
        rocketPos.z - rocketForwardUp.z * 8
      );
      const gs = (26 + ignitionIntensity * 28) * flicker;
      this.exhaustGlowSprite.scale.set(gs, gs * 1.35, 1);
      (this.exhaustGlowSprite.material as THREE.SpriteMaterial).opacity =
        Math.min(0.95, ignitionIntensity * 0.88);

      this.exhaustLight.position.set(
        rocketPos.x,
        Math.max(2, rocketPos.y - 4),
        rocketPos.z
      );
      this.exhaustLight.intensity = ignitionIntensity * 8500 * flicker * padVisibility;
    } else {
      this.exhaustLight.intensity = 0;
    }

    // 5. High-altitude clouds
    for (let i = 0; i < this.skyClouds.length; i++) {
      const cloud = this.skyClouds[i];
      cloud.visible = cloudDeckOpacity > 0.01;
      (cloud.material as THREE.SpriteMaterial).opacity = 0.5 * cloudDeckOpacity;
    }
  }

  public dispose(): void {
    this.materials.forEach((m) => m.dispose());
  }
}
