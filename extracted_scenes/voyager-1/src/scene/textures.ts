import * as THREE from 'three';

export interface ProceduralTextureSet {
  goldenRecordMap: THREE.CanvasTexture;
  goldenRecordBump: THREE.CanvasTexture;
  dishMap: THREE.CanvasTexture;
  dishBump: THREE.CanvasTexture;
  goldFoilMap: THREE.CanvasTexture;
  foilBump: THREE.CanvasTexture;
  blackMliMap: THREE.CanvasTexture;
  louverMap: THREE.CanvasTexture;
  louverBump: THREE.CanvasTexture;
  tourHullMap: THREE.CanvasTexture;
  tourHullBump: THREE.CanvasTexture;
  tourWindowEmissive: THREE.CanvasTexture;
  starSprite: THREE.CanvasTexture;
  nebulaSprite: THREE.CanvasTexture;
  dispose: () => void;
}

function configureTexture(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

function createGoldenRecordTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.48;

  // Radial brushed gold base
  const grad = ctx.createRadialGradient(cx - 80, cy - 80, 20, cx, cy, radius);
  grad.addColorStop(0, '#f3d478');
  grad.addColorStop(0.45, '#d9ab43');
  grad.addColorStop(0.85, '#b68627');
  grad.addColorStop(1, '#8c6216');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Subtle concentric lathe brushing
  for (let r = 40; r < radius; r += 3) {
    const alpha = (Math.sin(r * 0.37) * 0.5 + 0.5) * 0.06;
    ctx.strokeStyle = `rgba(255, 240, 180, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    bCtx.strokeStyle = `rgba(145, 145, 145, ${alpha * 3})`;
    bCtx.lineWidth = 1;
    bCtx.beginPath();
    bCtx.arc(cx, cy, r, 0, Math.PI * 2);
    bCtx.stroke();
  }

  // Outer bevel ring & mounting bolts
  ctx.strokeStyle = '#6f4b0e';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 14, 0, Math.PI * 2);
  ctx.stroke();

  bCtx.strokeStyle = '#383838';
  bCtx.lineWidth = 10;
  bCtx.beginPath();
  bCtx.arc(cx, cy, radius - 14, 0, Math.PI * 2);
  bCtx.stroke();

  // Helper to draw engraved line on both color and bump
  const drawEngraved = (fn: (c: CanvasRenderingContext2D) => void) => {
    ctx.save();
    ctx.strokeStyle = '#4e3307';
    ctx.fillStyle = '#4e3307';
    ctx.lineCap = 'round';
    fn(ctx);
    ctx.restore();

    bCtx.save();
    bCtx.strokeStyle = '#202020';
    bCtx.fillStyle = '#202020';
    bCtx.lineCap = 'round';
    fn(bCtx);
    bCtx.restore();
  };

  // 1. Upper-left: Record & stylus diagram
  drawEngraved((c) => {
    c.lineWidth = 5;
    c.beginPath();
    c.arc(325, 315, 125, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(325, 315, 92, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(325, 315, 28, 0, Math.PI * 2);
    c.stroke();
    // Stylus arm & binary ticks
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(455, 225);
    c.lineTo(395, 305);
    c.stroke();
    // Binary dash ring
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r1 = 142;
      const r2 = i % 2 === 0 ? 156 : 148;
      c.beginPath();
      c.moveTo(325 + Math.cos(a) * r1, 315 + Math.sin(a) * r1);
      c.lineTo(325 + Math.cos(a) * r2, 315 + Math.sin(a) * r2);
      c.stroke();
    }
  });

  // 2. Upper-right: Waveforms & television scan diagram
  drawEngraved((c) => {
    c.lineWidth = 3.5;
    c.strokeRect(575, 200, 185, 130);
    c.beginPath();
    c.arc(667, 265, 42, 0, Math.PI * 2);
    c.stroke();
    // Signal pulse traces above
    c.beginPath();
    for (let x = 575; x <= 760; x += 6) {
      const y = 165 + Math.sin(x * 0.14) * 14 * Math.cos(x * 0.03);
      if (x === 575) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
    // Bottom binary ticks under box
    for (let i = 0; i < 10; i++) {
      const x = 585 + i * 18;
      c.beginPath();
      c.moveTo(x, 355);
      c.lineTo(x, i % 3 === 0 ? 378 : 368);
      c.stroke();
    }
  });

  // 3. Lower-left: Iconic 14-line Pulsar Map
  drawEngraved((c) => {
    const px = 355;
    const py = 655;
    const angles = [
      0.12, 0.48, 0.95, 1.38, 1.85, 2.24, 2.75,
      3.18, 3.65, 4.12, 4.55, 5.05, 5.45, 5.95,
    ];
    const lengths = [
      180, 135, 165, 120, 195, 145, 175,
      115, 160, 140, 185, 125, 150, 210,
    ];

    c.lineWidth = 3.5;
    angles.forEach((a, idx) => {
      const len = lengths[idx];
      const ex = px + Math.cos(a) * len;
      const ey = py + Math.sin(a) * len;
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(ex, ey);
      c.stroke();

      // Binary period ticks along each pulsar ray
      const nx = -Math.sin(a);
      const ny = Math.cos(a);
      for (let t = 0.25; t < 0.85; t += 0.08) {
        if (((idx * 7 + Math.round(t * 20)) % 3) !== 0) {
          const bx = px + Math.cos(a) * (len * t);
          const by = py + Math.sin(a) * (len * t);
          c.beginPath();
          c.moveTo(bx - nx * 5, by - ny * 5);
          c.lineTo(bx + nx * 5, by + ny * 5);
          c.stroke();
        }
      }
    });
  });

  // 4. Lower-right: Hydrogen Hyperfine Transition diagram
  drawEngraved((c) => {
    c.lineWidth = 4.5;
    const y = 680;
    c.beginPath();
    c.arc(620, y, 52, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(755, y, 52, 0, Math.PI * 2);
    c.stroke();
    // Connecting line
    c.beginPath();
    c.moveTo(672, y);
    c.lineTo(703, y);
    c.stroke();
    // Proton/electron spin indicators
    c.beginPath();
    c.arc(620, y, 5, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.arc(755, y, 5, 0, Math.PI * 2);
    c.fill();
    // Spin ticks above
    c.beginPath();
    c.moveTo(620, y - 52);
    c.lineTo(620, y - 72);
    c.moveTo(755, y - 52);
    c.lineTo(755, y - 72);
    c.moveTo(687, y + 30);
    c.lineTo(687, y + 52);
    c.stroke();
  });

  // Center spindle hub
  ctx.fillStyle = '#5f400c';
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fill();

  return {
    map: configureTexture(colorCanvas, true, maxAnisotropy),
    bump: configureTexture(bumpCanvas, false, maxAnisotropy),
  };
}

function createDishTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Matte thermal white-gray painted aluminum honeycomb
  ctx.fillStyle = '#d8dce6';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Subtle horizontal & vertical panel seams (in UV space of LatheGeometry: U=angle, V=radius)
  for (let i = 0; i < 16; i++) {
    const x = (i / 16) * size;
    ctx.strokeStyle = 'rgba(70, 80, 100, 0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();

    bCtx.strokeStyle = 'rgba(90, 90, 90, 0.45)';
    bCtx.lineWidth = 1.5;
    bCtx.beginPath();
    bCtx.moveTo(x, 0);
    bCtx.lineTo(x, size);
    bCtx.stroke();
  }

  for (let j = 1; j < 6; j++) {
    const y = (j / 6) * size;
    ctx.strokeStyle = 'rgba(70, 80, 100, 0.14)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();

    bCtx.strokeStyle = 'rgba(95, 95, 95, 0.4)';
    bCtx.lineWidth = 1.2;
    bCtx.beginPath();
    bCtx.moveTo(0, y);
    bCtx.lineTo(size, y);
    bCtx.stroke();
  }

  // Subtle aerospace surface grain
  const img = ctx.getImageData(0, 0, size, size);
  const bImg = bCtx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.sin(i * 0.137) * Math.cos(i * 0.071)) * 6;
    img.data[i] = Math.min(255, Math.max(0, img.data[i] + n));
    img.data[i + 1] = Math.min(255, Math.max(0, img.data[i + 1] + n));
    img.data[i + 2] = Math.min(255, Math.max(0, img.data[i + 2] + n));
    bImg.data[i] = bImg.data[i + 1] = bImg.data[i + 2] = Math.min(
      255,
      Math.max(0, bImg.data[i] + n * 2.5)
    );
  }
  ctx.putImageData(img, 0, 0);
  bCtx.putImageData(bImg, 0, 0);

  return {
    map: configureTexture(colorCanvas, true, maxAnisotropy),
    bump: configureTexture(bumpCanvas, false, maxAnisotropy),
  };
}

function createFoilAndMliTextures(maxAnisotropy: number): {
  goldFoilMap: THREE.CanvasTexture;
  blackMliMap: THREE.CanvasTexture;
  foilBump: THREE.CanvasTexture;
} {
  const size = 512;
  const goldCanvas = document.createElement('canvas');
  goldCanvas.width = size;
  goldCanvas.height = size;
  const gCtx = goldCanvas.getContext('2d')!;

  const blackCanvas = document.createElement('canvas');
  blackCanvas.width = size;
  blackCanvas.height = size;
  const blCtx = blackCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  gCtx.fillStyle = '#c88c28';
  gCtx.fillRect(0, 0, size, size);

  blCtx.fillStyle = '#141720';
  blCtx.fillRect(0, 0, size, size);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Crinkled MLI facet polygons
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < 380; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 16 + rand() * 48;
    const h = 12 + rand() * 36;
    const angle = rand() * Math.PI;
    const shade = rand();

    [gCtx, blCtx, bCtx].forEach((c, idx) => {
      c.save();
      c.translate(x, y);
      c.rotate(angle);
      c.beginPath();
      c.moveTo(-w * 0.5, -h * 0.3);
      c.lineTo(w * 0.4, -h * 0.5);
      c.lineTo(w * 0.5, h * 0.4);
      c.lineTo(-w * 0.3, h * 0.5);
      c.closePath();

      if (idx === 0) {
        c.fillStyle = shade > 0.5 ? 'rgba(250, 200, 90, 0.18)' : 'rgba(120, 72, 12, 0.22)';
      } else if (idx === 1) {
        c.fillStyle = shade > 0.5 ? 'rgba(42, 48, 66, 0.25)' : 'rgba(8, 10, 16, 0.3)';
      } else {
        const v = Math.floor(70 + shade * 120);
        c.fillStyle = `rgba(${v}, ${v}, ${v}, 0.55)`;
      }
      c.fill();
      c.restore();
    });
  }

  return {
    goldFoilMap: configureTexture(goldCanvas, true, maxAnisotropy, 2, 2),
    blackMliMap: configureTexture(blackCanvas, true, maxAnisotropy, 2, 2),
    foilBump: configureTexture(bumpCanvas, false, maxAnisotropy, 2, 2),
  };
}

function createLouverTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = '#1b1f2a';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#404040';
  bCtx.fillRect(0, 0, size, size);

  // Precision thermal louver slats
  for (let y = 14; y < size - 14; y += 16) {
    ctx.fillStyle = '#333b4d';
    ctx.fillRect(18, y, size - 36, 9);
    ctx.fillStyle = '#0d1017';
    ctx.fillRect(18, y + 9, size - 36, 4);

    bCtx.fillStyle = '#c8c8c8';
    bCtx.fillRect(18, y, size - 36, 9);
    bCtx.fillStyle = '#202020';
    bCtx.fillRect(18, y + 9, size - 36, 4);
  }

  // Frame border
  ctx.strokeStyle = '#495266';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, size - 12, size - 12);

  return {
    map: configureTexture(colorCanvas, true, maxAnisotropy),
    bump: configureTexture(bumpCanvas, false, maxAnisotropy),
  };
}

function createTourHullTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
  windowEmissive: THREE.CanvasTexture;
} {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = '#cfd5e2';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Subtle composite panel grid
  const cols = 8;
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const shade = ((r * 7 + c * 13) % 5) * 4 - 8;
      const base = 206 + shade;
      ctx.fillStyle = `rgb(${base - 4}, ${base}, ${base + 8})`;
      ctx.fillRect(
        (c * size) / cols + 2,
        (r * size) / rows + 2,
        size / cols - 4,
        size / rows - 4
      );
      bCtx.fillStyle = '#929292';
      bCtx.fillRect(
        (c * size) / cols + 2,
        (r * size) / rows + 2,
        size / cols - 4,
        size / rows - 4
      );
    }
  }

  // Subtle aerospace accent stripe
  ctx.fillStyle = '#293246';
  ctx.fillRect(0, size * 0.44, size, size * 0.08);

  // Warm illuminated observation window strip
  const winCanvas = document.createElement('canvas');
  winCanvas.width = 512;
  winCanvas.height = 128;
  const wCtx = winCanvas.getContext('2d')!;
  wCtx.fillStyle = '#000000';
  wCtx.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 8; i++) {
    const x = 24 + i * 60;
    const g = wCtx.createLinearGradient(x, 30, x, 98);
    g.addColorStop(0, '#ffd8a8');
    g.addColorStop(0.6, '#f4b374');
    g.addColorStop(1, '#6f87b8');
    wCtx.fillStyle = g;
    wCtx.fillRect(x, 32, 40, 64);
  }

  return {
    map: configureTexture(colorCanvas, true, maxAnisotropy, 2, 1),
    bump: configureTexture(bumpCanvas, false, maxAnisotropy, 2, 1),
    windowEmissive: configureTexture(winCanvas, true, maxAnisotropy),
  };
}

function createGlowSprite(
  size: number,
  innerColor: string,
  midColor: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;

  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(0.25, midColor);
  grad.addColorStop(0.6, 'rgba(70, 90, 180, 0.12)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  return configureTexture(canvas, true, maxAnisotropy);
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTextureSet {
  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const goldenRecord = createGoldenRecordTextures(maxAnisotropy);
  const dish = createDishTextures(maxAnisotropy);
  const mli = createFoilAndMliTextures(maxAnisotropy);
  const louver = createLouverTextures(maxAnisotropy);
  const tour = createTourHullTextures(maxAnisotropy);
  const starSprite = createGlowSprite(
    64,
    'rgba(255, 255, 255, 1)',
    'rgba(210, 225, 255, 0.65)',
    maxAnisotropy
  );
  const nebulaSprite = createGlowSprite(
    256,
    'rgba(180, 170, 255, 0.35)',
    'rgba(85, 130, 220, 0.14)',
    maxAnisotropy
  );

  const allTextures: THREE.Texture[] = [
    goldenRecord.map,
    goldenRecord.bump,
    dish.map,
    dish.bump,
    mli.goldFoilMap,
    mli.blackMliMap,
    mli.foilBump,
    louver.map,
    louver.bump,
    tour.map,
    tour.bump,
    tour.windowEmissive,
    starSprite,
    nebulaSprite,
  ];

  return {
    goldenRecordMap: goldenRecord.map,
    goldenRecordBump: goldenRecord.bump,
    dishMap: dish.map,
    dishBump: dish.bump,
    goldFoilMap: mli.goldFoilMap,
    foilBump: mli.foilBump,
    blackMliMap: mli.blackMliMap,
    louverMap: louver.map,
    louverBump: louver.bump,
    tourHullMap: tour.map,
    tourHullBump: tour.bump,
    tourWindowEmissive: tour.windowEmissive,
    starSprite,
    nebulaSprite,
    dispose: () => {
      allTextures.forEach((t) => t.dispose());
    },
  };
}
