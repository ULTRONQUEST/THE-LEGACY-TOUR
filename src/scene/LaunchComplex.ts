import * as THREE from 'three';
import { SpriteAndSurfaceTextures } from './textures';

/**
 * Grand Coastal Launch Complex 39 with:
 * - Mobile Launcher Platform (MLP) with flame aperture (top flush at y = 0)
 * - 122m Red/Orange Steel Launch Umbilical Tower (LUT) with 5 retracting Swing Arms
 * - Concrete Flame Trench & Deflector
 * - 4 Perimeter Lightning Protection Masts
 * - Propellant LOX/LH2 Tank Spheres, Support Buildings & Distant VAB
 * - Coastal terrain, Atlantic Ocean shoreline, and InstancedMesh coastal tree groves
 */
export class LaunchComplex {
  public readonly group = new THREE.Group();
  private swingArms: THREE.Group[] = [];
  private oceanMat: THREE.MeshStandardMaterial;
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  constructor(textures: SpriteAndSurfaceTextures) {
    const padConcreteMat = new THREE.MeshStandardMaterial({
      map: textures.concreteTexture,
      roughness: 0.88,
      metalness: 0.04,
    });
    const darkConcreteMat = new THREE.MeshStandardMaterial({
      color: '#4b4f54',
      roughness: 0.92,
      metalness: 0.06,
    });
    const mlpSteelMat = new THREE.MeshStandardMaterial({
      color: '#5f6770',
      roughness: 0.55,
      metalness: 0.58,
    });
    const towerRedMat = new THREE.MeshStandardMaterial({
      color: '#c2412c',
      roughness: 0.48,
      metalness: 0.45,
    });
    const towerGreyMat = new THREE.MeshStandardMaterial({
      color: '#889098',
      roughness: 0.45,
      metalness: 0.62,
    });
    const whiteTankMat = new THREE.MeshStandardMaterial({
      color: '#eef1f5',
      roughness: 0.35,
      metalness: 0.15,
    });
    const coastalTerrainMat = new THREE.MeshStandardMaterial({
      color: '#3f5a3c',
      roughness: 0.95,
      metalness: 0.0,
    });
    const sandMat = new THREE.MeshStandardMaterial({
      color: '#b8aa8c',
      roughness: 0.92,
      metalness: 0.0,
    });
    this.oceanMat = new THREE.MeshStandardMaterial({
      color: '#184e77',
      roughness: 0.18,
      metalness: 0.35,
    });

    this.materials.push(
      padConcreteMat,
      darkConcreteMat,
      mlpSteelMat,
      towerRedMat,
      towerGreyMat,
      whiteTankMat,
      coastalTerrainMat,
      sandMat,
      this.oceanMat
    );

    // =========================================================================
    // 1. COASTAL LANDSCAPE & ATLANTIC OCEAN (ground plane at y = -11)
    // =========================================================================
    const groundY = -11;

    // Vast ocean extending out toward horizon
    const oceanGeo = new THREE.PlaneGeometry(5200, 5200);
    oceanGeo.rotateX(-Math.PI / 2);
    this.geometries.push(oceanGeo);
    const ocean = new THREE.Mesh(oceanGeo, this.oceanMat);
    ocean.position.set(0, groundY - 1.2, 0);
    ocean.receiveShadow = true;
    this.group.add(ocean);

    // Coastal peninsula landmass under & behind launch complex
    const landGeo = new THREE.CylinderGeometry(950, 1020, 2.0, 48);
    this.geometries.push(landGeo);
    const land = new THREE.Mesh(landGeo, coastalTerrainMat);
    land.position.set(-280, groundY - 0.8, 360);
    land.receiveShadow = true;
    this.group.add(land);

    // Sandy coastal dune rim near beach edge
    const beachGeo = new THREE.CylinderGeometry(968, 995, 1.1, 48);
    this.geometries.push(beachGeo);
    const beach = new THREE.Mesh(beachGeo, sandMat);
    beach.position.set(-280, groundY - 1.05, 360);
    this.group.add(beach);

    // =========================================================================
    // 2. LAUNCHPAD APRON, FLAME TRENCH & MOBILE LAUNCHER PLATFORM (MLP)
    // =========================================================================
    // Concrete ramp pedestal surrounding the trench
    const apronGeo = new THREE.CylinderGeometry(82, 102, 5.2, 8);
    this.geometries.push(apronGeo);
    const apron = new THREE.Mesh(apronGeo, padConcreteMat);
    apron.position.set(0, groundY + 2.6, 0);
    apron.receiveShadow = true;
    this.group.add(apron);

    // Crawlerway causeway leading back to VAB
    const roadGeo = new THREE.BoxGeometry(44, 0.4, 900);
    this.geometries.push(roadGeo);
    const road = new THREE.Mesh(roadGeo, darkConcreteMat);
    road.position.set(-18, groundY + 0.3, 490);
    road.receiveShadow = true;
    this.group.add(road);

    // Flame trench concrete walls & angled flame deflector wedge beneath rocket
    const trenchWallGeo = new THREE.BoxGeometry(10, 8, 92);
    const deflectorGeo = new THREE.CylinderGeometry(0, 10, 14, 4);
    deflectorGeo.rotateY(Math.PI / 4);
    this.geometries.push(trenchWallGeo, deflectorGeo);

    const wallL = new THREE.Mesh(trenchWallGeo, darkConcreteMat);
    wallL.position.set(-14, groundY + 6.0, 0);
    wallL.receiveShadow = true;
    this.group.add(wallL);

    const wallR = new THREE.Mesh(trenchWallGeo, darkConcreteMat);
    wallR.position.set(14, groundY + 6.0, 0);
    wallR.receiveShadow = true;
    this.group.add(wallR);

    const deflector = new THREE.Mesh(deflectorGeo, darkConcreteMat);
    deflector.position.set(0, groundY + 4.5, 0);
    deflector.scale.set(1.1, 0.65, 1.8);
    this.group.add(deflector);

    // Mobile Launcher Platform (MLP) top deck flush at y = 0
    const mlpDeckShape = new THREE.Shape();
    mlpDeckShape.moveTo(-26, -18);
    mlpDeckShape.lineTo(20, -18);
    mlpDeckShape.lineTo(20, 18);
    mlpDeckShape.lineTo(-26, 18);
    mlpDeckShape.closePath();

    // Cut flame hole directly beneath rocket (0, 0)
    const exhaustHole = new THREE.Path();
    exhaustHole.moveTo(-6.2, -6.2);
    exhaustHole.lineTo(6.2, -6.2);
    exhaustHole.lineTo(6.2, 6.2);
    exhaustHole.lineTo(-6.2, 6.2);
    exhaustHole.closePath();
    mlpDeckShape.holes.push(exhaustHole);

    const mlpGeo = new THREE.ExtrudeGeometry(mlpDeckShape, {
      depth: 4.5,
      bevelEnabled: true,
      bevelThickness: 0.25,
      bevelSize: 0.25,
      bevelSegments: 2,
    });
    mlpGeo.rotateX(Math.PI / 2);
    this.geometries.push(mlpGeo);

    const mlp = new THREE.Mesh(mlpGeo, mlpSteelMat);
    mlp.position.set(0, 0, 0);
    mlp.castShadow = true;
    mlp.receiveShadow = true;
    this.group.add(mlp);

    // 4 Hold-Down Clamp Pedestals surrounding rocket base at y = 0
    const clampGeo = new THREE.BoxGeometry(2.2, 4.2, 2.2);
    this.geometries.push(clampGeo);
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2;
      const clamp = new THREE.Mesh(clampGeo, towerGreyMat);
      clamp.position.set(Math.cos(ang) * 6.5, 2.1, Math.sin(ang) * 6.5);
      clamp.castShadow = true;
      this.group.add(clamp);
    }

