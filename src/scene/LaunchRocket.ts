import * as THREE from 'three';
import { SpriteAndSurfaceTextures } from './textures';

export class LaunchRocket {
  public readonly root = new THREE.Group();
  public readonly stage1Group = new THREE.Group();
  public readonly upperStageGroup = new THREE.Group();

  private f1GlowMats: THREE.MeshBasicMaterial[] = [];
  private j2GlowMats: THREE.MeshBasicMaterial[] = [];
  private f1PlumeGroup = new THREE.Group();
  private j2PlumeGroup = new THREE.Group();
  private f1PlumeMeshes: THREE.Mesh[] = [];
  private j2PlumeMeshes: THREE.Mesh[] = [];
  private contactShadow: THREE.Mesh;

  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  constructor(textures: SpriteAndSurfaceTextures) {
    const whitePaint = new THREE.MeshStandardMaterial({
      map: textures.rocketHullTexture,
      roughness: 0.42,
      metalness: 0.08,
    });
    const whiteClean = new THREE.MeshStandardMaterial({
      color: '#f1f4f8',
      roughness: 0.4,
      metalness: 0.1,
    });
    const blackComposite = new THREE.MeshStandardMaterial({
      color: '#171a21',
      roughness: 0.34,
      metalness: 0.25,
    });
    const metalAlloy = new THREE.MeshStandardMaterial({
      color: '#9aa3b2',
      roughness: 0.26,
      metalness: 0.86,
    });
    const darkNozzle = new THREE.MeshStandardMaterial({
      color: '#343a44',
      roughness: 0.32,
      metalness: 0.82,
    });
    this.materials.push(whitePaint, whiteClean, blackComposite, metalAlloy, darkNozzle);

    // =========================================================================
    // STAGE 1: S-IC (y = 0 at engine tips up to y = 46)
    // =========================================================================
    // Main S-IC cylindrical body (y = 7 to 44)
    const s1Geo = new THREE.CylinderGeometry(5.0, 5.0, 37, 48);
    this.geometries.push(s1Geo);
    const s1Mesh = new THREE.Mesh(s1Geo, whitePaint);
    s1Mesh.position.y = 25.5;
    s1Mesh.castShadow = true;
    s1Mesh.receiveShadow = true;
    this.stage1Group.add(s1Mesh);

    // Thrust skirt ring
    const skirtGeo = new THREE.CylinderGeometry(5.05, 5.25, 3.2, 48);
    this.geometries.push(skirtGeo);
    const skirt = new THREE.Mesh(skirtGeo, blackComposite);
    skirt.position.y = 6.2;
    skirt.castShadow = true;
    this.stage1Group.add(skirt);

    // 4 Aerodynamic Engine Fairings + Stabilizing Fins
    const fairingGeo = new THREE.CylinderGeometry(0.45, 1.45, 9.5, 16);
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(3.8, 0);
    finShape.lineTo(2.4, 5.2);
    finShape.lineTo(0, 7.2);
    finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 2,
    });
    finGeo.translate(0, 0, -0.14);
    this.geometries.push(fairingGeo, finGeo);

    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + Math.PI / 4;
      const podGroup = new THREE.Group();
      podGroup.rotation.y = ang;

      const fairing = new THREE.Mesh(fairingGeo, whiteClean);
      fairing.position.set(5.1, 8.8, 0);
      fairing.castShadow = true;
      podGroup.add(fairing);

      const fin = new THREE.Mesh(finGeo, blackComposite);
      fin.position.set(5.2, 4.6, 0);
      fin.castShadow = true;
      podGroup.add(fin);

      this.stage1Group.add(podGroup);
    }

    // External LOX cable/propellant tunnels running vertically
    const tunnelGeo = new THREE.BoxGeometry(0.45, 34, 0.55);
    this.geometries.push(tunnelGeo);
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      const tunnel = new THREE.Mesh(tunnelGeo, whiteClean);
      tunnel.position.set(Math.cos(ang) * 5.05, 25, Math.sin(ang) * 5.05);
      tunnel.rotation.y = -ang;
      this.stage1Group.add(tunnel);
    }

    // 5 F-1 Engine Bells (LatheGeometry parabolic nozzles, bottom-to-top for outward normals)
    const f1Pts = [
      new THREE.Vector2(1.85, 0.0),
      new THREE.Vector2(1.62, 1.5),
      new THREE.Vector2(1.25, 3.3),
      new THREE.Vector2(0.95, 4.5),
      new THREE.Vector2(0.0, 4.8),
    ];
    const f1BellGeo = new THREE.LatheGeometry(f1Pts, 28);
    const f1CoreGeo = new THREE.CircleGeometry(1.45, 24);
    f1CoreGeo.rotateX(Math.PI / 2);
    this.geometries.push(f1BellGeo, f1CoreGeo);

    const f1Offsets: Array<[number, number]> = [
      [0, 0],
      [3.1, 3.1],
      [-3.1, 3.1],
      [3.1, -3.1],
      [-3.1, -3.1],
    ];

    for (const [ox, oz] of f1Offsets) {
      const bell = new THREE.Mesh(f1BellGeo, darkNozzle);
      bell.position.set(ox, 0, oz);
      bell.castShadow = true;
      this.stage1Group.add(bell);

      const throatMat = new THREE.MeshBasicMaterial({
        color: '#ffcf70',
        transparent: true,
        opacity: 0,
      });
      this.materials.push(throatMat);
      this.f1GlowMats.push(throatMat);

      const throat = new THREE.Mesh(f1CoreGeo, throatMat);
      throat.position.set(ox, 0.35, oz);
      this.stage1Group.add(throat);
    }

    // Volumetric F-1 exhaust plume cones attached to stage 1
    const plumeConeGeo = new THREE.ConeGeometry(2.5, 34, 24, 1, true);
    plumeConeGeo.translate(0, -17, 0);
    this.geometries.push(plumeConeGeo);

    for (const [ox, oz] of f1Offsets) {
      const pMat = new THREE.MeshBasicMaterial({
        color: '#ffe8a8',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.materials.push(pMat);
      const cone = new THREE.Mesh(plumeConeGeo, pMat);
      cone.position.set(ox, 0.2, oz);
      this.f1PlumeGroup.add(cone);
      this.f1PlumeMeshes.push(cone);
    }
    this.stage1Group.add(this.f1PlumeGroup);

    // S-IC / S-II Interstage Ring (y = 44 to 49)
    const interstageGeo = new THREE.CylinderGeometry(5.0, 5.0, 5.2, 48);
    this.geometries.push(interstageGeo);
    const interstage = new THREE.Mesh(interstageGeo, blackComposite);
    interstage.position.y = 46.6;
    interstage.castShadow = true;
    this.stage1Group.add(interstage);

    this.root.add(this.stage1Group);

    // =========================================================================
    // UPPER STAGES: S-II + S-IVB + SLA + CSM + LES (y = 49 to 110)
    // =========================================================================
    // 5 J-2 Engine Bells tucked cleanly inside interstage until separation
    const j2Pts = [
      new THREE.Vector2(1.12, 0.0),
      new THREE.Vector2(0.95, 0.8),
      new THREE.Vector2(0.6, 1.9),
      new THREE.Vector2(0.0, 2.2),
    ];
    const j2Geo = new THREE.LatheGeometry(j2Pts, 20);
    const j2CoreGeo = new THREE.CircleGeometry(0.9, 16);
    j2CoreGeo.rotateX(Math.PI / 2);
    this.geometries.push(j2Geo, j2CoreGeo);

    const j2Offsets: Array<[number, number]> = [
      [0, 0],
      [2.5, 0],
      [-2.5, 0],
      [0, 2.5],
      [0, -2.5],
    ];
    for (const [ox, oz] of j2Offsets) {
      const bell = new THREE.Mesh(j2Geo, metalAlloy);
      bell.position.set(ox, 46.4, oz);
      this.upperStageGroup.add(bell);

      const tMat = new THREE.MeshBasicMaterial({
        color: '#b8dcff',
        transparent: true,
        opacity: 0,
      });
      this.materials.push(tMat);
      this.j2GlowMats.push(tMat);
      const throat = new THREE.Mesh(j2CoreGeo, tMat);
      throat.position.set(ox, 46.6, oz);
      this.upperStageGroup.add(throat);

      const jpMat = new THREE.MeshBasicMaterial({
        color: '#cbe3ff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.materials.push(jpMat);
      const jCone = new THREE.Mesh(plumeConeGeo, jpMat);
      jCone.position.set(ox, 46.5, oz);
      jCone.scale.set(0.65, 0.75, 0.65);
      this.j2PlumeGroup.add(jCone);
      this.j2PlumeMeshes.push(jCone);
    }
    this.upperStageGroup.add(this.j2PlumeGroup);

    // S-II Stage 2 Body (y = 49.2 to 71.2)
    const s2Geo = new THREE.CylinderGeometry(5.0, 5.0, 22, 48);
    this.geometries.push(s2Geo);
    const s2Mesh = new THREE.Mesh(s2Geo, whiteClean);
    s2Mesh.position.y = 60.2;
    s2Mesh.castShadow = true;
    this.upperStageGroup.add(s2Mesh);

    const s2BandGeo = new THREE.CylinderGeometry(5.02, 5.02, 2.2, 48);
    this.geometries.push(s2BandGeo);
    const s2Band = new THREE.Mesh(s2BandGeo, blackComposite);
    s2Band.position.y = 70.1;
    this.upperStageGroup.add(s2Band);

    // S-II / S-IVB Tapered Interstage Frustum (y = 71.2 to 76.2)
    const frustum1Geo = new THREE.CylinderGeometry(3.3, 5.0, 5.0, 48);
    this.geometries.push(frustum1Geo);
    const frustum1 = new THREE.Mesh(frustum1Geo, blackComposite);
    frustum1.position.y = 73.7;
    frustum1.castShadow = true;
    this.upperStageGroup.add(frustum1);

    // S-IVB Third Stage (y = 76.2 to 89.2)
    const s3Geo = new THREE.CylinderGeometry(3.3, 3.3, 13.0, 40);
    const s3BandGeo = new THREE.CylinderGeometry(3.32, 3.32, 2.0, 40);
    this.geometries.push(s3Geo, s3BandGeo);

    const s3Mesh = new THREE.Mesh(s3Geo, whiteClean);
    s3Mesh.position.y = 82.7;
    s3Mesh.castShadow = true;
    this.upperStageGroup.add(s3Mesh);

    const s3Band = new THREE.Mesh(s3BandGeo, blackComposite);
    s3Band.position.y = 87.2;
    this.upperStageGroup.add(s3Band);

    // SLA Adapter Conical Shroud (y = 89.2 to 95.8)
    const slaGeo = new THREE.CylinderGeometry(1.98, 3.3, 6.6, 36);
    this.geometries.push(slaGeo);
    const sla = new THREE.Mesh(slaGeo, whiteClean);
    sla.position.y = 92.5;
    sla.castShadow = true;
    this.upperStageGroup.add(sla);

    // Metallic Service Module (y = 95.8 to 100.2)
    const smGeo = new THREE.CylinderGeometry(1.96, 1.96, 4.4, 32);
    this.geometries.push(smGeo);
    const sm = new THREE.Mesh(smGeo, metalAlloy);
    sm.position.y = 98.0;
    sm.castShadow = true;
    this.upperStageGroup.add(sm);

    // Command Module Cone (y = 100.2 to 103.0)
    const cmGeo = new THREE.CylinderGeometry(0.65, 1.96, 2.8, 32);
    this.geometries.push(cmGeo);
    const cm = new THREE.Mesh(cmGeo, metalAlloy);
    cm.position.y = 101.6;
    cm.castShadow = true;
    this.upperStageGroup.add(cm);

    // Launch Escape System (LES) Tower & Needle Spire (y = 103.0 to 111.5)
    const lesStrutGeo = new THREE.CylinderGeometry(0.08, 0.08, 4.2, 8);
    const lesMotorGeo = new THREE.CylinderGeometry(0.32, 0.42, 4.2, 16);
    const lesTipGeo = new THREE.ConeGeometry(0.32, 1.8, 16);
    this.geometries.push(lesStrutGeo, lesMotorGeo, lesTipGeo);

    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      const strut = new THREE.Mesh(lesStrutGeo, whiteClean);
      strut.position.set(Math.cos(ang) * 0.52, 104.5, Math.sin(ang) * 0.52);
      strut.rotation.z = Math.cos(ang) * 0.14;
      strut.rotation.x = -Math.sin(ang) * 0.14;
      this.upperStageGroup.add(strut);
    }

    const lesMotor = new THREE.Mesh(lesMotorGeo, whiteClean);
    lesMotor.position.y = 108.4;
    this.upperStageGroup.add(lesMotor);

    const lesTip = new THREE.Mesh(lesTipGeo, whiteClean);
    lesTip.position.y = 111.4;
    this.upperStageGroup.add(lesTip);

    this.root.add(this.upperStageGroup);

    // Soft radial contact shadow under the launchpad stand
    const shadowGeo = new THREE.PlaneGeometry(24, 24);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: textures.contactShadowTexture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.geometries.push(shadowGeo);
    this.materials.push(shadowMat);
    this.contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadow.position.y = 0.04;
    this.root.add(this.contactShadow);
  }

  public updateThrustVisuals(
    elapsedTime: number,
    f1Intensity: number,
    j2Intensity: number,
    altitudeFactor: number
  ): void {
    const flicker = 0.92 + 0.08 * Math.sin(elapsedTime * 55) * Math.cos(elapsedTime * 37);

    for (const mat of this.f1GlowMats) {
      mat.opacity = Math.min(1, f1Intensity * 1.15);
    }

    const f1Active = f1Intensity > 0.02;
    this.f1PlumeGroup.visible = f1Active;
    if (f1Active) {
      const widthScale = (0.75 + 0.5 * f1Intensity + altitudeFactor * 1.1) * flicker;
      const lenScale = (0.65 + 0.85 * f1Intensity + altitudeFactor * 0.65) * flicker;
      for (const cone of this.f1PlumeMeshes) {
        cone.scale.set(widthScale, lenScale, widthScale);
        (cone.material as THREE.MeshBasicMaterial).opacity = Math.min(0.85, f1Intensity * 0.78);
      }
    }

    for (const mat of this.j2GlowMats) {
      mat.opacity = Math.min(1, j2Intensity * 1.1);
    }

    const j2Active = j2Intensity > 0.02;
    this.j2PlumeGroup.visible = j2Active;
    if (j2Active) {
      const widthScale = (1.1 + j2Intensity * 0.9) * flicker;
      const lenScale = (1.0 + j2Intensity * 1.1) * flicker;
      for (const cone of this.j2PlumeMeshes) {
        cone.scale.set(widthScale, lenScale, widthScale);
        (cone.material as THREE.MeshBasicMaterial).opacity = Math.min(0.75, j2Intensity * 0.65);
      }
    }

    // Contact shadow fades smoothly as rocket lifts off the MLP
    const liftFade = Math.max(0, 1 - this.root.position.y / 25);
    (this.contactShadow.material as THREE.MeshBasicMaterial).opacity = 0.55 * liftFade;
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
