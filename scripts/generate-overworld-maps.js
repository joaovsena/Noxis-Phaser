const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const MAPS_ROOT = path.join(ROOT, 'public', 'maps');
const TILESET_SIZE = { width: 256, height: 352 };
const MAP_TILE_SIZE = { width: 256, height: 128 };
const GRID_SIZE = 80;
const WORLD_SIZE = 6400;
const WORLD_TILE_SIZE = WORLD_SIZE / GRID_SIZE;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFileIfChanged(filePath, content) {
  const next = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (current === next) return;
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, next, 'utf8');
}

function hashSeed(input) {
  let h = 2166136261;
  const text = String(input || 'seed');
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

function createRng(seedInput) {
  let state = hashSeed(seedInput);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function createGrid(fill = 0) {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(fill));
}

function flattenGrid(grid) {
  return grid.flatMap((row) => row.map((value) => Number(value || 0)));
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;
}

function setCell(grid, x, y, value) {
  if (!inBounds(x, y)) return;
  grid[y][x] = value;
}

function getCell(grid, x, y) {
  if (!inBounds(x, y)) return 0;
  return Number(grid[y][x] || 0);
}

function fillRect(grid, x, y, w, h, value) {
  for (let row = y; row < y + h; row += 1) {
    for (let col = x; col < x + w; col += 1) {
      setCell(grid, col, row, value);
    }
  }
}

function clearRect(grid, x, y, w, h) {
  fillRect(grid, x, y, w, h, 0);
}

function paintEllipse(grid, cx, cy, rx, ry, value) {
  for (let row = Math.floor(cy - ry - 1); row <= Math.ceil(cy + ry + 1); row += 1) {
    for (let col = Math.floor(cx - rx - 1); col <= Math.ceil(cx + rx + 1); col += 1) {
      if (!inBounds(col, row)) continue;
      const nx = (col - cx) / Math.max(1, rx);
      const ny = (row - cy) / Math.max(1, ry);
      if (nx * nx + ny * ny <= 1) setCell(grid, col, row, value);
    }
  }
}

function paintCircle(grid, cx, cy, radius, value) {
  paintEllipse(grid, cx, cy, radius, radius, value);
}

function paintLine(grid, points, radius, value) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1) * 4;
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const x = start.x + dx * t;
      const y = start.y + dy * t;
      paintCircle(grid, x, y, radius, value);
    }
  }
}

function paintNoisePatches(grid, seed, attempts, config) {
  const rng = createRng(seed);
  for (let i = 0; i < attempts; i += 1) {
    const x = Math.floor(config.minX + rng() * Math.max(1, config.maxX - config.minX));
    const y = Math.floor(config.minY + rng() * Math.max(1, config.maxY - config.minY));
    const r = config.minRadius + rng() * (config.maxRadius - config.minRadius);
    paintEllipse(grid, x, y, r * (0.8 + rng() * 0.5), r * (0.7 + rng() * 0.5), config.value);
  }
}

function worldFromCell(cellX, cellY, offsetX = 0.5, offsetY = 0.5) {
  return {
    x: Math.round((cellX + offsetX) * WORLD_TILE_SIZE),
    y: Math.round((cellY + offsetY) * WORLD_TILE_SIZE)
  };
}

function portalFromCell(cellX, cellY, size = 120) {
  const point = worldFromCell(cellX, cellY, 0.12, 0.12);
  return {
    x: Math.max(0, Math.min(WORLD_SIZE - size, point.x)),
    y: Math.max(0, Math.min(WORLD_SIZE - size, point.y)),
    w: size,
    h: size
  };
}

function mergeCollisionRects(grid) {
  const rects = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    let x = 0;
    while (x < GRID_SIZE) {
      if (!getCell(grid, x, y)) {
        x += 1;
        continue;
      }
      const startX = x;
      while (x < GRID_SIZE && getCell(grid, x, y)) x += 1;
      rects.push({
        shape: 'rect',
        x: Math.round(startX * WORLD_TILE_SIZE),
        y: Math.round(y * WORLD_TILE_SIZE),
        w: Math.round((x - startX) * WORLD_TILE_SIZE),
        h: Math.round(WORLD_TILE_SIZE)
      });
    }
  }
  return rects;
}

