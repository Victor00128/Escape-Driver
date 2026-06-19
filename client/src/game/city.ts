// ============================================================================
// MAPA LIBRE — arena abierta sin obstáculos sólidos. Solo asfalto amplio con
// una cuadrícula de avenidas como referencia visual y algunas zonas decorativas
// (césped / plazas) que se pueden pisar. Nada con qué chocar salvo el borde.
// ============================================================================

export const MAP = 3600;
export const BLOCK = 600; // separación de la cuadrícula de referencia
export const ROAD_W = 200; // ancho visual de avenida
export const SIDEWALK = 34;

export type SolidKind = "building" | "tree" | "car" | "fountain" | "water";

// Se conserva el tipo por compatibilidad; en el mapa libre la lista va vacía.
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
  lots: Lot[]; // zonas decorativas transitables
  solids: Solid[]; // siempre vacío en el mapa libre
  cols: number;
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

export function buildCity(seed: number): City {
  const rnd = mulberry32(seed);
  const lots: Lot[] = [];
  const cols = Math.round(MAP / BLOCK);
  const blocks = cols;

  // La mayor parte del mapa queda abierta. Algunas manzanas reciben una zona
  // decorativa (césped o plaza) que NO bloquea — solo da variedad visual.
  for (let i = 0; i < blocks; i++) {
    for (let j = 0; j < blocks; j++) {
      const roll = rnd();
      if (roll > 0.3) continue;
      const x0 = i * BLOCK + ROAD_W / 2;
      const y0 = j * BLOCK + ROAD_W / 2;
      const w = BLOCK - ROAD_W;
      const h = BLOCK - ROAD_W;
      const ground: LotGround = roll < 0.17 ? "grass" : "plaza";
      lots.push({ x: x0, y: y0, w, h, ground });
    }
  }

  return { seed, lots, solids: [], cols };
}

// spawn del jugador: centro de la arena
export function playerSpawn(): { x: number; y: number } {
  const cols = Math.round(MAP / BLOCK);
  const centerEje = Math.round(cols / 2);
  return { x: centerEje * BLOCK, y: centerEje * BLOCK };
}

// en el mapa libre todo es transitable
export function onRoad(): boolean {
  return true;
}

// punto aleatorio en cualquier parte de la arena (monedas / power-ups / spawns)
export function randomRoadPoint(rnd: () => number): { x: number; y: number } {
  const m = 140;
  return { x: m + rnd() * (MAP - m * 2), y: m + rnd() * (MAP - m * 2) };
}