    // =========================================================================
    // 3. 122M RED STEEL LAUNCH UMBILICAL TOWER (LUT) + SWING ARMS
    // =========================================================================
    const towerGroup = new THREE.Group();
    towerGroup.position.set(-16.5, 0, 0);

    const towerHeight = 116;
    const levels = 18;
    const levelH = towerHeight / levels;
    const halfW = 5.4;

    // 4 Main Vertical Corner Steel Columns
    const colGeo = new THREE.BoxGeometry(0.95, towerHeight, 0.95);
    this.geometries.push(colGeo);
    const corners: Array<[number, number]> = [
      [-halfW, -halfW],
      [halfW, -halfW],
      [-halfW, halfW],
      [halfW, halfW],
    ];
    for (const [cx, cz] of corners) {
      const col = new THREE.Mesh(colGeo, towerRedMat);
      col.position.set(cx, towerHeight / 2, cz);
      col.castShadow = true;
      towerGroup.add(col);
    }

    // Central Elevator Core Shaft
    const elevGeo = new THREE.BoxGeometry(2.8, towerHeight - 4, 2.8);
    this.geometries.push(elevGeo);
    const elevShaft = new THREE.Mesh(elevGeo, towerGreyMat);
    elevShaft.position.set(-1.5, (towerHeight - 4) / 2, 0);
    elevShaft.castShadow = true;
    towerGroup.add(elevShaft);