function buildTileSvg(theme, tileKind) {
  const base = {
    city: {
      ground: ['#7b796f', '#4d4b45', '#a6a493'],
      path: ['#b9a17d', '#6f5d49', '#ddc79f'],
      liquid: ['#3d7288', '#1d3947', '#89becf'],
      bridge: ['#8c6a44', '#4b3520', '#d6b080'],
      blockerA: ['#5e5a50', '#2f2b25', '#9b9185'],
      blockerB: ['#68635d', '#332f2d', '#b2a594'],
      structure: ['#917151', '#533922', '#dbbf95']
    },
    forest: {
      ground: ['#6e8d48', '#516b33', '#90ad63'],
      path: ['#8f7754', '#6e563a', '#b59b72'],
      liquid: ['#2c7293', '#1a4660', '#61b3d4'],
      bridge: ['#7e5a34', '#4d331c', '#c18b4f'],
      blockerA: ['#325638', '#223925', '#5b8d4c'],
      blockerB: ['#5c5a4a', '#343226', '#8c866d'],
      structure: ['#82613d', '#4a321a', '#d4b079']
    },
    lava: {
      ground: ['#6d5c52', '#453830', '#927a6d'],
      path: ['#7d6f66', '#574840', '#af9e92'],
      liquid: ['#d6522a', '#7b1808', '#ffb063'],
      bridge: ['#5c514b', '#2b2320', '#9a8778'],
      blockerA: ['#2f2d34', '#141318', '#595564'],
      blockerB: ['#5b473c', '#2d211a', '#9d7c5c'],
      structure: ['#684537', '#301d16', '#c98e63']
    },
    undead: {
      ground: ['#5d6656', '#394036', '#8d9683'],
      path: ['#7f7a6f', '#4a453f', '#b7b0a3'],
      liquid: ['#4c6b54', '#1f3325', '#86b18f'],
      bridge: ['#715b48', '#38281d', '#b49368'],
      blockerA: ['#4c4a4a', '#252223', '#7b7272'],
      blockerB: ['#4a5649', '#232c22', '#7d8f7c'],
      structure: ['#75655c', '#382b25', '#c8b6aa']
    }
  }[theme];

  const palette = {
    ground: base.ground,
    path: base.path,
    liquid: base.liquid,
    bridge: base.bridge,
    blockerA: base.blockerA,
    blockerB: base.blockerB,
    structure: base.structure
  }[tileKind];

  const [fill, stroke, accent] = palette;
  const diamondTop = 156;
  const diamondMiddle = 222;
  const diamondBottom = 288;
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILESET_SIZE.width}" height="${TILESET_SIZE.height}" viewBox="0 0 ${TILESET_SIZE.width} ${TILESET_SIZE.height}">`,
    '<defs>',
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${accent}"/><stop offset="100%" stop-color="${fill}"/></linearGradient>`,
    `<linearGradient id="side" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${fill}"/><stop offset="100%" stop-color="${stroke}"/></linearGradient>`,
    '</defs>',
    `<ellipse cx="128" cy="300" rx="90" ry="22" fill="rgba(0,0,0,0.22)"/>`,
    `<polygon points="128,${diamondTop} 236,${diamondMiddle} 128,${diamondBottom} 20,${diamondMiddle}" fill="url(#g)" stroke="${stroke}" stroke-width="4"/>`
  ];

  if (tileKind === 'ground') {
    lines.push(
      `<path d="M56 ${diamondMiddle - 10} L128 ${diamondTop + 18} L200 ${diamondMiddle - 10}" fill="none" stroke="${accent}" stroke-width="8" opacity="0.25"/>`,
      `<path d="M74 ${diamondMiddle + 16} L128 ${diamondTop + 48} L182 ${diamondMiddle + 16}" fill="none" stroke="${accent}" stroke-width="6" opacity="0.16"/>`
    );
  }

  if (tileKind === 'path') {
    lines.push(
      `<path d="M46 ${diamondMiddle} Q128 ${diamondTop + 8} 210 ${diamondMiddle}" fill="none" stroke="${accent}" stroke-width="24" opacity="0.92" stroke-linecap="round"/>`,
      `<path d="M54 ${diamondMiddle + 16} Q128 ${diamondTop + 36} 202 ${diamondMiddle + 16}" fill="none" stroke="${stroke}" stroke-width="6" opacity="0.25" stroke-linecap="round"/>`
    );
  }

  if (tileKind === 'liquid') {
    lines.push(
      `<path d="M40 ${diamondMiddle - 8} C78 ${diamondTop + 18}, 176 ${diamondTop + 18}, 216 ${diamondMiddle - 8}" fill="none" stroke="${accent}" stroke-width="12" opacity="0.9" stroke-linecap="round"/>`,
      `<path d="M56 ${diamondMiddle + 18} C98 ${diamondTop + 42}, 160 ${diamondTop + 42}, 202 ${diamondMiddle + 18}" fill="none" stroke="${stroke}" stroke-width="7" opacity="0.5" stroke-linecap="round"/>`
    );
  }

  if (tileKind === 'bridge') {
    lines.push(
      `<path d="M54 ${diamondMiddle + 6} Q128 ${diamondTop + 36} 202 ${diamondMiddle + 6}" fill="none" stroke="${accent}" stroke-width="32" opacity="0.95" stroke-linecap="round"/>`
    );
    for (let i = 0; i < 6; i += 1) {
      const t = i / 5;
      const x = 68 + 120 * t;
      const y = diamondMiddle - 6 + Math.sin(t * Math.PI) * -30;
      lines.push(`<rect x="${Math.round(x)}" y="${Math.round(y)}" width="8" height="28" rx="2" fill="${stroke}" opacity="0.72"/>`);
    }
  }

  if (tileKind === 'blockerA') {
    if (theme === 'forest') {
      lines.push(
        `<rect x="116" y="214" width="24" height="42" rx="8" fill="#5e4025"/>`,
        `<circle cx="94" cy="190" r="34" fill="${accent}" stroke="${stroke}" stroke-width="4"/>`,
        `<circle cx="154" cy="182" r="38" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`,
        `<circle cx="126" cy="158" r="40" fill="${accent}" stroke="${stroke}" stroke-width="4"/>`
      );
    } else if (theme === 'lava') {
      lines.push(
        `<polygon points="88,120 124,72 144,176 112,236" fill="${accent}" stroke="${stroke}" stroke-width="5"/>`,
        `<polygon points="146,118 180,78 194,220 158,250" fill="${fill}" stroke="${stroke}" stroke-width="5"/>`,
        `<polygon points="112,196 172,178 196,248 88,256" fill="${stroke}" opacity="0.74"/>`
      );
    } else if (theme === 'undead') {
      lines.push(
        `<rect x="110" y="190" width="18" height="56" fill="#5c4738"/>`,
        `<path d="M119 110 L86 188 L107 188 L80 238 L118 196 L152 244 L135 180 L157 180 Z" fill="${fill}" stroke="${stroke}" stroke-width="5"/>`
      );
    } else {
      lines.push(
        `<polygon points="88,142 128,108 168,142 168,202 88,202" fill="${fill}" stroke="${stroke}" stroke-width="5"/>`,
        `<polygon points="72,146 128,102 184,146 128,172" fill="${accent}" stroke="${stroke}" stroke-width="5"/>`,
        `<rect x="112" y="186" width="32" height="58" fill="${stroke}" opacity="0.72"/>`
      );
    }
  }

  if (tileKind === 'blockerB') {
    if (theme === 'forest') {
      lines.push(
        `<polygon points="74,172 128,134 184,172 184,230 128,266 74,230" fill="${fill}" stroke="${stroke}" stroke-width="5"/>`,
        `<rect x="100" y="206" width="56" height="48" fill="${stroke}" opacity="0.7"/>`,
        `<rect x="118" y="214" width="20" height="32" fill="${accent}" opacity="0.8"/>`
      );
    } else if (theme === 'lava') {
      lines.push(
        `<rect x="88" y="160" width="28" height="90" fill="${accent}" stroke="${stroke}" stroke-width="4"/>`,
        `<rect x="140" y="144" width="34" height="104" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`,
        `<rect x="110" y="218" width="72" height="24" fill="${stroke}" opacity="0.84"/>`
      );
    } else if (theme === 'undead') {
      lines.push(
        `<rect x="90" y="184" width="30" height="62" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="4"/>`,
        `<rect x="130" y="172" width="34" height="74" rx="6" fill="${accent}" stroke="${stroke}" stroke-width="4"/>`,
        `<path d="M83 200 L120 160 M143 186 L176 148" stroke="#d9d4cb" stroke-width="6" opacity="0.65"/>`
      );
    } else {
      lines.push(
        `<rect x="82" y="154" width="92" height="58" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="5"/>`,
        `<rect x="102" y="184" width="52" height="62" rx="6" fill="${stroke}" opacity="0.78"/>`,
        `<path d="M92 170 H164 M92 188 H164" stroke="${accent}" stroke-width="8" opacity="0.42"/>`
      );
    }
  }

  if (tileKind === 'structure') {
    if (theme === 'forest') {
      lines.push(
        `<polygon points="84,156 128,126 172,156 172,210 84,210" fill="${fill}" stroke="${stroke}" stroke-width="5"/>`,
        `<polygon points="72,158 128,116 184,158 128,188" fill="${accent}" stroke="${stroke}" stroke-width="5"/>`,
        `<rect x="110" y="186" width="36" height="58" rx="6" fill="${stroke}" opacity="0.78"/>`
      );
    } else if (theme === 'lava') {
      lines.push(
        `<polygon points="82,170 128,140 174,170 174,216 82,216" fill="${fill}" stroke="${stroke}" stroke-width="5"/>`,
        `<polygon points="72,172 128,126 184,172 128,194" fill="${accent}" stroke="${stroke}" stroke-width="5"/>`,
        `<rect x="108" y="190" width="40" height="54" rx="6" fill="#2f2320"/>`,
        `<path d="M128 108 C146 88 164 88 174 102 C166 118 148 128 128 128 Z" fill="#ffb063" opacity="0.85"/>`
      );
    } else if (theme === 'undead') {
      lines.push(
        `<rect x="88" y="158" width="80" height="66" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="5"/>`,
        `<polygon points="76,162 128,118 180,162 128,184" fill="${accent}" stroke="${stroke}" stroke-width="5"/>`,
        `<path d="M106 198 H150" stroke="#ddd7ce" stroke-width="10" opacity="0.56"/>`
      );
    } else {
      lines.push(
        `<rect x="86" y="160" width="84" height="60" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="5"/>`,
        `<polygon points="74,164 128,122 182,164 128,190" fill="${accent}" stroke="${stroke}" stroke-width="5"/>`,
        `<rect x="114" y="192" width="28" height="52" rx="6" fill="${stroke}" opacity="0.8"/>`,
        `<circle cx="128" cy="154" r="10" fill="${accent}" opacity="0.76"/>`
      );
    }
  }

  lines.push('</svg>');
  return lines.join('');
}

