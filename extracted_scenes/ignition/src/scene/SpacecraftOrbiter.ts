import * as THREE from 'three';
import { SpriteAndSurfaceTextures } from './textures';

/**
 * Sleek delta-wing Orbital & Trans-Lunar Spacecraft Orbiter inspired by Image 2
 * (Space Shuttle Atlantis silhouette). Used strictly in orbital & deep-space shots (6-9),
 * never hybridized onto the heavy launch booster.
 */
export class SpacecraftOrbiter {
  public readonly root = new THREE.Group();
  private thrusterPlumes: THREE.Mesh[] = [];
  private thrusterGlows: THREE.Sprite[] = [];
  private rcsPuffs: THREE.Sprite[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  constructor(textures: SpriteAndSurfaceTextures) {
    const whiteTile = new THREE.MeshStandardMaterial({
      color: '#f3f5f8',
      roughness: 0.45,
      metalness: 0.08,
    });
    const blackTile = new THREE.MeshStandardMaterial({
      map: textures.shuttleTileTexture,
      roughness: 0.86,
      metalness: 0.12,
    });
    const carbonLeadingEdge = new THREE.MeshStandardMaterial({
      color: '#22262e',
      roughness: 0.65,
      metalness: 0.25,
    });
    const cockpitGlass = new THREE.MeshPhysicalMaterial({
      color: '#0a1424',
      roughness: 0.06,
      metalness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      reflectivity: 0.95,
    });
    const engineNozzle = new THREE.MeshStandardMaterial({
      color: '#464e5c',
      roughness: 0.28,
      metalness: 0.88,
    });
    const badgeAccent = new THREE.MeshStandardMaterial({
      color: '#1d4ed8',
      roughness: 0.4,
      metalness: 0.2,
    });
    this.materials.push(
      whiteTile,
      blackTile,
      carbonLeadingEdge,
      cockpitGlass,
      engineNozzle,
      badgeAccent
    );

    // Orient orbiter nose pointing along -Z (forward flight direction), dorsal +Y up
    const bodyGroup = new THREE.Group();

    // 1. Main cylindrical/blended dorsal fuselage
    const fuselageGeo = new THREE.CylinderGeometry(1.75, 1.95, 11.5, 24);
    fuselageGeo.rotateX(Math.PI / 2);
    fuselageGeo.scale(1.05, 0.88, 1.0);
    this.geometries.push(fuselageGeo);
    const fuselage = new THREE.Mesh(fuselageGeo, whiteTile);
    fuselage.position.set(0, 0.25, 0.2);
    bodyGroup.add(fuselage);

    // 2. Forward Nose & Crew Cabin Taper (ordered bottom-to-top for outward normals)
    const nosePts = [
      new THREE.Vector2(1.75, 0.0),
      new THREE.Vector2(1.45, 1.8),
      new THREE.Vector2(0.95, 3.2),
      new THREE.Vector2(0.45, 4.15),
      new THREE.Vector2(0.0, 4.4),
    ];
    const noseGeo = new THREE.LatheGeometry(nosePts, 24);
    noseGeo.rotateX(-Math.PI / 2);
    noseGeo.scale(1.02, 0.85, 1.0);
    this.geometries.push(noseGeo);
    const nose = new THREE.Mesh(noseGeo, whiteTile);
    nose.position.set(0, 0.2, -5.55);
    bodyGroup.add(nose);

    // Black Reinforced Carbon-Carbon Nose Cap
    const noseCapPts = [
      new THREE.Vector2(0.68, 0.0),
      new THREE.Vector2(0.45, 0.8),
      new THREE.Vector2(0.0, 1.05),
    ];
    const noseCapGeo = new THREE.LatheGeometry(noseCapPts, 20);
    noseCapGeo.rotateX(-Math.PI / 2);
    noseCapGeo.scale(1.02, 0.85, 1.0);
    this.geometries.push(noseCapGeo);
    const noseCap = new THREE.Mesh(noseCapGeo, carbonLeadingEdge);
    noseCap.position.set(0, 0.2, -8.92);
    bodyGroup.add(noseCap);

    // 3. Recessed Cockpit Windshield Windows
    const windowGeo = new THREE.BoxGeometry(1.5, 0.42, 0.9);
    this.geometries.push(windowGeo);
    const cockpitWin = new THREE.Mesh(windowGeo, cockpitGlass);
    cockpitWin.position.set(0, 1.08, -6.5);
    cockpitWin.rotation.x = 0.42;
    bodyGroup.add(cockpitWin);

    // 4. Double-Delta Swept Wings (separate symmetric shapes to preserve outward winding)
    const rightWingShape = new THREE.Shape();
    rightWingShape.moveTo(1.3, -4.6);
    rightWingShape.lineTo(2.4, -2.1);
    rightWingShape.lineTo(6.6, 4.1);
    rightWingShape.lineTo(6.6, 5.4);
    rightWingShape.lineTo(1.3, 5.5);
    rightWingShape.closePath();

    const leftWingShape = new THREE.Shape();
    leftWingShape.moveTo(-1.3, -4.6);
    leftWingShape.lineTo(-1.3, 5.5);
    leftWingShape.lineTo(-6.6, 5.4);
    leftWingShape.lineTo(-6.6, 4.1);
    leftWingShape.lineTo(-2.4, -2.1);
    leftWingShape.closePath();

    const wingExtrudeOpts = {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.14,
      bevelSegments: 2,
    };
    const rightWingGeo = new THREE.ExtrudeGeometry(rightWingShape, wingExtrudeOpts);
    rightWingGeo.rotateX(Math.PI / 2);
    const leftWingGeo = new THREE.ExtrudeGeometry(leftWingShape, wingExtrudeOpts);
    leftWingGeo.rotateX(Math.PI / 2);
    this.geometries.push(rightWingGeo, leftWingGeo);

    const rightWing = new THREE.Mesh(rightWingGeo, whiteTile);
    rightWing.position.set(0, -0.35, 0.6);
    bodyGroup.add(rightWing);

    const leftWing = new THREE.Mesh(leftWingGeo, whiteTile);
    leftWing.position.set(0, -0.35, 0.6);
    bodyGroup.add(leftWing);

    // Wing black carbon leading edges & thermal belly plate
    const bellyShape = new THREE.Shape();
    bellyShape.moveTo(0, -9.2);
    bellyShape.lineTo(1.4, -4.5);
    bellyShape.lineTo(6.7, 4.15);
    bellyShape.lineTo(6.7, 5.48);
    bellyShape.lineTo(-6.7, 5.48);
    bellyShape.lineTo(-6.7, 4.15);
    bellyShape.lineTo(-1.4, -4.5);
    bellyShape.closePath();

    const bellyGeo = new THREE.ExtrudeGeometry(bellyShape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.08,
      bevelSegments: 1,
    });
    bellyGeo.rotateX(Math.PI / 2);
    this.geometries.push(bellyGeo);
    const bellyPlate = new THREE.Mesh(bellyGeo, blackTile);
    bellyPlate.position.set(0, -0.72, 0.6);
    bodyGroup.add(bellyPlate);

    // Subtle blue insignia markings on wings
    const markGeo = new THREE.PlaneGeometry(0.95, 0.95);
    markGeo.rotateX(-Math.PI / 2);
    this.geometries.push(markGeo);
    const markL = new THREE.Mesh(markGeo, badgeAccent);
    markL.position.set(-4.1, -0.21, 4.2);
    bodyGroup.add(markL);
    const markR = new THREE.Mesh(markGeo, badgeAccent);
    markR.position.set(4.1, -0.21, 4.2);
    bodyGroup.add(markR);

    // 5. Vertical Stabilizer Tail Fin
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0);
    tailShape.lineTo(3.4, 0);
    tailShape.lineTo(4.2, 4.4);
    tailShape.lineTo(2.7, 4.4);
    tailShape.closePath();

