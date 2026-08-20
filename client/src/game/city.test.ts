import { describe, expect, it } from "vitest";
import { BLOCK, MAP, buildCity, playerSpawn, randomRoadPoint } from "./city";

/** PRNG determinista para no depender de Math.random en las pruebas. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("buildCity", () => {
  it("es determinista: la misma semilla da el mismo mapa", () => {
    expect(buildCity(1234)).toEqual(buildCity(1234));
  });

  it("semillas distintas dan mapas distintos", () => {
    const a = buildCity(1);
    const b = buildCity(2);
    expect(a.lots).not.toEqual(b.lots);
  });

  it("no genera sólidos: la arena es libre y solo choca el borde", () => {
    for (const seed of [0, 7, 99, 4321]) {
      expect(buildCity(seed).solids).toEqual([]);
    }
  });

  it("mantiene todas las parcelas dentro del mapa", () => {
    const { lots } = buildCity(2026);
    for (const lot of lots) {
      expect(lot.x).toBeGreaterThanOrEqual(0);
      expect(lot.y).toBeGreaterThanOrEqual(0);
      expect(lot.x + lot.w).toBeLessThanOrEqual(MAP);
      expect(lot.y + lot.h).toBeLessThanOrEqual(MAP);
    }
  });

  it("solo usa suelos transitables", () => {
    const { lots } = buildCity(555);
    for (const lot of lots) {
      expect(["grass", "plaza"]).toContain(lot.ground);
    }
  });
});

describe("playerSpawn", () => {
  it("aparece dentro del mapa", () => {
    const { x, y } = playerSpawn();
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
    expect(x).toBeLessThan(MAP);
    expect(y).toBeLessThan(MAP);
  });

  it("aparece cerca del centro, no pegado a un borde", () => {
    const { x, y } = playerSpawn();
    const centro = MAP / 2;
    // dentro de una manzana del centro exacto
    expect(Math.abs(x - centro)).toBeLessThanOrEqual(BLOCK);
    expect(Math.abs(y - centro)).toBeLessThanOrEqual(BLOCK);
  });
});

describe("randomRoadPoint", () => {
  it("nunca cae fuera del mapa ni pegado al borde", () => {
    const rnd = seeded(9876);
    for (let i = 0; i < 500; i++) {
      const p = randomRoadPoint(rnd);
      expect(p.x).toBeGreaterThan(0);
      expect(p.y).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(MAP);
      expect(p.y).toBeLessThan(MAP);
    }
  });

  it("aguanta un generador degenerado en sus dos extremos", () => {
    // Si rnd() devolviera siempre 0 o siempre ~1, el punto sigue dentro.
    for (const valor of [0, 0.999999]) {
      const p = randomRoadPoint(() => valor);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(MAP);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(MAP);
    }
  });
});
