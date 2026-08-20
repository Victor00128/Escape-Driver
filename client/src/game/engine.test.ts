import { beforeEach, describe, expect, it } from "vitest";
import {
  CAR,
  DIFFS,
  MAP,
  createGame,
  simulate,
  type Diff,
  type Game,
} from "./engine";
import type { GameAudio } from "./audio";
import type { CarPaint } from "./vehicles";

// El motor guarda récords y logros en localStorage y habla con el audio.
// Ni uno ni otro existen en Node, así que se sustituyen por dobles inertes:
// las pruebas van de física y reglas, no de efectos de navegador.
const almacen = new Map<string, string>();

beforeEach(() => {
  almacen.clear();
  (globalThis as any).localStorage = {
    getItem: (k: string) => almacen.get(k) ?? null,
    setItem: (k: string, v: string) => almacen.set(k, v),
    removeItem: (k: string) => almacen.delete(k),
    clear: () => almacen.clear(),
  };
});

function audioMudo(): GameAudio {
  return {
    play: () => {},
    updateDrive: () => {},
    startDrive: () => {},
    stopDrive: () => {},
    stopAll: () => {},
    setPaused: () => {},
    init: () => {},
    resume: () => {},
    toggleMute: () => false,
    isMuted: () => true,
  } as unknown as GameAudio;
}

const PINTURA = {
  body: "#e11",
  roof: "#111",
  glass: "#9cf",
} as unknown as CarPaint;

function nuevaPartida(diff: Diff = "normal"): Game {
  return createGame(diff, PINTURA, []);
}

/** Avanza n fotogramas manteniendo pulsadas las teclas dadas. */
function avanzar(g: Game, fotogramas: number, teclas: string[] = []) {
  const set = new Set(teclas);
  const audio = audioMudo();
  for (let i = 0; i < fotogramas; i++) simulate(g, 1, set, audio);
}

describe("createGame", () => {
  it("arranca en marcha, con tres vidas y una estrella", () => {
    const g = nuevaPartida();
    expect(g.phase).toBe("playing");
    expect(g.lives).toBe(3);
    expect(g.stars).toBe(1);
    expect(g.score).toBe(0);
  });

  it("da protección inicial para no morir nada más aparecer", () => {
    expect(nuevaPartida().invincible).toBeGreaterThan(0);
  });

  it("coloca al jugador y a la policía dentro del mapa", () => {
    const g = nuevaPartida("impossible");
    expect(g.player.x).toBeGreaterThanOrEqual(0);
    expect(g.player.x).toBeLessThanOrEqual(MAP);
    for (const cop of g.cops) {
      expect(cop.x).toBeGreaterThanOrEqual(CAR);
      expect(cop.x).toBeLessThanOrEqual(MAP - CAR);
      expect(cop.y).toBeGreaterThanOrEqual(CAR);
      expect(cop.y).toBeLessThanOrEqual(MAP - CAR);
    }
  });

  it("respeta el número de policías de cada dificultad", () => {
    for (const diff of ["normal", "hard", "impossible"] as Diff[]) {
      expect(nuevaPartida(diff).cops).toHaveLength(DIFFS[diff].cops);
    }
  });

  it("ninguna policía aparece encima del jugador", () => {
    const g = nuevaPartida("impossible");
    for (const cop of g.cops) {
      const d = Math.hypot(cop.x - g.player.x, cop.y - g.player.y);
      expect(d).toBeGreaterThan(CAR * 4);
    }
  });
});

describe("DIFFS", () => {
  it("cada escalón es más duro que el anterior", () => {
    expect(DIFFS.normal.cops).toBeLessThan(DIFFS.hard.cops);
    expect(DIFFS.hard.cops).toBeLessThan(DIFFS.impossible.cops);
    expect(DIFFS.normal.spd).toBeLessThan(DIFFS.hard.spd);
    expect(DIFFS.hard.spd).toBeLessThan(DIFFS.impossible.spd);
    // y dura más, que es lo que lo hace difícil de verdad
    expect(DIFFS.normal.time).toBeLessThan(DIFFS.hard.time);
    expect(DIFFS.hard.time).toBeLessThan(DIFFS.impossible.time);
  });

  it("nunca deja el tope de coches por debajo de los iniciales", () => {
    for (const cfg of Object.values(DIFFS)) {
      expect(cfg.max).toBeGreaterThanOrEqual(cfg.cops);
    }
  });
});