    const tailGeo = new THREE.ExtrudeGeometry(tailShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 2,
    });
    tailGeo.rotateY(-Math.PI / 2);
    tailGeo.translate(0.14, 0, 0);
    this.geometries.push(tailGeo);
    const tailFin = new THREE.Mesh(tailGeo, whiteTile);
    tailFin.position.set(0, 1.15, 3.0);
    bodyGroup.add(tailFin);

    // 6. Twin OMS (Orbital Maneuvering System) Pods flanking the tail
    const omsGeo = new THREE.CapsuleGeometry(0.62, 2.5, 8, 16);
    omsGeo.rotateX(Math.PI / 2);
    this.geometries.push(omsGeo);

    const omsLeft = new THREE.Mesh(omsGeo, whiteTile);
    omsLeft.position.set(-1.35, 1.05, 5.2);
    bodyGroup.add(omsLeft);

    const omsRight = new THREE.Mesh(omsGeo, whiteTile);
    omsRight.position.set(1.35, 1.05, 5.2);
    bodyGroup.add(omsRight);

    // 7. Three Main Engine Bells + Two OMS Nozzles + Volumetric Ionized Plumes
    const bellPts = [
      new THREE.Vector2(0.64, 0.0),
      new THREE.Vector2(0.54, 0.45),
      new THREE.Vector2(0.32, 1.05),
      new THREE.Vector2(0.0, 1.2),
    ];
    const bellGeo = new THREE.LatheGeometry(bellPts, 20);
    bellGeo.rotateX(Math.PI / 2);
    this.geometries.push(bellGeo);

    const plumeGeo = new THREE.ConeGeometry(0.75, 11, 18, 1, true);
    plumeGeo.translate(0, -5.5, 0);
    plumeGeo.rotateX(-Math.PI / 2);
    this.geometries.push(plumeGeo);

    const enginePositions: Array<[number, number, number, number]> = [
      [0, 0.65, 6.45, 0.9],
      [-0.78, -0.15, 6.4, 0.9],
      [0.78, -0.15, 6.4, 0.9],
      [-1.35, 1.05, 6.85, 0.55], // OMS left
      [1.35, 1.05, 6.85, 0.55],  // OMS right
    ];

    for (const [ex, ey, ez, sc] of enginePositions) {
      const bell = new THREE.Mesh(bellGeo, engineNozzle);
      bell.position.set(ex, ey, ez);
      bell.scale.setScalar(sc);
      bodyGroup.add(bell);

      const pMat = new THREE.MeshBasicMaterial({
        color: '#88c9ff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.materials.push(pMat);
      const plume = new THREE.Mesh(plumeGeo, pMat);
      plume.position.set(ex, ey, ez + 0.4);
      plume.scale.setScalar(sc);
      bodyGroup.add(plume);
      this.thrusterPlumes.push(plume);

      const glowMat = new THREE.SpriteMaterial({
        map: textures.glowTexture,
        color: '#9bd4ff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.materials.push(glowMat);
      const glow = new THREE.Sprite(glowMat);
      glow.position.set(ex, ey, ez + 0.6);
      glow.scale.set(3.2 * sc, 3.2 * sc, 1);
      bodyGroup.add(glow);
      this.thrusterGlows.push(glow);
    }

    // Subtle Forward RCS Thruster Puffs
    const rcsOffsets: Array<[number, number, number]> = [
      [0.8, 0.3, -7.8],
      [-0.8, 0.3, -7.8],
    ];
    for (const [rx, ry, rz] of rcsOffsets) {
      const rMat = new THREE.SpriteMaterial({
        map: textures.smokeTexture,
        color: '#e0f2fe',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.materials.push(rMat);
      const sp = new THREE.Sprite(rMat);
      sp.position.set(rx, ry, rz);
      sp.scale.set(1.6, 1.6, 1);
      bodyGroup.add(sp);
      this.rcsPuffs.push(sp);
    }

    this.root.add(bodyGroup);
  }

  public update(elapsedTime: number, burnIntensity: number, rcsPulse: number): void {
    const flicker = 0.9 + 0.1 * Math.sin(elapsedTime * 38);
    const active = burnIntensity > 0.02;

    for (let i = 0; i < this.thrusterPlumes.length; i++) {
      const plume = this.thrusterPlumes[i];
      const glow = this.thrusterGlows[i];
      plume.visible = active;
      glow.visible = active;
      if (active) {
        const isOMS = i >= 3;
        const factor = isOMS ? burnIntensity : burnIntensity * 0.4;
        const baseScale = isOMS ? 0.55 : 0.9;
        plume.scale.set(
          baseScale * (0.85 + factor * 0.5),
          baseScale * (0.85 + factor * 0.5),
          baseScale * (0.6 + factor * 1.45) * flicker
        );
        (plume.material as THREE.MeshBasicMaterial).opacity = Math.min(0.65, factor * 0.55);
        (glow.material as THREE.SpriteMaterial).opacity = Math.min(0.9, factor * 0.85);
      }
    }

    for (let i = 0; i < this.rcsPuffs.length; i++) {
      const puff = this.rcsPuffs[i];
      const wave = Math.max(0, Math.sin(elapsedTime * 2.5 + i * 2.1)) * rcsPulse;
      puff.visible = wave > 0.02;
      (puff.material as THREE.SpriteMaterial).opacity = wave * 0.35;
      puff.scale.setScalar(1.2 + wave * 1.8);
    }
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
