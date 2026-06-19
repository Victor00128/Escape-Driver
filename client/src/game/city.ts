// ============================================================================
// CIUDAD PROCEDURAL — cuadrícula de avenidas con manzanas de edificios,
// parques, estacionamientos, plazas y agua. Todo sólido = obstáculos reales.
// ============================================================================

export const MAP = 3600;
export const BLOCK = 600; // separación entre ejes de avenida (manzanas amplias)
export const ROAD_W = 200; // ancho de calzada — avenidas anchas, menos choques
export const SIDEWALK = 34; // acera transitable que aleja los edificios de la calle

export type SolidKind = "building" | "tree" | "car" | "fountain" | "water";

export interface Solid {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: SolidKind;
  color: string;
  roof?: string;
  seed?: number;
}

export type LotGround = "grass" | "parking" | "plaza" | "water" | "concrete";

export interface Lot {
  x: number;
  y: number;
  w: number;
  h: number;
  ground: LotGround;
}

export interface City {
  seed: number;
  lots: Lot[];
  solids: Solid[];
  cols: number; // número de ejes (gridlines)
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BUILDING_COLORS = [
  "#2a2d44",
  "#243044",
  "#2e2740",
  "#22293a",
  "#332b3e",
  "#283a3a",
  "#3a2e2e",
  "#2b3550",
];
const CAR_COLORS = ["#c0392b", "#2980b9", "#27ae60", "#f1c40f", "#ecf0f1", "#8e44ad", "#e67e22"];

export function buildCity(seed: number): City {
  const rnd = mulberry32(seed);
  const lots: Lot[] = [];
  const solids: Solid[] = [];
  const cols = Math.round(MAP / BLOCK); // manzanas por lado (las avenidas tilean todo el mapa)
  const blocks = cols;

  // manzana central reservada para el spawn del jugador (plaza despejada)
  const centerBlock = Math.floor(blocks / 2);

  for (let i = 0; i < blocks; i++) {
    for (let j = 0; j < blocks; j++) {
      const x0 = i * BLOCK + ROAD_W / 2;
      const y0 = j * BLOCK + ROAD_W / 2;
      const w = BLOCK - ROAD_W;
      const h = BLOCK - ROAD_W;
      const ix = x0 + SIDEWALK;
      const iy = y0 + SIDEWALK;
      const iw = w - SIDEWALK * 2;
      const ih = h - SIDEWALK * 2;

      const isCenter =
        Math.abs(i - centerBlock) <= 0 && Math.abs(j - centerBlock) <= 0;

      const roll = rnd();
      let ground: LotGround = "concrete";

      if (isCenter) {
        // plaza central despejada con una fuente
        ground = "plaza";
        lots.push({ x: x0, y: y0, w, h, ground });
        solids.push({
          x: ix + iw / 2 - 26,
          y: iy + ih / 2 - 26,
          w: 52,
          h: 52,
          kind: "fountain",
          color: "#3b4a6b",
        });
        continue;
      }

      if (roll < 0.46) {
        // ---- manzana de edificios ----
        ground = "concrete";
        lots.push({ x: x0, y: y0, w, h, ground });
        // subdividir el lote en 1..4 edificios, con bastante margen
        const splitsX = 1 + Math.floor(rnd() * 2);
        const splitsY = 1 + Math.floor(rnd() * 2);
        const gap = 22;
        const cellW = (iw - gap * (splitsX - 1)) / splitsX;
        const cellH = (ih - gap * (splitsY - 1)) / splitsY;
        for (let a = 0; a < splitsX; a++) {
          for (let b = 0; b < splitsY; b++) {
            if (rnd() < 0.15) continue; // hueco ocasional (patio)
            const pad = 8 + rnd() * 12; // mayor retiro del borde de la manzana
            const bx = ix + a * (cellW + gap) + pad;
            const by = iy + b * (cellH + gap) + pad;
            const bw = cellW - pad * 2;
            const bh = cellH - pad * 2;
            if (bw < 30 || bh < 30) continue;
            const base = BUILDING_COLORS[Math.floor(rnd() * BUILDING_COLORS.length)];
            solids.push({
              x: bx,
              y: by,
              w: bw,
              h: bh,
              kind: "building",
              color: base,
              roof: shade(base, 1.35),
              seed: Math.floor(rnd() * 99999),
            });
          }
        }
      } else if (roll < 0.7) {
        // ---- parque (transitable, pocos árboles dispersos) ----
        ground = "grass";
        lots.push({ x: x0, y: y0, w, h, ground });
        const trees = 2 + Math.floor(rnd() * 3);
        for (let n = 0; n < trees; n++) {
          const tw = 24 + rnd() * 12;
          solids.push({
            x: ix + rnd() * (iw - tw),
            y: iy + rnd() * (ih - tw),
            w: tw,
            h: tw,
            kind: "tree",
            color: rnd() < 0.5 ? "#1f5132" : "#256b3a",
          });
        }
      } else if (roll < 0.85) {
        // ---- estacionamiento ----
        ground = "parking";
        lots.push({ x: x0, y: y0, w, h, ground });
        const rows = 2;
        const cw = 30;
        const cols2 = Math.floor(iw / (cw + 4));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols2; c++) {
            if (rnd() < 0.55) continue;
            solids.push({
              x: ix + c * (cw + 4) + 4,
              y: iy + (r === 0 ? 6 : ih - 22 - 6),
              w: cw - 6,
              h: 22,
              kind: "car",
              color: CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)],
            });
          }
        }
      } else if (roll < 0.94) {
        // ---- plaza abierta (transitable, solo una fuente al centro) ----
        ground = "plaza";
        lots.push({ x: x0, y: y0, w, h, ground });
        solids.push({
          x: ix + iw / 2 - 24,
          y: iy + ih / 2 - 24,
          w: 48,
          h: 48,
          kind: "fountain",
          color: "#3b4a6b",
        });
      } else {
        // ---- lago / agua (obstáculo grande) ----
        ground = "water";
        lots.push({ x: x0, y: y0, w, h, ground });
        solids.push({
          x: ix,
          y: iy,
          w: iw,
          h: ih,
          kind: "water",
          color: "#0e2a4a",
        });
      }
    }
  }

  return { seed, lots, solids, cols };
}

