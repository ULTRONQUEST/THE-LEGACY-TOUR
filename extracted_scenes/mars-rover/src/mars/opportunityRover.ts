import * as THREE from 'three';
import { MarsTextureSet } from './textures';

export interface OpportunityRoverHandle {
  group: THREE.Group;
  update: (
    dt: number,
    elapsed: number,
    driveSpeed: number,
    groundHeightAt: (x: number, z: number) => number
  ) => void;
  setBasePosition: (x: number, z: number, groundHeightAt: (x: number, z: number) => number) => void;
}

/**
 * Historically accurate NASA Opportunity (MER-B, 2004–2018) 3D Rover Model.
 * Distinct from Perseverance/Curiosity:
 *  - Triangular Warm Electronics Box (WEB) wrapped in gold Kapton MLI & white thermal paint
 *  - 3-wing deployable polygonal Solar Array Deck (not RTG)
 *  - 6-wheel Rocker-Bogie titanium suspension with 25cm-class cleated aluminum wheels
 *  - Pancam Mast Assembly (PMA) with dual stereo Pancam + Navcam bar
 *  - High-Gain parabolic Dish Antenna (HGA) & Low-Gain UHF mast
 *  - Front 3-joint Instrument Deployment Device (IDD) arm with science turret
 *  - Grounded bottom-center pivot sitting flush on regolith with contact shadow
 */