function buildTilesetXml(fileName, tiles) {
  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<tileset version="1.10" tiledversion="1.11.2" name="${fileName}" tilewidth="${MAP_TILE_SIZE.width}" tileheight="${MAP_TILE_SIZE.height}" tilecount="${tiles.length}" columns="0">`,
    ' <grid orientation="orthogonal" width="1" height="1"/>'
  ];
  tiles.forEach((tile, index) => {
    parts.push(` <tile id="${index}">`);
    parts.push(`  <image source="tiles/${tile.file}" width="${TILESET_SIZE.width}" height="${TILESET_SIZE.height}"/>`);
    if (tile.collision) {
      parts.push('  <objectgroup draworder="index" id="1">');
      tile.collision.forEach((shape, shapeIndex) => {
        parts.push(`   <object id="${shapeIndex + 1}" x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}"/>`);
      });
      parts.push('  </objectgroup>');
    }
    parts.push(' </tile>');
  });
  parts.push('</tileset>');
  return parts.join('\n');
}

function buildTmj(mapCode, tilesetSource, layers) {
  return {
    compressionlevel: -1,
    height: GRID_SIZE,
    infinite: false,
    layers: layers.map((layer, index) => ({
      data: flattenGrid(layer.grid),
      height: GRID_SIZE,
      id: index + 1,
      name: layer.name,
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: GRID_SIZE,
      x: 0,
      y: 0
    })),
    nextlayerid: layers.length + 1,
    nextobjectid: 1,
    orientation: 'isometric',
    properties: [
      { name: 'mapCode', type: 'string', value: mapCode },
      { name: 'worldWidth', type: 'int', value: WORLD_SIZE },
      { name: 'worldHeight', type: 'int', value: WORLD_SIZE },
      { name: 'worldTileSize', type: 'int', value: WORLD_TILE_SIZE },
      { name: 'worldScale', type: 'float', value: 1 }
    ],
    renderorder: 'left-up',
    tiledversion: '1.11.2',
    tileheight: MAP_TILE_SIZE.height,
    tilesets: [{ firstgid: 1, source: tilesetSource }],
    tilewidth: MAP_TILE_SIZE.width,
    type: 'map',
    version: '1.10',
    width: GRID_SIZE
  };
}