// aclara/oscurece un color hex por un factor
function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  r = Math.min(255, Math.round(r * f));
  g = Math.min(255, Math.round(g * f));
  b = Math.min(255, Math.round(b * f));
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

// posición de spawn del jugador: centro de la plaza central, sobre una avenida
export function playerSpawn(): { x: number; y: number } {
  const cols = Math.round(MAP / BLOCK);
  const centerEje = Math.round(cols / 2);
  return { x: centerEje * BLOCK, y: centerEje * BLOCK };
}

// ¿el punto cae sobre una avenida (transitable)?
export function onRoad(x: number, y: number): boolean {
  const mx = ((x % BLOCK) + BLOCK) % BLOCK;
  const my = ((y % BLOCK) + BLOCK) % BLOCK;
  const half = ROAD_W / 2;
  return mx < half || mx > BLOCK - half || my < half || my > BLOCK - half;
}

// punto aleatorio sobre la red de avenidas (para monedas / power-ups / spawns)
export function randomRoadPoint(rnd: () => number): { x: number; y: number } {
  const cols = Math.round(MAP / BLOCK);
  if (rnd() < 0.5) {
    const eje = Math.floor(rnd() * (cols + 1)) * BLOCK;
    return { x: eje, y: ROAD_W + rnd() * (MAP - ROAD_W * 2) };
  } else {
    const eje = Math.floor(rnd() * (cols + 1)) * BLOCK;
    return { x: ROAD_W + rnd() * (MAP - ROAD_W * 2), y: eje };
  }
}