    // InstancedMesh for Horizontal Girders & Diagonal Cross-Bracing
    const beamGeo = new THREE.BoxGeometry(1, 0.35, 0.35);
    this.geometries.push(beamGeo);
    const totalBeams = levels * 12;
    const beamInst = new THREE.InstancedMesh(beamGeo, towerRedMat, totalBeams);
    beamInst.castShadow = true;
    const dummy = new THREE.Object3D();
    let idx = 0;

    for (let lv = 0; lv < levels; lv++) {
      const yBase = lv * levelH;
      const yTop = yBase + levelH;
      const yMid = (yBase + yTop) / 2;

      // 4 Horizontal beams at level top
      const sides: Array<{ pos: [number, number, number]; rotY: number; len: number }> = [
        { pos: [0, yTop, -halfW], rotY: 0, len: halfW * 2 },
        { pos: [0, yTop, halfW], rotY: 0, len: halfW * 2 },
        { pos: [-halfW, yTop, 0], rotY: Math.PI / 2, len: halfW * 2 },
        { pos: [halfW, yTop, 0], rotY: Math.PI / 2, len: halfW * 2 },
      ];
      for (const s of sides) {
        dummy.position.set(...s.pos);
        dummy.rotation.set(0, s.rotY, 0);
        dummy.scale.set(s.len, 1, 1);
        dummy.updateMatrix();
        beamInst.setMatrixAt(idx++, dummy.matrix);
      }

      // 8 Diagonal X-braces across the 4 faces
      const diagLen = Math.hypot(halfW * 2, levelH);
      const diagAngle = Math.atan2(levelH, halfW * 2);
      const faceConfigs: Array<{ x: number; z: number; ry: number }> = [
        { x: 0, z: -halfW, ry: 0 },
        { x: 0, z: halfW, ry: 0 },
        { x: -halfW, z: 0, ry: Math.PI / 2 },
        { x: halfW, z: 0, ry: Math.PI / 2 },
      ];
      for (const fc of faceConfigs) {
        dummy.position.set(fc.x, yMid, fc.z);
        dummy.rotation.set(0, fc.ry, diagAngle);
        dummy.scale.set(diagLen, 0.7, 0.7);
        dummy.updateMatrix();
        beamInst.setMatrixAt(idx++, dummy.matrix);

        dummy.rotation.set(0, fc.ry, -diagAngle);
        dummy.updateMatrix();
        beamInst.setMatrixAt(idx++, dummy.matrix);
      }
    }
    beamInst.instanceMatrix.needsUpdate = true;
    beamInst.computeBoundingSphere();
    towerGroup.add(beamInst);