function createCityLayout() {
  const ground = createGrid(1);
  const details = createGrid(0);
  const walls = createGrid(0);
  const points = {
    playerSpawn: worldFromCell(39, 42),
    forestPortal: portalFromCell(74, 39),
    npcs: {
      npc_guard_alden: worldFromCell(49, 39),
      npc_curandeira_selene: worldFromCell(30, 30),
      npc_mestre_rowan: worldFromCell(48, 30),
      npc_cidadao_marek: worldFromCell(36, 43),
      npc_ferreiro_borin: worldFromCell(28, 51),
      npc_bau_zenon: worldFromCell(45, 49),
      npc_mercadora_tessa: worldFromCell(52, 49)
    }
  };

  fillRect(walls, 0, 0, GRID_SIZE, 2, 6);
  fillRect(walls, 0, GRID_SIZE - 2, GRID_SIZE, 2, 6);
  fillRect(walls, 0, 0, 2, GRID_SIZE, 6);
  fillRect(walls, GRID_SIZE - 2, 0, 2, GRID_SIZE, 6);
  clearRect(walls, 72, 35, 8, 10);

  fillRect(ground, 8, 38, 66, 5, 2);
  fillRect(ground, 38, 8, 5, 64, 2);
  fillRect(ground, 31, 31, 17, 17, 2);
  fillRect(ground, 58, 36, 12, 8, 2);
  paintLine(ground, [
    { x: 42, y: 42 },
    { x: 54, y: 42 },
    { x: 62, y: 40 },
    { x: 74, y: 39 }
  ], 1.4, 2);
  paintLine(ground, [
    { x: 42, y: 42 },
    { x: 33, y: 50 },
    { x: 24, y: 58 }
  ], 1.2, 2);
  paintLine(ground, [
    { x: 42, y: 42 },
    { x: 31, y: 31 },
    { x: 23, y: 22 }
  ], 1.2, 2);

  paintLine(walls, [
    { x: 12, y: 19 },
    { x: 18, y: 25 },
    { x: 23, y: 31 }
  ], 1.4, 5);
  paintLine(walls, [
    { x: 11, y: 60 },
    { x: 18, y: 55 },
    { x: 26, y: 51 }
  ], 1.3, 5);
  paintLine(walls, [
    { x: 56, y: 58 },
    { x: 62, y: 53 },
    { x: 68, y: 48 }
  ], 1.2, 5);
  paintLine(walls, [
    { x: 57, y: 24 },
    { x: 63, y: 29 },
    { x: 69, y: 33 }
  ], 1.2, 5);

  fillRect(walls, 23, 23, 8, 7, 7);
  fillRect(walls, 46, 23, 8, 7, 7);
  fillRect(walls, 24, 49, 10, 8, 7);
  fillRect(walls, 43, 47, 11, 10, 7);
  fillRect(walls, 56, 46, 9, 8, 7);
  fillRect(walls, 58, 35, 8, 5, 7);
  fillRect(walls, 64, 34, 4, 4, 5);
  paintEllipse(walls, 41, 40, 3.6, 3.2, 6);
  clearRect(walls, 32, 32, 16, 16);
  clearRect(walls, 38, 8, 5, 64);
  clearRect(walls, 8, 38, 66, 5);
  clearRect(walls, 72, 35, 8, 10);

  return {
    name: 'Citadela de Alder',
    notes: [
      'Cidade inicial murada com praca central e servicos principais.',
      'Portao leste conecta a trilha da floresta.',
      'Mercado, ferreiro, curandeira e bau ficam concentrados no hub.'
    ],
    layers: [
      { name: 'ground', grid: ground },
      { name: 'details', grid: details },
      { name: 'walls', grid: walls }
    ],
    points
  };
}