describe("física del jugador", () => {
  it("acelerar aumenta la velocidad", () => {
    const g = nuevaPartida();
    avanzar(g, 10, ["arrowup"]);
    expect(g.player.speed).toBeGreaterThan(0);
  });

  it("la velocidad tiene tope aunque se acelere mucho rato", () => {
    const g = nuevaPartida();
    avanzar(g, 600, ["w"]);
    // sin turbo el tope son 14; se comprueba con holgura por si cambia la cifra
    expect(g.player.speed).toBeLessThanOrEqual(15);
  });

  it("soltar el acelerador frena por rozamiento hasta parar", () => {
    const g = nuevaPartida();
    avanzar(g, 30, ["arrowup"]);
    const enMarcha = g.player.speed;
    expect(enMarcha).toBeGreaterThan(1);
    avanzar(g, 600);
    expect(g.player.speed).toBe(0);
  });

  it("frenar desde parado da marcha atrás, no velocidad positiva", () => {
    const g = nuevaPartida();
    avanzar(g, 40, ["arrowdown"]);
    expect(g.player.speed).toBeLessThan(0);
  });

  it("girar cambia el ángulo solo si el coche se mueve", () => {
    const parado = nuevaPartida();
    const anguloInicial = parado.player.angle;
    avanzar(parado, 20, ["arrowleft"]);
    expect(parado.player.angle).toBe(anguloInicial);

    const enMarcha = nuevaPartida();
    avanzar(enMarcha, 20, ["arrowup"]);
    const antes = enMarcha.player.angle;
    avanzar(enMarcha, 20, ["arrowup", "arrowleft"]);
    expect(enMarcha.player.angle).not.toBe(antes);
  });

  it("el jugador nunca se sale del mapa por mucho que empuje", () => {
    const g = nuevaPartida();
    // apuntar a una esquina y mantener el acelerador un buen rato
    g.player.angle = Math.PI * 1.25;
    avanzar(g, 1200, ["arrowup"]);
    expect(g.player.x).toBeGreaterThanOrEqual(0);
    expect(g.player.y).toBeGreaterThanOrEqual(0);
    expect(g.player.x).toBeLessThanOrEqual(MAP);
    expect(g.player.y).toBeLessThanOrEqual(MAP);
  });

  it("derrapar exige ir lanzado: parado no cuenta tiempo de drift", () => {
    const g = nuevaPartida();
    avanzar(g, 20, [" "]);
    expect(g.driftTime).toBe(0);

    avanzar(g, 40, ["arrowup"]);
    avanzar(g, 20, ["arrowup", " "]);
    expect(g.driftTime).toBeGreaterThan(0);
  });
});

describe("reloj y final de partida", () => {
  it("el tiempo baja al simular", () => {
    const g = nuevaPartida();
    const inicial = g.time;
    avanzar(g, 60);
    expect(g.time).toBeLessThan(inicial);
  });

  it("aguantar hasta que se acaba el tiempo es victoria", () => {
    const g = nuevaPartida();
    g.time = 20; // a punto de cumplirse
    avanzar(g, 3);
    expect(g.phase).toBe("won");
    expect(g.time).toBe(0);
  });

  it("al ganar sin perder vidas se desbloquea Intocable", () => {
    const g = nuevaPartida();
    g.time = 20;
    g.lostLives = 0;
    avanzar(g, 3);
    expect(g.achievements).toContain("untouchable");
  });

  it("al ganar habiendo perdido una vida NO se desbloquea Intocable", () => {
    const g = nuevaPartida();
    g.time = 20;
    g.lostLives = 1;
    avanzar(g, 3);
    expect(g.achievements).not.toContain("untouchable");
  });

  it("una partida terminada guarda la puntuación como récord", () => {
    const g = nuevaPartida();
    g.time = 20;
    g.score = 4200;
    avanzar(g, 3);
    expect(almacen.get("escape_hs")).toBe("4200");
  });

  it("no rebaja un récord anterior más alto", () => {
    almacen.set("escape_hs", "9999");
    const g = nuevaPartida();
    g.time = 20;
    g.score = 100;
    avanzar(g, 3);
    expect(almacen.get("escape_hs")).toBe("9999");
  });
});

describe("nivel de búsqueda", () => {
  it("sube con el tiempo sobrevivido", () => {
    const g = nuevaPartida();
    expect(g.stars).toBe(1);
    g.surviveTime = 61000;
    avanzar(g, 1);
    expect(g.stars).toBeGreaterThanOrEqual(3);
  });

  it("sube también a base de destruir policías", () => {
    const g = nuevaPartida();
    g.copsDestroyed = 10;
    avanzar(g, 1);
    expect(g.stars).toBeGreaterThanOrEqual(4);
  });

  it("nunca pasa de cinco estrellas", () => {
    const g = nuevaPartida();
    g.surviveTime = 999999;
    g.copsDestroyed = 999;
    avanzar(g, 5);
    expect(g.stars).toBeLessThanOrEqual(5);
  });

  it("nunca baja: la presión no se regala", () => {
    const g = nuevaPartida();
    g.surviveTime = 160000;
    avanzar(g, 1);
    const alcanzado = g.stars;
    g.surviveTime = 0;
    avanzar(g, 10);
    expect(g.stars).toBeGreaterThanOrEqual(alcanzado);
  });

  it("el indicador de persecución se queda entre 0 y 1", () => {
    const g = nuevaPartida("impossible");
    g.surviveTime = 200000;
    avanzar(g, 120, ["arrowup"]);
    expect(g.wanted).toBeGreaterThanOrEqual(0);
    expect(g.wanted).toBeLessThanOrEqual(1);
  });
});

describe("estabilidad de la simulación", () => {
  it("aguanta una partida larga sin romper invariantes", () => {
    const g = nuevaPartida("hard");
    avanzar(g, 2000, ["arrowup", "arrowright"]);

    expect(Number.isFinite(g.player.x)).toBe(true);
    expect(Number.isFinite(g.player.y)).toBe(true);
    expect(Number.isFinite(g.player.speed)).toBe(true);
    expect(g.lives).toBeLessThanOrEqual(3);
    expect(g.score).toBeGreaterThanOrEqual(0);
    expect(["playing", "won", "over"]).toContain(g.phase);
  });

  it("no deja crecer las partículas sin límite", () => {
    const g = nuevaPartida();
    avanzar(g, 1500, ["arrowup", " "]);
    expect(g.particles.length).toBeLessThanOrEqual(500);
  });

  it("no deja crecer las marcas de derrape sin límite", () => {
    const g = nuevaPartida();
    avanzar(g, 1500, ["arrowup", " "]);
    expect(g.skids.length).toBeLessThanOrEqual(400);
  });

  it("respeta el tope de policías de la dificultad", () => {
    const g = nuevaPartida("normal");
    g.surviveTime = 200000;
    avanzar(g, 1500, ["arrowup"]);
    expect(g.cops.length).toBeLessThanOrEqual(DIFFS.normal.max);
  });
});
