import * as THREE from 'three';
import { WORLD_CONSTANTS } from './types';
import { MoonTextureBundle } from './textures';

export class MoonSystem {
  public readonly mesh: THREE.Mesh;
  private geometry: THREE.SphereGeometry;
  private material: THREE.MeshStandardMaterial;

  constructor(textures: MoonTextureBundle) {
    this.geometry = new THREE.SphereGeometry(WORLD_CONSTANTS.MOON_RADIUS, 96, 64);
    this.material = new THREE.MeshStandardMaterial({
      map: textures.albedoMap,
      bumpMap: textures.bumpMap,
      bumpScale: 14,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.05,
      fog: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.position.copy(WORLD_CONSTANTS.MOON_CENTER);
    // Orient major maria & rayed craters toward the approaching camera
    this.mesh.rotation.set(0.18, -0.75, 0.08);
  }

  public update(elapsedTime: number): void {
    // Imperceptibly slow natural lunar libration/rotation
    this.mesh.rotation.y = -0.75 + elapsedTime * 0.0018;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