function createForestLayout() {
  const ground = createGrid(1);
  const details = createGrid(0);
  const walls = createGrid(0);
  const points = {
    cityPortal: portalFromCell(2, 42),
    dungeonPortal: portalFromCell(36, 17),
    lavaPortal: portalFromCell(76, 39),
    eventCenter: worldFromCell(55, 34),
    mobZones: {
      outskirts: worldFromCell(19, 50),
      bridge: worldFromCell(39, 43),
      ruins: worldFromCell(35, 15)
    },
    npcs: {
      npc_scout_lina: worldFromCell(23, 36),
      npc_dungeon_warden: worldFromCell(33, 23)
    }
  };

  fillRect(walls, 0, 0, GRID_SIZE, 2, 5);
  fillRect(walls, 0, GRID_SIZE - 2, GRID_SIZE, 2, 5);
  fillRect(walls, 0, 0, 2, GRID_SIZE, 5);
  fillRect(walls, GRID_SIZE - 2, 0, 2, GRID_SIZE, 5);
  clearRect(walls, 0, 36, 4, 12);
  clearRect(walls, 74, 34, 6, 11);

  paintLine(walls, [
    { x: 38, y: -2 },
    { x: 39, y: 12 },
    { x: 40, y: 24 },
    { x: 39, y: 36 },
    { x: 37, y: 48 },
    { x: 35, y: 82 }
  ], 3.4, 3);
  clearRect(walls, 37, 40, 6, 7);
  fillRect(ground, 37, 40, 6, 7, 4);

  paintLine(ground, [
    { x: 2, y: 42 },
    { x: 18, y: 43 },
    { x: 28, y: 43 },
    { x: 40, y: 43 },
    { x: 55, y: 42 },
    { x: 67, y: 41 },
    { x: 76, y: 39 }
  ], 1.8, 2);
  paintLine(ground, [
    { x: 28, y: 42 },
    { x: 31, y: 37 },
    { x: 33, y: 31 },
    { x: 35, y: 24 },
    { x: 36, y: 17 }
  ], 1.5, 2);
  paintLine(ground, [
    { x: 46, y: 41 },
    { x: 51, y: 38 },
    { x: 55, y: 34 }
  ], 1.2, 2);

  clearRect(walls, 4, 34, 18, 18);
  fillRect(walls, 8, 37, 4, 4, 7);
  fillRect(walls, 14, 38, 4, 4, 7);
  fillRect(walls, 9, 44, 5, 4, 7);
  fillRect(walls, 34, 12, 6, 4, 6);
  fillRect(walls, 31, 21, 4, 4, 6);
  fillRect(walls, 53, 32, 5, 5, 6);

  paintNoisePatches(walls, 'forest-border-xl', 42, { minX: 4, maxX: 78, minY: 4, maxY: 76, minRadius: 1.4, maxRadius: 3.6, value: 5 });
  clearRect(walls, 0, 36, 28, 16);
  clearRect(walls, 23, 14, 16, 32);
  clearRect(walls, 37, 37, 24, 12);
  clearRect(walls, 71, 33, 9, 13);

  return {
    name: 'Bosque de Alder',
    notes: [
      'Trilha de entrada a partir da cidade com acampamento de fronteira.',
      'Rio largo corta o bioma e obriga passagem pela ponte principal.',
      'Ruinas ao norte e rota para lava ao leste.'
    ],
    layers: [
      { name: 'ground', grid: ground },
      { name: 'details', grid: details },
      { name: 'walls', grid: walls }
    ],
    points
  };
}