    // Grated Service Deck Platforms every 2 levels
    const deckGeo = new THREE.BoxGeometry(halfW * 2 + 0.8, 0.45, halfW * 2 + 0.8);
    this.geometries.push(deckGeo);
    for (let lv = 2; lv <= levels; lv += 2) {
      const deck = new THREE.Mesh(deckGeo, towerGreyMat);
      deck.position.y = lv * levelH;
      towerGroup.add(deck);
    }

    // Hammerhead Crane Boom & Top Lightning Spire on LUT
    const craneGeo = new THREE.BoxGeometry(18, 2.2, 3.2);
    const spireGeo = new THREE.CylinderGeometry(0.12, 0.65, 22, 8);
    this.geometries.push(craneGeo, spireGeo);

    const crane = new THREE.Mesh(craneGeo, towerRedMat);
    crane.position.set(3.5, towerHeight + 1.5, 0);
    crane.castShadow = true;
    towerGroup.add(crane);

    const spire = new THREE.Mesh(spireGeo, towerGreyMat);
    spire.position.set(-2, towerHeight + 12, 0);
    towerGroup.add(spire);

    // 5 Articulated Umbilical Swing Arms reaching from LUT (+X side) to Rocket
    const armHeights = [26, 46, 66, 82, 99];
    const armLengths = [11.2, 11.2, 11.4, 12.8, 13.8];
    const armTrussGeo = new THREE.BoxGeometry(1, 1.0, 1.1);
    const armHeadGeo = new THREE.BoxGeometry(1.4, 1.5, 2.2);
    this.geometries.push(armTrussGeo, armHeadGeo);

    for (let i = 0; i < armHeights.length; i++) {
      const armPivot = new THREE.Group();
      armPivot.position.set(halfW, armHeights[i], 0);

      const len = armLengths[i];
      const beam = new THREE.Mesh(armTrussGeo, i === 4 ? whiteTankMat : towerGreyMat);
      beam.scale.x = len;
      beam.position.set(len / 2, 0, 0);
      beam.castShadow = true;
      armPivot.add(beam);

      const head = new THREE.Mesh(armHeadGeo, whiteTankMat);
      head.position.set(len, 0, 0);
      armPivot.add(head);

      towerGroup.add(armPivot);
      this.swingArms.push(armPivot);
    }

    this.group.add(towerGroup);

    // =========================================================================
    // 4. 4 PERIMETER LIGHTNING PROTECTION MASTS (matches Image 3 background)
    // =========================================================================
    const mastGeo = new THREE.CylinderGeometry(0.45, 2.4, 138, 6);
    const mastTopGeo = new THREE.CylinderGeometry(0.08, 0.45, 16, 6);
    this.geometries.push(mastGeo, mastTopGeo);

    const mastCoords: Array<[number, number]> = [
      [-68, -68],
      [68, -68],
      [-68, 68],
      [68, 68],
    ];
    for (const [mx, mz] of mastCoords) {
      const mast = new THREE.Mesh(mastGeo, towerGreyMat);
      mast.position.set(mx, groundY + 69, mz);
      mast.castShadow = true;
      this.group.add(mast);

      const mastTip = new THREE.Mesh(mastTopGeo, whiteTankMat);
      mastTip.position.set(mx, groundY + 146, mz);
      this.group.add(mastTip);
    }

    // =========================================================================
    // 5. CRYOGENIC TANK FARM, SUPPORT BUILDINGS & DISTANT VAB
    // =========================================================================
    const sphereGeo = new THREE.SphereGeometry(12, 24, 16);
    const legGeo = new THREE.CylinderGeometry(0.45, 0.55, 16, 8);
    const pipeGeo = new THREE.CylinderGeometry(0.45, 0.45, 110, 8);
    pipeGeo.rotateZ(Math.PI / 2);
    this.geometries.push(sphereGeo, legGeo, pipeGeo);