export function createOpportunityRover(textures: MarsTextureSet): OpportunityRoverHandle {
  const root = new THREE.Group();
  root.name = 'OpportunityRover_MER_B';

  const chassis = new THREE.Group();
  root.add(chassis);

  // Calibrated aerospace PBR materials (distinct roughness & metalness across adjacent parts)
  const goldKaptonMat = new THREE.MeshPhysicalMaterial({
    color: 0xd99b2a,
    metalness: 0.92,
    roughness: 0.25,
    bumpMap: textures.kaptonTex,
    bumpScale: 0.012,
    anisotropy: 0.7,
    clearcoat: 0.15,
  });

  const whiteThermalMat = new THREE.MeshStandardMaterial({
    color: 0xeae6df,
    roughness: 0.42,
    metalness: 0.12,
  });

  const titaniumMat = new THREE.MeshStandardMaterial({
    color: 0x8f969e,
    roughness: 0.28,
    metalness: 0.86,
  });

  const darkAnodizedMat = new THREE.MeshStandardMaterial({
    color: 0x2a2d34,
    roughness: 0.36,
    metalness: 0.78,
  });

  const copperAccentMat = new THREE.MeshStandardMaterial({
    color: 0xb8733a,
    roughness: 0.3,
    metalness: 0.88,
  });

  const solarPanelMat = new THREE.MeshStandardMaterial({
    map: textures.solarCellTex,
    roughness: 0.26,
    metalness: 0.58,
  });

  const opticalGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x101c2e,
    roughness: 0.06,
    metalness: 0.12,
    clearcoat: 1.0,
    ior: 1.56,
  });

  const dustMat = new THREE.MeshStandardMaterial({
    color: 0xb86238,
    roughness: 0.95,
    metalness: 0.02,
  });

  // Grounding Soft Contact Shadow directly beneath rover
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sctx = shadowCanvas.getContext('2d')!;
  const sg = sctx.createRadialGradient(64, 64, 12, 64, 64, 62);
  sg.addColorStop(0, 'rgba(18, 7, 3, 0.55)');
  sg.addColorStop(0.6, 'rgba(18, 7, 3, 0.22)');
  sg.addColorStop(1, 'rgba(18, 7, 3, 0)');
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.15, 2.25),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.015;
  root.add(contactShadow);

  // 1. Warm Electronics Box (WEB) — Iconic MER wedge/prism chassis
  const webHeight = 0.36;
  const webY = 0.47;
  const webBody = new THREE.Mesh(new THREE.BoxGeometry(0.76, webHeight, 0.96), goldKaptonMat);
  webBody.position.set(0, webY, 0);
  webBody.castShadow = true;
  webBody.receiveShadow = true;
  chassis.add(webBody);

  // Thermal bulkhead trim plates
  const frontBulkhead = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.32, 0.06), whiteThermalMat);
  frontBulkhead.position.set(0, webY, 0.49);
  frontBulkhead.castShadow = true;
  chassis.add(frontBulkhead);

  const rearBulkhead = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.30, 0.08), whiteThermalMat);
  rearBulkhead.position.set(0, webY, -0.49);
  rearBulkhead.castShadow = true;
  chassis.add(rearBulkhead);

  // 2. Iconic 3-Wing Deployable Solar Array Deck (Center Triangle + Left/Right/Rear Wings)
  const deckY = 0.66;
  // Center equipment deck
  const centerDeckShape = new THREE.Shape();
  centerDeckShape.moveTo(-0.42, -0.48);
  centerDeckShape.lineTo(0.42, -0.48);
  centerDeckShape.lineTo(0.32, 0.48);
  centerDeckShape.lineTo(-0.32, 0.48);
  centerDeckShape.closePath();

  const deckExtrude = new THREE.ExtrudeGeometry(centerDeckShape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  deckExtrude.rotateX(Math.PI / 2);
  const centerDeck = new THREE.Mesh(deckExtrude, whiteThermalMat);
  centerDeck.position.set(0, deckY + 0.02, 0);
  centerDeck.castShadow = true;
  centerDeck.receiveShadow = true;
  chassis.add(centerDeck);

  // Solar Cell top inlays on Center Deck
  const centerSolar = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.012, 0.78), solarPanelMat);
  centerSolar.position.set(0, deckY + 0.03, -0.02);
  centerSolar.receiveShadow = true;
  chassis.add(centerSolar);

  // Left & Right Deployable Solar Wings (trapezoidal MER silhouette)
  const makeWingMesh = (side: number) => {
    const shape = new THREE.Shape();
    // Local XY -> will rotate to XZ horizontal plane
    shape.moveTo(0, -0.44);
    shape.lineTo(side * 0.56, -0.28);
    shape.lineTo(side * 0.52, 0.36);
    shape.lineTo(0, 0.46);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 1,
    });
    geo.rotateX(Math.PI / 2);

    const wingGroup = new THREE.Group();
    const frame = new THREE.Mesh(geo, goldKaptonMat);
    frame.castShadow = true;
    frame.receiveShadow = true;
    wingGroup.add(frame);

    const cellGeo = new THREE.PlaneGeometry(0.46, 0.64);
    cellGeo.rotateX(-Math.PI / 2);
    const cells = new THREE.Mesh(cellGeo, solarPanelMat);
    cells.position.set(side * 0.27, 0.008, 0.01);
    cells.receiveShadow = true;
    wingGroup.add(cells);

    // Hinge bracket
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.14, 10), titaniumMat);
    hinge.rotation.x = Math.PI / 2;
    hinge.position.set(0, -0.01, 0);
    wingGroup.add(hinge);

    wingGroup.position.set(side * 0.37, deckY + 0.02, 0);
    // Subtle slight upward dihedral on deployed wings
    wingGroup.rotation.z = side * 0.03;
    return wingGroup;
  };
  chassis.add(makeWingMesh(-1));
  chassis.add(makeWingMesh(1));

  // Rear Tail Solar Wing
  const tailGeo = new THREE.BoxGeometry(0.76, 0.024, 0.38);
  const tailWing = new THREE.Mesh(tailGeo, goldKaptonMat);
  tailWing.position.set(0, deckY + 0.016, -0.66);
  tailWing.rotation.x = -0.04;
  tailWing.castShadow = true;
  chassis.add(tailWing);

  const tailCells = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.012, 0.32), solarPanelMat);
  tailCells.position.set(0, deckY + 0.026, -0.66);
  tailCells.rotation.x = -0.04;
  chassis.add(tailCells);

  // 3. Pancam Mast Assembly (PMA) — Front-Right vertical camera mast with animated head
  const mastBase = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 0.1, 14), darkAnodizedMat);
  mastBase.position.set(0.18, deckY + 0.07, 0.32);
  chassis.add(mastBase);

  const mastTube = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.64, 14), whiteThermalMat);
  mastTube.position.set(0.18, deckY + 0.43, 0.32);
  mastTube.castShadow = true;
  chassis.add(mastTube);

  const mastCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 14), copperAccentMat);
  mastCollar.position.set(0.18, deckY + 0.56, 0.32);
  chassis.add(mastCollar);

  // Articulated Pancam / Navcam Head
  const mastHeadGroup = new THREE.Group();
  mastHeadGroup.position.set(0.18, deckY + 0.77, 0.32);
  chassis.add(mastHeadGroup);

  const cameraBar = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.085, 0.12), whiteThermalMat);
  cameraBar.castShadow = true;
  mastHeadGroup.add(cameraBar);

  const sunBaffle = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.15), titaniumMat);
  sunBaffle.position.set(0, 0.045, 0.01);
  mastHeadGroup.add(sunBaffle);

  // Stereo Pancams (outer) + Navcams (inner)
  [-0.11, -0.045, 0.045, 0.11].forEach((lx, idx) => {
    const r = idx === 0 || idx === 3 ? 0.022 : 0.016;
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(r + 0.005, r + 0.005, 0.03, 14),
      darkAnodizedMat
    );
    housing.rotation.x = Math.PI / 2;
    housing.position.set(lx, 0.0, 0.065);
    mastHeadGroup.add(housing);

    const lens = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.012, 14), opticalGlassMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(lx, 0.0, 0.078);
    mastHeadGroup.add(lens);
  });

  // 4. High-Gain Parabolic Dish Antenna (HGA) & Low-Gain Antenna & MarsDial
  const hgaStand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.16, 10), titaniumMat);
  hgaStand.position.set(-0.18, deckY + 0.11, -0.22);
  chassis.add(hgaStand);

  const dishPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.06, 0.01),
    new THREE.Vector2(0.12, 0.035),
    new THREE.Vector2(0.16, 0.072),
  ];
  const dishGeo = new THREE.LatheGeometry(dishPts, 24);
  const hgaDish = new THREE.Mesh(dishGeo, whiteThermalMat);
  hgaDish.position.set(-0.18, deckY + 0.21, -0.22);
  hgaDish.rotation.x = 0.58;
  hgaDish.rotation.z = 0.25;
  hgaDish.castShadow = true;
  chassis.add(hgaDish);

  const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.09, 10), copperAccentMat);
  feedHorn.position.set(0, 0.055, 0);
  hgaDish.add(feedHorn);

  // Low-Gain UHF Whip Antenna
  const lgaMast = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.34, 8), titaniumMat);
  lgaMast.position.set(-0.24, deckY + 0.2, -0.45);
  chassis.add(lgaMast);

  // MarsDial Calibration Target on rear deck
  const dialBase = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.09), titaniumMat);
  dialBase.position.set(0.20, deckY + 0.045, -0.35);
  chassis.add(dialBase);
  const dialGnomon = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.055, 8), copperAccentMat);
  dialGnomon.position.set(0.20, deckY + 0.08, -0.35);
  chassis.add(dialGnomon);

  // 5. 6-Wheel Rocker-Bogie Titanium Suspension & Machined Aluminum Wheels
  const wheelRadius = 0.132;
  const wheelWidth = 0.11;
  const wheels: THREE.Group[] = [];

  const wheelRimGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24);
  wheelRimGeo.rotateZ(Math.PI / 2);

  const wheelHubGeo = new THREE.CylinderGeometry(wheelRadius * 0.56, wheelRadius * 0.56, wheelWidth * 0.85, 16);
  wheelHubGeo.rotateZ(Math.PI / 2);

  const cleatGeo = new THREE.BoxGeometry(wheelWidth * 0.96, 0.014, 0.018);

  const buildWheel = (x: number, y: number, z: number) => {
    const wg = new THREE.Group();
    wg.position.set(x, y, z);

    const rim = new THREE.Mesh(wheelRimGeo, darkAnodizedMat);
    rim.castShadow = true;
    rim.receiveShadow = true;
    wg.add(rim);

    const hub = new THREE.Mesh(wheelHubGeo, titaniumMat);
    wg.add(hub);

    // 12 circumferential aluminum grouser cleats per wheel
    for (let c = 0; c < 12; c++) {
      const a = (c / 12) * Math.PI * 2;
      const cleat = new THREE.Mesh(cleatGeo, titaniumMat);
      cleat.position.set(0, Math.cos(a) * wheelRadius, Math.sin(a) * wheelRadius);
      cleat.rotation.x = -a;
      wg.add(cleat);
    }

    // Subtle Martian regolith dust ring on tire tread
    const dustRing = new THREE.Mesh(
      new THREE.TorusGeometry(wheelRadius * 0.84, 0.012, 6, 18),
      dustMat
    );
    dustRing.rotation.y = Math.PI / 2;
    dustRing.position.x = x > 0 ? 0.042 : -0.042;
    wg.add(dustRing);

    chassis.add(wg);
    wheels.push(wg);
  };

  const trackHalf = 0.56;
  const zFront = 0.54;
  const zMid = 0.02;
  const zRear = -0.52;

  // Build 6 wheels (ground-flush at y = wheelRadius)
  [
    [-trackHalf, wheelRadius, zFront],
    [-trackHalf, wheelRadius, zMid],
    [-trackHalf, wheelRadius, zRear],
    [trackHalf, wheelRadius, zFront],
    [trackHalf, wheelRadius, zMid],
    [trackHalf, wheelRadius, zRear],
  ].forEach(([wx, wy, wz]) => buildWheel(wx, wy, wz));

  // Rocker-Bogie Suspension Linkages connecting chassis pivots to wheel hubs
  const addStrut = (p1: THREE.Vector3, p2: THREE.Vector3, radius = 0.018) => {
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 8), titaniumMat);
    strut.position.copy(p1).add(p2).multiplyScalar(0.5);
    strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    strut.castShadow = true;
    chassis.add(strut);
  };

  [-1, 1].forEach((side) => {
    const sx = side * 0.42;
    const wx = side * 0.51;
    const rockerPivot = new THREE.Vector3(sx, 0.46, 0.06);
    const bogiePivot = new THREE.Vector3(sx + side * 0.05, 0.30, -0.26);

    // Front rocker arm
    addStrut(rockerPivot, new THREE.Vector3(wx, wheelRadius + 0.14, zFront), 0.02);
    addStrut(new THREE.Vector3(wx, wheelRadius + 0.14, zFront), new THREE.Vector3(wx, wheelRadius, zFront), 0.016);

    // Rocker to bogie link
    addStrut(rockerPivot, bogiePivot, 0.02);

    // Bogie to mid & rear wheels
    addStrut(bogiePivot, new THREE.Vector3(wx, wheelRadius, zMid), 0.016);
    addStrut(bogiePivot, new THREE.Vector3(wx, wheelRadius, zRear), 0.016);

    // Steering actuator cans on front & rear wheels
    [zFront, zRear].forEach((wz) => {
      const actuator = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.09, 10), darkAnodizedMat);
      actuator.position.set(wx, wheelRadius + 0.14, wz);
      chassis.add(actuator);
    });
  });

  // Differential cross-bar across rear of WEB
  addStrut(new THREE.Vector3(-0.42, 0.46, -0.44), new THREE.Vector3(0.42, 0.46, -0.44), 0.015);

  // 6. Front Instrument Deployment Device (IDD) Robotic Arm & 4-Instrument Science Turret
  const iddGroup = new THREE.Group();
  iddGroup.position.set(-0.08, 0.38, 0.52);
  chassis.add(iddGroup);

  const armSeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.32), titaniumMat);
  armSeg1.position.set(0, -0.02, 0.16);
  armSeg1.rotation.x = 0.22;
  armSeg1.castShadow = true;
  iddGroup.add(armSeg1);

  const armJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.06, 12), copperAccentMat);
  armJoint.rotation.z = Math.PI / 2;
  armJoint.position.set(0, -0.055, 0.31);
  iddGroup.add(armJoint);

  const armSeg2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.24), titaniumMat);
  armSeg2.position.set(0.02, -0.10, 0.41);
  armSeg2.rotation.x = 0.35;
  armSeg2.rotation.y = -0.15;
  iddGroup.add(armSeg2);

  // Science Turret (RAT, Microscopic Imager, APXS, Mössbauer)
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.065, 16), darkAnodizedMat);
  turret.position.set(0.04, -0.14, 0.52);
  turret.rotation.x = Math.PI / 3;
  turret.castShadow = true;
  iddGroup.add(turret);

  const ratHead = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.06, 12), copperAccentMat);
  ratHead.position.set(0.04, -0.16, 0.56);
  ratHead.rotation.x = Math.PI / 2;
  iddGroup.add(ratHead);

  // 7. Front Hazcam Stereo Eyes on lower bulkhead
  [-0.14, 0.14].forEach((hx) => {
    const haz = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.032, 0.03), opticalGlassMat);
    haz.position.set(hx, 0.36, 0.525);
    chassis.add(haz);
  });

  // Scale rover slightly for dramatic cinematic readability while maintaining true internal proportions
  root.scale.setScalar(1.15);

  let wheelAngle = 0;

  return {
    group: root,
    setBasePosition(x: number, z: number, getH: (px: number, pz: number) => number) {
      const y = getH(x, z);
      root.position.set(x, y, z);

      // Compute local terrain pitch & roll from wheel contact footprint
      const yFront = getH(x, z + 0.6);
      const yRear = getH(x, z - 0.6);
      const yLeft = getH(x - 0.6, z);
      const yRight = getH(x + 0.6, z);

      chassis.rotation.x = Math.atan2(yRear - yFront, 1.2);
      chassis.rotation.z = Math.atan2(yLeft - yRight, 1.2);
    },
    update(dt: number, elapsed: number, driveSpeed: number, getH: (px: number, pz: number) => number) {
      if (driveSpeed > 0.001) {
        wheelAngle += (driveSpeed / wheelRadius) * dt;
        for (const w of wheels) {
          w.rotation.x = wheelAngle;
        }
      }

      // Restrained historical survey scan of Pancam mast head
      mastHeadGroup.rotation.y = Math.sin(elapsed * 0.42) * 0.34;
      mastHeadGroup.rotation.x = -0.08 + Math.sin(elapsed * 0.27) * 0.05;

      // Subtle IDD turret poise
      iddGroup.rotation.x = Math.sin(elapsed * 0.35) * 0.025;

      // Re-ground smoothly on current position
      const y = getH(root.position.x, root.position.z);
      root.position.y = y;
    },
  };
}