function createLavaLayout() {
  const ground = createGrid(1);
  const details = createGrid(0);
  const walls = createGrid(0);
  const points = {
    forestPortal: portalFromCell(2, 44),
    undeadPortal: portalFromCell(76, 29),
    lavaBridge: worldFromCell(39, 38),
    outpost: worldFromCell(15, 52)
  };

  fillRect(walls, 0, 0, GRID_SIZE, 2, 5);
  fillRect(walls, 0, GRID_SIZE - 2, GRID_SIZE, 2, 5);
  fillRect(walls, 0, 0, 2, GRID_SIZE, 5);
  fillRect(walls, GRID_SIZE - 2, 0, 2, GRID_SIZE, 5);
  clearRect(walls, 0, 38, 4, 12);
  clearRect(walls, 74, 24, 6, 11);

  paintEllipse(walls, 36, 44, 10, 8, 3);
  paintEllipse(walls, 57, 29, 9, 7, 3);
  paintEllipse(walls, 19, 22, 7, 5, 3);
  paintNoisePatches(walls, 'lava-ridges-xl', 34, { minX: 4, maxX: 78, minY: 4, maxY: 76, minRadius: 1.6, maxRadius: 3.7, value: 5 });

  paintLine(ground, [
    { x: 2, y: 44 },
    { x: 15, y: 52 },
    { x: 27, y: 47 },
    { x: 39, y: 38 },
    { x: 53, y: 34 },
    { x: 66, y: 32 },
    { x: 76, y: 29 }
  ], 1.7, 2);
  fillRect(ground, 36, 37, 7, 4, 4);
  clearRect(walls, 36, 37, 7, 4);
  clearRect(walls, 7, 46, 18, 13);
  fillRect(walls, 10, 49, 5, 4, 7);
  fillRect(walls, 16, 50, 4, 4, 7);
  fillRect(walls, 33, 24, 5, 4, 6);
  fillRect(walls, 59, 24, 5, 5, 6);
  fillRect(walls, 44, 51, 4, 4, 6);
  clearRect(walls, 2, 40, 40, 22);
  clearRect(walls, 34, 33, 18, 10);
  clearRect(walls, 70, 24, 10, 12);

  return {
    name: 'Corredor de Cinzas',
    notes: [
      'Planicie vulcanica maior com pontes basalticas e crateras abertas.',
      'A trilha segura conecta floresta, passagem central e acesso ao ermo.',
      'Sem servicos, apenas hostis e pontos de risco.'
    ],
    layers: [
      { name: 'ground', grid: ground },
      { name: 'details', grid: details },
      { name: 'walls', grid: walls }
    ],
    points
  };
}