    const tankLocations: Array<[number, number]> = [
      [-125, -45],
      [135, 35],
    ];
    for (const [tx, tz] of tankLocations) {
      const tank = new THREE.Mesh(sphereGeo, whiteTankMat);
      tank.position.set(tx, groundY + 18, tz);
      tank.castShadow = true;
      this.group.add(tank);

      for (let l = 0; l < 4; l++) {
        const a = (l * Math.PI) / 2;
        const leg = new THREE.Mesh(legGeo, towerGreyMat);
        leg.position.set(tx + Math.cos(a) * 9, groundY + 8, tz + Math.sin(a) * 9);
        this.group.add(leg);
      }
    }

    // Propellant supply pipe trestle
    const pipe = new THREE.Mesh(pipeGeo, towerGreyMat);
    pipe.position.set(-70, groundY + 3.5, -22);
    this.group.add(pipe);

    // Launch Control Support Bunker & Distant Vehicle Assembly Building (VAB)
    const bldgGeo = new THREE.BoxGeometry(36, 14, 24);
    const vabGeo = new THREE.BoxGeometry(110, 128, 95);
    const vabStripeGeo = new THREE.BoxGeometry(28, 95, 96);
    this.geometries.push(bldgGeo, vabGeo, vabStripeGeo);

    const supportBldg = new THREE.Mesh(bldgGeo, whiteTankMat);
    supportBldg.position.set(-140, groundY + 7, 90);
    supportBldg.castShadow = true;
    supportBldg.receiveShadow = true;
    this.group.add(supportBldg);

    const vab = new THREE.Mesh(vabGeo, whiteTankMat);
    vab.position.set(-190, groundY + 64, 580);
    vab.castShadow = true;
    this.group.add(vab);

    const vabDoor = new THREE.Mesh(vabStripeGeo, darkConcreteMat);
    vabDoor.position.set(-190, groundY + 48, 580);
    this.group.add(vabDoor);

    // =========================================================================
    // 6. INSTANCED COASTAL PINE/PALM GROVE PERIMETER (zero bare void)
    // =========================================================================
    const treeCount = 320;
    const trunkGeo = new THREE.CylinderGeometry(0.45, 0.7, 7.5, 6);
    const crownGeo = new THREE.ConeGeometry(3.8, 10, 7);
    crownGeo.translate(0, 7.5, 0);
    this.geometries.push(trunkGeo, crownGeo);

    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c4632', roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 });
    this.materials.push(trunkMat, foliageMat);

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const crowns = new THREE.InstancedMesh(crownGeo, foliageMat, treeCount);
    const tDummy = new THREE.Object3D();
    const tintColor = new THREE.Color();

    let placed = 0;
    let seed = 17;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    while (placed < treeCount) {
      const ang = rand() * Math.PI * 2;
      const dist = 165 + rand() * 620;
      const tx = Math.cos(ang) * dist - 140;
      const tz = Math.sin(ang) * dist + 220;

      // Keep clear of crawlerway road and launchpad concrete
      const nearPad = Math.hypot(tx, tz) < 155;
      const onRoad = Math.abs(tx + 18) < 42 && tz > 60;
      if (nearPad || onRoad) continue;

      const sc = 0.85 + rand() * 0.45;
      tDummy.position.set(tx, groundY + 3.5 * sc, tz);
      tDummy.rotation.set(0, rand() * Math.PI * 2, 0);
      tDummy.scale.setScalar(sc);
      tDummy.updateMatrix();

      trunks.setMatrixAt(placed, tDummy.matrix);
      crowns.setMatrixAt(placed, tDummy.matrix);

      tintColor.setHSL(0.31 + (rand() - 0.5) * 0.04, 0.36, 0.24 + rand() * 0.12);
      crowns.setColorAt(placed, tintColor);
      placed++;
    }
    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    crowns.computeBoundingSphere();
    this.group.add(trunks, crowns);
  }

  public update(armRetraction: number, visibility: number): void {
    // Swing umbilical arms smoothly back away from the vehicle at liftoff
    const angle = armRetraction * 1.18;
    for (let i = 0; i < this.swingArms.length; i++) {
      this.swingArms[i].rotation.y = (i % 2 === 0 ? 1 : -1) * angle;
    }
    this.group.visible = visibility > 0.01;
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
