import * as THREE from 'three';
import { createMemoryPlateTexture } from '../textures';
import { MEMORY_MOMENTS } from '../types';

export interface MemoryVignettesResult {
  group: THREE.Group;
  issModel: THREE.Group;
  telescopeModel: THREE.Group;
  earthSatModel: THREE.Group;
  orbitalArcsGroup: THREE.Group;
  update: (time: number, spacecraftPos: THREE.Vector3, earthPos: THREE.Vector3) => void;
}

export function createMemoryVignettes(
  maxAnisotropy: number,
  solarTex: THREE.CanvasTexture,
  foilBumpTex: THREE.CanvasTexture,
): MemoryVignettesResult {
  const group = new THREE.Group();
  group.name = 'MemoryVignettes';

  // 1. Feathered Optical Documentary Memory Planes (Shot 3)
  const plateMaterials: Array<{
    mat: THREE.ShaderMaterial;
    mesh: THREE.Mesh;
    startTime: number;
    endTime: number;
    side: number;
  }> = [];

  MEMORY_MOMENTS.forEach((m, idx) => {
    const tex = createMemoryPlateTexture(m.kind, maxAnisotropy);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: tex },
        uOpacity: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          vec4 tex = texture2D(uMap, vUv);
          // Smooth elliptical optical feathering so edges melt seamlessly into space
          vec2 centered = (vUv - 0.5) * 2.0;
          float r = length(centered * vec2(0.95, 1.08));
          float mask = smoothstep(1.0, 0.55, r);
          gl_FragColor = vec4(tex.rgb, mask * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 6.47), mat);
    plane.visible = false;
    group.add(plane);

    plateMaterials.push({
      mat,
      mesh: plane,
      startTime: m.startTime,
      endTime: m.endTime,
      side: idx % 2 === 0 ? -1 : 1,
    });
  });

  // 2. Real 3D International Space Station Silhouette (for Shot 3 & Shot 6)
  const issModel = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xd0d8e2,
    roughness: 0.35,
    metalness: 0.78,
  });
  const issSolarMat = new THREE.MeshPhysicalMaterial({
    color: 0x9b6829,
    roughness: 0.25,
    metalness: 0.65,
    clearcoat: 0.5,
  });
  const truss = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.14, 0.14), metalMat);
  issModel.add(truss);
  const habCore = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 3.2, 12), metalMat);
  habCore.rotation.x = Math.PI / 2;
  issModel.add(habCore);
  const crossModule = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.9, 12), metalMat);
  crossModule.rotation.z = Math.PI / 2;
  crossModule.position.z = 0.45;
  issModel.add(crossModule);
  for (const xOff of [-3.4, -2.55, 2.55, 3.4]) {
    for (const yDir of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.68, 2.2, 0.03), issSolarMat);
      wing.position.set(xOff, yDir * 1.25, 0);
      issModel.add(wing);
    }
  }
  issModel.scale.setScalar(0.55);
  issModel.visible = false;
  group.add(issModel);

  // 3. Real 3D Segmented Space Telescope (JWST-inspired, Shot 3 & Shot 6)
  const telescopeModel = new THREE.Group();
  const goldMirrorMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6b43c,
    roughness: 0.14,
    metalness: 0.96,
    clearcoat: 0.8,
  });
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0xb9c3d4,
    roughness: 0.3,
    metalness: 0.85,
  });
  const shield = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.05, 5.2), shieldMat);
  telescopeModel.add(shield);

  const hexGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.06, 6);
  hexGeo.rotateX(Math.PI / 2);
  const mirrorGrid = new THREE.Group();
  mirrorGrid.position.set(0, 1.35, 0.2);
  const hexPositions = [
    [0, 0.46], [0.4, 0.23], [0.4, -0.23], [0, -0.46], [-0.4, -0.23], [-0.4, 0.23],
    [0, 0.92], [0.4, 0.69], [0.8, 0.46], [0.8, 0], [0.8, -0.46], [0.4, -0.69],
    [0, -0.92], [-0.4, -0.69], [-0.8, -0.46], [-0.8, 0], [-0.8, 0.46], [-0.4, 0.69],
  ];
  for (const [hx, hy] of hexPositions) {
    const seg = new THREE.Mesh(hexGeo, goldMirrorMat);
    seg.position.set(hx, hy, 0);
    mirrorGrid.add(seg);
  }
  telescopeModel.add(mirrorGrid);

  const secTripod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.6, 8), shieldMat);
  secTripod.rotation.x = Math.PI / 2;
  secTripod.position.set(0, 1.35, 1.0);
  telescopeModel.add(secTripod);
  telescopeModel.scale.setScalar(0.65);
  telescopeModel.visible = false;
  group.add(telescopeModel);

  // 4. Real 3D Earth-Observation Satellite (Shot 3 & Shot 6)
  const earthSatModel = new THREE.Group();
  const foilMat = new THREE.MeshPhysicalMaterial({
    color: 0xd9a12e,
    roughness: 0.26,
    metalness: 0.9,
    bumpMap: foilBumpTex,
    bumpScale: 0.02,
  });
  const satSolarMat = new THREE.MeshStandardMaterial({
    map: solarTex,
    roughness: 0.25,
    metalness: 0.5,
  });
  const satBus = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.85, 1.25), foilMat);
  earthSatModel.add(satBus);
  const satLens = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.65, 20), metalMat);
  satLens.rotation.x = Math.PI / 2;
  satLens.position.z = 0.85;
  earthSatModel.add(satLens);
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, 0.82), satSolarMat);
    wing.position.x = side * 1.85;
    earthSatModel.add(wing);
  }
  earthSatModel.scale.setScalar(0.8);
  earthSatModel.visible = false;
  group.add(earthSatModel);

  // 5. Delicate Orbital Science & Communication Rings around Earth (Shot 6)
  const orbitalArcsGroup = new THREE.Group();
  const arcConfigs = [
    { r: 41, tiltX: 0.45, tiltZ: 0.2, color: 0x7dd3fc },
    { r: 44, tiltX: -0.6, tiltZ: 0.75, color: 0xfde68a },
    { r: 47, tiltX: 1.1, tiltZ: -0.35, color: 0x93c5fd },
  ];
  const arcMaterials: THREE.LineBasicMaterial[] = [];
  arcConfigs.forEach((cfg) => {
    const pts: THREE.Vector3[] = [];
    const segs = 128;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * cfg.r, 0, Math.sin(a) * cfg.r));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: cfg.color,
      transparent: true,
      opacity: 0,
    });
    arcMaterials.push(mat);
    const ring = new THREE.LineLoop(geo, mat);
    ring.rotation.set(cfg.tiltX, 0, cfg.tiltZ);
    orbitalArcsGroup.add(ring);
  });
  orbitalArcsGroup.visible = false;
  group.add(orbitalArcsGroup);

  const update = (time: number, spacecraftPos: THREE.Vector3, earthPos: THREE.Vector3) => {
    // Shot 3: Documentary Memory Planes floating smoothly along flight corridor
    plateMaterials.forEach((pm) => {
      if (time >= pm.startTime - 0.3 && time <= pm.endTime + 0.3) {
        pm.mesh.visible = true;
        const dur = pm.endTime - pm.startTime;
        const localT = THREE.MathUtils.clamp((time - pm.startTime) / dur, 0, 1);
        const fadeIn = THREE.MathUtils.smoothstep(localT, 0.0, 0.22);
        const fadeOut = 1.0 - THREE.MathUtils.smoothstep(localT, 0.78, 1.0);
        pm.mat.uniforms.uOpacity.value = fadeIn * fadeOut * 0.92;

        // Place memory gracefully off-center ahead of spacecraft so spacecraft stays clearly visible
        pm.mesh.position.set(
          spacecraftPos.x + pm.side * (6.2 - localT * 1.4),
          spacecraftPos.y + 1.15 + Math.sin(localT * Math.PI) * 0.35,
          spacecraftPos.z + 15.5 - localT * 7.5,
        );
        pm.mesh.lookAt(
          spacecraftPos.x + pm.side * 1.2,
          spacecraftPos.y + 1.0,
          spacecraftPos.z - 12,
        );
      } else {
        pm.mesh.visible = false;
      }
    });

    // Real 3D Satellite/Telescope/ISS fly-bys in Shot 6 (112s - 136s)
    if (time >= 112 && time <= 136.5) {
      const s6T = (time - 112) / 24;
      orbitalArcsGroup.visible = true;
      orbitalArcsGroup.position.copy(earthPos);
      orbitalArcsGroup.rotation.y = time * 0.04;
      const arcAlpha =
        THREE.MathUtils.smoothstep(s6T, 0.05, 0.25) *
        (1.0 - THREE.MathUtils.smoothstep(s6T, 0.8, 1.0)) *
        0.26;
      arcMaterials.forEach((m) => (m.opacity = arcAlpha));

      // Earth-Obs Satellite passes gently in foreground orbit (115s - 124s)
      if (time >= 115 && time <= 125) {
        const p = (time - 115) / 10;
        earthSatModel.visible = true;
        earthSatModel.position.set(
          spacecraftPos.x - 5.5 + p * 11.0,
          spacecraftPos.y + 2.2 - p * 1.1,
          spacecraftPos.z + 6.5 - p * 3.0,
        );
        earthSatModel.lookAt(earthPos);
      } else {
        earthSatModel.visible = false;
      }

      // Space Telescope silhouette (122s - 131s)
      if (time >= 122 && time <= 131) {
        const p = (time - 122) / 9;
        telescopeModel.visible = true;
        telescopeModel.position.set(
          spacecraftPos.x + 6.0 - p * 9.5,
          spacecraftPos.y - 1.6 + p * 1.4,
          spacecraftPos.z + 7.0 - p * 2.5,
        );
        telescopeModel.rotation.y = p * 0.6 - 0.5;
        telescopeModel.rotation.x = 0.25;
      } else {
        telescopeModel.visible = false;
      }

      // ISS passes smoothly (128s - 136s)
      if (time >= 128 && time <= 136.2) {
        const p = (time - 128) / 8.2;
        issModel.visible = true;
        issModel.position.set(
          spacecraftPos.x - 6.5 + p * 12.5,
          spacecraftPos.y + 1.8,
          spacecraftPos.z + 7.5,
        );
        issModel.rotation.set(0.2, 0.4 + p * 0.3, -0.15);
      } else {
        issModel.visible = false;
      }
    } else {
      orbitalArcsGroup.visible = false;
      earthSatModel.visible = false;
      telescopeModel.visible = false;
      issModel.visible = false;
    }
  };

  return { group, issModel, telescopeModel, earthSatModel, orbitalArcsGroup, update };
}