function createUndeadLayout() {
  const ground = createGrid(1);
  const details = createGrid(0);
  const walls = createGrid(0);
  const points = {
    lavaPortal: portalFromCell(2, 48),
    graveyard: worldFromCell(57, 24),
    mausoleum: worldFromCell(69, 34)
  };

  fillRect(walls, 0, 0, GRID_SIZE, 2, 5);
  fillRect(walls, 0, GRID_SIZE - 2, GRID_SIZE, 2, 5);
  fillRect(walls, 0, 0, 2, GRID_SIZE, 5);
  fillRect(walls, GRID_SIZE - 2, 0, 2, GRID_SIZE, 5);
  clearRect(walls, 0, 42, 4, 12);

  paintEllipse(walls, 24, 42, 11, 7, 3);
  paintEllipse(walls, 53, 30, 11, 8, 3);
  paintEllipse(walls, 67, 18, 7, 6, 3);
  paintNoisePatches(walls, 'undead-mire-xl', 30, { minX: 4, maxX: 78, minY: 4, maxY: 76, minRadius: 1.4, maxRadius: 3.4, value: 5 });

  paintLine(ground, [
    { x: 2, y: 48 },
    { x: 16, y: 47 },
    { x: 29, y: 43 },
    { x: 42, y: 37 },
    { x: 57, y: 24 },
    { x: 69, y: 34 }
  ], 1.7, 2);
  fillRect(ground, 41, 36, 5, 4, 4);
  clearRect(walls, 41, 36, 5, 4);
  clearRect(walls, 2, 42, 24, 12);
  fillRect(walls, 54, 21, 6, 5, 6);
  fillRect(walls, 67, 31, 5, 5, 7);
  fillRect(walls, 44, 49, 5, 4, 6);
  clearRect(walls, 0, 40, 40, 18);
  clearRect(walls, 45, 19, 20, 12);
  clearRect(walls, 61, 29, 14, 10);

  return {
    name: 'Ermo dos Caidos',
    notes: [
      'Pantanoso, amplo e hostil, com um eixo principal ate o mausoleu.',
      'Cemiterio e areas secas criam bolsos de combate legiveis.',
      'Nenhum servico, apenas atmosfera, alvos e pressao de progressao.'
    ],
    layers: [
      { name: 'ground', grid: ground },
      { name: 'details', grid: details },
      { name: 'walls', grid: walls }
    ],
    points
  };
}

const MAP_DEFS = [
  {
    mapCode: 'A0',
    mapKey: 'city',
    fileBase: 'a0',
    theme: 'city',
    layout: createCityLayout,
    tiles: [
      { file: 'city_ground_flagstone.svg', kind: 'ground' },
      { file: 'city_path_avenue.svg', kind: 'path' },
      { file: 'city_water_canal.svg', kind: 'liquid', collision: [{ x: 36, y: 212, w: 184, h: 72 }] },
      { file: 'city_bridge_stone.svg', kind: 'bridge' },
      { file: 'city_wall_gate.svg', kind: 'blockerA', collision: [{ x: 46, y: 216, w: 164, h: 82 }] },
      { file: 'city_statue_market.svg', kind: 'blockerB', collision: [{ x: 60, y: 216, w: 136, h: 74 }] },
      { file: 'city_house_hub.svg', kind: 'structure', collision: [{ x: 58, y: 214, w: 142, h: 82 }] }
    ]
  },
  {
    mapCode: 'A1',
    mapKey: 'forest',
    fileBase: 'a1',
    theme: 'forest',
    layout: createForestLayout,
    tiles: [
      { file: 'forest_ground_meadow.svg', kind: 'ground' },
      { file: 'forest_path_trail.svg', kind: 'path' },
      { file: 'forest_water_river.svg', kind: 'liquid', collision: [{ x: 36, y: 212, w: 184, h: 72 }] },
      { file: 'forest_bridge_wood.svg', kind: 'bridge' },
      { file: 'forest_blocker_tree.svg', kind: 'blockerA', collision: [{ x: 46, y: 216, w: 164, h: 82 }] },
      { file: 'forest_ruins_stone.svg', kind: 'blockerB', collision: [{ x: 60, y: 216, w: 136, h: 74 }] },
      { file: 'forest_house_hub.svg', kind: 'structure', collision: [{ x: 58, y: 214, w: 142, h: 82 }] }
    ]
  },
  {
    mapCode: 'A2',
    mapKey: 'lava',
    fileBase: 'a2',
    theme: 'lava',
    layout: createLavaLayout,
    tiles: [
      { file: 'lava_ground_ash.svg', kind: 'ground' },
      { file: 'lava_path_basalt.svg', kind: 'path' },
      { file: 'lava_pool_core.svg', kind: 'liquid', collision: [{ x: 34, y: 212, w: 188, h: 72 }] },
      { file: 'lava_bridge_chain.svg', kind: 'bridge' },
      { file: 'lava_obsidian_spires.svg', kind: 'blockerA', collision: [{ x: 58, y: 212, w: 144, h: 84 }] },
      { file: 'lava_ruins_cracked.svg', kind: 'blockerB', collision: [{ x: 62, y: 214, w: 134, h: 80 }] },
      { file: 'lava_forge_outpost.svg', kind: 'structure', collision: [{ x: 52, y: 214, w: 152, h: 82 }] }
    ]
  },
  {
    mapCode: 'A3',
    mapKey: 'undead',
    fileBase: 'a3',
    theme: 'undead',
    layout: createUndeadLayout,
    tiles: [
      { file: 'undead_ground_mire.svg', kind: 'ground' },
      { file: 'undead_path_bone_road.svg', kind: 'path' },
      { file: 'undead_swamp_blackwater.svg', kind: 'liquid', collision: [{ x: 30, y: 212, w: 196, h: 72 }] },
      { file: 'undead_bridge_planks.svg', kind: 'bridge' },
      { file: 'undead_dead_tree_cluster.svg', kind: 'blockerA', collision: [{ x: 54, y: 212, w: 150, h: 84 }] },
      { file: 'undead_graveyard_cluster.svg', kind: 'blockerB', collision: [{ x: 58, y: 216, w: 144, h: 78 }] },
      { file: 'undead_mausoleum.svg', kind: 'structure', collision: [{ x: 56, y: 214, w: 148, h: 82 }] }
    ]
  }
];

function generateMapFiles(mapDef) {
  const mapDir = path.join(MAPS_ROOT, mapDef.mapCode);
  const tileDir = path.join(mapDir, 'tiles');
  ensureDir(tileDir);
  const layout = mapDef.layout();
  mapDef.tiles.forEach((tile) => {
    writeFileIfChanged(path.join(tileDir, tile.file), buildTileSvg(mapDef.theme, tile.kind));
  });

  const tsxName = `${mapDef.fileBase}.tsx`;
  writeFileIfChanged(path.join(mapDir, tsxName), buildTilesetXml(`${mapDef.fileBase}_tileset`, mapDef.tiles));
  writeFileIfChanged(path.join(mapDir, `${mapDef.fileBase}.tmj`), buildTmj(mapDef.mapCode, tsxName, layout.layers));
  writeFileIfChanged(path.join(mapDir, 'reference.json'), {
    mapCode: mapDef.mapCode,
    mapKey: mapDef.mapKey,
    name: layout.name,
    source: 'procedural-isometric-generator-v2',
    notes: layout.notes,
    worldSize: { width: WORLD_SIZE, height: WORLD_SIZE }
  });
  writeFileIfChanged(path.join(mapDir, 'spawns.json'), layout.points);
  writeFileIfChanged(path.join(mapDir, 'collision.json'), {
    mapCode: mapDef.mapCode,
    generatedFrom: 'walls-layer',
    shapes: mergeCollisionRects(layout.layers.find((entry) => entry.name === 'walls').grid)
  });
}

function main() {
  MAP_DEFS.forEach(generateMapFiles);
  process.stdout.write(`Generated ${MAP_DEFS.length} overworld maps in ${MAPS_ROOT}\n`);
}

main();
