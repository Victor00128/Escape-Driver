// ============================================================================
// MOTOR DEL JUEGO — estado mutable + simulación (física, IA, colisiones) y
// render del canvas. Desacoplado de React: corre dentro de un requestAnimationFrame.
// ============================================================================
import { GameAudio } from "./audio";
import {
  buildCity,
  City,
  MAP,
  BLOCK,
  ROAD_W,
  Solid,
  playerSpawn,
  randomRoadPoint,
} from "./city";
import { CarPaint, drawPlayerCar, drawPoliceCar, drawTrafficCar } from "./vehicles";

export { MAP } from "./city";

// ---------- constantes de física ----------
export const CAR = 36;
const MAX_SPD = 14;
const ACCEL = 0.5;
const BRAKE = 0.72;
const FRIC = 0.972;
const TURN = 0.05;
const DRIFT_FRIC = 0.86;
const DRIFT_TURN = 0.11;
const REV_SPD = 6;
const R = CAR * 0.45; // radio de colisión

export type Diff = "normal" | "hard" | "impossible";

export const DIFFS: Record<Diff, { cops: number; spd: number; time: number; spawn: number; max: number }> = {
  normal: { cops: 4, spd: 0.72, time: 120, spawn: 26, max: 9 },
  hard: { cops: 6, spd: 0.82, time: 180, spawn: 19, max: 14 },
  impossible: { cops: 8, spd: 0.92, time: 240, spawn: 13, max: 22 },
};

export const ACHIEVEMENTS = [
  { id: "first_coin", name: "Primera Moneda", desc: "Recoge tu primera moneda", icon: "🪙" },
  { id: "coin_hunter", name: "Cazador", desc: "Recoge 50 monedas", icon: "💰" },
  { id: "first_blood", name: "Primera Sangre", desc: "Destruye un policía", icon: "💥" },
  { id: "destroyer", name: "Destructor", desc: "Destruye 10 policías", icon: "🔥" },
  { id: "drift_king", name: "Rey del Drift", desc: "Driftea 30 segundos", icon: "💨" },
  { id: "close_call", name: "Por Poco", desc: "10 roces seguidos", icon: "😰" },
  { id: "survivor", name: "Superviviente", desc: "Sobrevive 2 minutos", icon: "⏱️" },
  { id: "five_stars", name: "5 Estrellas", desc: "Alcanza nivel máximo", icon: "⭐" },
  { id: "untouchable", name: "Intocable", desc: "Gana sin perder vidas", icon: "🛡️" },
  { id: "chain_reaction", name: "Reacción en Cadena", desc: "3 policías explotan a la vez", icon: "💣" },
  { id: "speed_demon", name: "Demonio de Velocidad", desc: "Vuela con el turbo a tope", icon: "🚀" },
  { id: "demolition", name: "Demolición", desc: "Destruye 25 policías", icon: "🏆" },
];

// ---------- tipos ----------
type Role = "pursuer" | "interceptor" | "flankL" | "flankR" | "blocker";

interface Cop {
  x: number; y: number; angle: number; spd: number; baseSpd: number;
  id: number; role: Role; tier: number; stuck: number;
}
interface Player {
  x: number; y: number; angle: number; speed: number;
  drifting: boolean; turbo: number; shield: number; magnet: number;
}
interface Coin { x: number; y: number; id: number; }
interface PowerUp { x: number; y: number; id: number; type: "turbo" | "shield" | "magnet" | "bomb"; }
interface Explosion { x: number; y: number; id: number; t: number; big: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: string; }
interface Skid { x: number; y: number; a: number; alpha: number; }
interface Traffic { x: number; y: number; angle: number; spd: number; color: string; id: number; }

export interface Game {
  phase: "playing" | "paused" | "won" | "over";
  city: City;
  rnd: () => number;
  paint: CarPaint;
  player: Player;
  cops: Cop[];
  coins: Coin[];
  powerUps: PowerUp[];
  explosions: Explosion[];
  particles: Particle[];
  skids: Skid[];
  traffic: Traffic[];
  lives: number;
  score: number;
  stars: number;
  mult: number;
  multTimer: number;
  coinsTotal: number;
  copsDestroyed: number;
  driftTime: number;
  nearMissStreak: number;
  maxNearMiss: number;
  time: number;
  diff: Diff;
  invincible: number;
  shake: number;
  spawnTimer: number;
  surviveTime: number;
  achievements: string[];
  newAchievement: { name: string; icon: string } | null;
  achieveTimer: number;
  lostLives: number;
  wanted: number; // 0..1 para audio de sirena y efectos
  flashHit: number;
  trafficTimer: number;
  braking: boolean;
}

// ---------- helpers matemáticos ----------
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function angDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- colisiones contra sólidos ----------
function collideSolids(solids: Solid[], x: number, y: number, r: number) {
  let nx = x, ny = y;
  let nrmx = 0, nrmy = 0, maxPen = 0;
  for (let s = 0; s < solids.length; s++) {
    const o = solids[s];
    if (nx < o.x - r || nx > o.x + o.w + r || ny < o.y - r || ny > o.y + o.h + r) continue;
    const cx = clamp(nx, o.x, o.x + o.w);
    const cy = clamp(ny, o.y, o.y + o.h);
    let dx = nx - cx, dy = ny - cy;
    let d = Math.hypot(dx, dy);
    if (d === 0) {
      const left = nx - o.x, right = o.x + o.w - nx, top = ny - o.y, bot = o.y + o.h - ny;
      const m = Math.min(left, right, top, bot);
      let ux = 0, uy = 0;
      if (m === left) ux = -1; else if (m === right) ux = 1; else if (m === top) uy = -1; else uy = 1;
      const pen = r + m;
      nx += ux * pen; ny += uy * pen;
      if (pen > maxPen) { maxPen = pen; nrmx = ux; nrmy = uy; }
    } else if (d < r) {
      const pen = r - d, ux = dx / d, uy = dy / d;
      nx += ux * pen; ny += uy * pen;
      if (pen > maxPen) { maxPen = pen; nrmx = ux; nrmy = uy; }
    }
  }
  return { x: nx, y: ny, nx: nrmx, ny: nrmy, hit: maxPen > 0 };
}

function pointBlocked(solids: Solid[], x: number, y: number, margin: number) {
  for (let s = 0; s < solids.length; s++) {
    const o = solids[s];
    if (x > o.x - margin && x < o.x + o.w + margin && y > o.y - margin && y < o.y + o.h + margin)
      return true;
  }
  return false;
}

// ---------- creación de partida ----------
export function createGame(diff: Diff, paint: CarPaint, savedAch: string[]): Game {
  const seed = (Date.now() & 0xffffff) ^ Math.floor(Math.random() * 99999);
  const city = buildCity(seed);
  const rnd = mulberry32(seed ^ 0x9e3779b9);
  const cfg = DIFFS[diff];
  const sp = playerSpawn();

  const coins: Coin[] = [];
  for (let i = 0; i < 70; i++) {
    const p = randomRoadPoint(rnd);
    coins.push({ x: p.x, y: p.y, id: i });
  }
  const powerUps: PowerUp[] = [];
  const types: PowerUp["type"][] = ["turbo", "shield", "magnet"];
  for (let i = 0; i < 6; i++) {
    const p = randomRoadPoint(rnd);
    powerUps.push({ x: p.x, y: p.y, id: i, type: types[Math.floor(rnd() * 3)] });
  }
  const bp = randomRoadPoint(rnd);
  powerUps.push({ x: bp.x, y: bp.y, id: 99, type: "bomb" });

  const cops: Cop[] = [];
  const roles: Role[] = ["pursuer", "interceptor", "flankL", "flankR", "blocker"];
  for (let i = 0; i < cfg.cops; i++) {
    const a = ((Math.PI * 2) / cfg.cops) * i;
    const dist = 520 + rnd() * 260;
    cops.push({
      x: clamp(sp.x + Math.cos(a) * dist, CAR, MAP - CAR),
      y: clamp(sp.y + Math.sin(a) * dist, CAR, MAP - CAR),
      angle: a + Math.PI,
      spd: cfg.spd, baseSpd: cfg.spd,
      id: i, role: roles[i % roles.length], tier: 0, stuck: 0,
    });
  }

  return {
    phase: "playing",
    city, rnd, paint,
    player: { x: sp.x, y: sp.y, angle: -Math.PI / 2, speed: 0, drifting: false, turbo: 0, shield: 0, magnet: 0 },
    cops, coins, powerUps,
    explosions: [], particles: [], skids: [], traffic: [],
    lives: 3, score: 0, stars: 1, mult: 1, multTimer: 0,
    coinsTotal: 0, copsDestroyed: 0, driftTime: 0,
    nearMissStreak: 0, maxNearMiss: 0,
    time: cfg.time * 1000, diff,
    invincible: 2000, shake: 0, spawnTimer: 0, surviveTime: 0, // protección al aparecer
    achievements: savedAch, newAchievement: null, achieveTimer: 0,
    lostLives: 0, wanted: 0, flashHit: 0, trafficTimer: 0, braking: false,
  };
}

function unlock(g: Game, id: string, audio: GameAudio) {
  if (g.achievements.includes(id)) return;
  const ach = ACHIEVEMENTS.find((a) => a.id === id);
  if (!ach) return;
  audio.play("achieve");
  g.achievements = [...g.achievements, id];
  localStorage.setItem("escape_achievements", JSON.stringify(g.achievements));
  g.newAchievement = { name: ach.name, icon: ach.icon };
  g.achieveTimer = 3000;
}

function addParticles(g: Game, x: number, y: number, n: number, color: string, kind: string, spread: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = spread * (0.3 + Math.random());
    g.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0, max: 250 + Math.random() * 350,
      size: 1.5 + Math.random() * 2.5, color, kind,
    });
  }
  if (g.particles.length > 500) g.particles.splice(0, g.particles.length - 500);
}

function saveHS(g: Game) {
  localStorage.setItem("escape_hs", Math.max(g.score, parseInt(localStorage.getItem("escape_hs") || "0")).toString());
}

// ============================================================================
// SIMULACIÓN — un paso de física/IA (dt en unidades de frame, 1 = 16.67ms)
// ============================================================================
export function simulate(g: Game, dt: number, keys: Set<string>, audio: GameAudio) {
  const ms = dt * 16.67;
  const solids = g.city.solids;

  g.time -= ms;
  g.surviveTime += ms;
  g.achieveTimer = Math.max(0, g.achieveTimer - ms);
  if (g.achieveTimer <= 0) g.newAchievement = null;
  g.shake = Math.max(0, g.shake - ms);
  g.flashHit = Math.max(0, g.flashHit - ms);
  g.invincible = Math.max(0, g.invincible - ms);

  // ---- victoria ----
  if (g.time <= 0) {
    saveHS(g);
    if (g.lostLives === 0) unlock(g, "untouchable", audio);
    audio.play("win"); audio.stopDrive();
    g.phase = "won"; g.time = 0; return;
  }

  // ---- física del jugador ----
  const p = g.player;
  const accelerating = keys.has("arrowup") || keys.has("w");
  const braking = keys.has("arrowdown") || keys.has("s");
  g.braking = braking && p.speed > 0.5;
  const drift = keys.has(" ") && Math.abs(p.speed) > 1.5;
  p.drifting = drift;
  if (drift) {
    g.driftTime += ms / 1000;
    // marcas de derrape en el suelo
    if (Math.random() < 0.6) {
      g.skids.push({ x: p.x - Math.cos(p.angle) * 8, y: p.y - Math.sin(p.angle) * 8, a: p.angle, alpha: 0.5 });
      if (g.skids.length > 400) g.skids.shift();
    }
    addParticles(g, p.x - Math.cos(p.angle) * 14, p.y - Math.sin(p.angle) * 14, 1, "rgba(200,200,200,0.5)", "smoke", 1.5);
  }
  p.turbo = Math.max(0, p.turbo - ms);
  p.shield = Math.max(0, p.shield - ms);
  p.magnet = Math.max(0, p.magnet - ms);

  const turboMult = p.turbo > 0 ? 1.75 : 1;
  const maxSpd = MAX_SPD * turboMult;

  if (accelerating) p.speed = Math.min(p.speed + ACCEL * dt, maxSpd);
  else if (braking) {
    if (p.speed > 0.5) p.speed = Math.max(p.speed - BRAKE * dt, 0);
    else p.speed = Math.max(p.speed - ACCEL * 0.8 * dt, -REV_SPD);
  } else {
    p.speed *= Math.pow(drift ? DRIFT_FRIC : FRIC, dt);
    if (Math.abs(p.speed) < 0.08) p.speed = 0;
  }

  if (Math.abs(p.speed) > 0.15) {
    const dir = p.speed > 0 ? 1 : -1;
    const turnRate = drift ? DRIFT_TURN : TURN;
    const spdFactor = Math.min(Math.abs(p.speed) / 5, 1);
    if (keys.has("arrowleft") || keys.has("a")) p.angle -= turnRate * spdFactor * dir * dt;
    if (keys.has("arrowright") || keys.has("d")) p.angle += turnRate * spdFactor * dir * dt;
  }

  // mover + colisión con edificios (deslizamiento)
  let mvx = Math.cos(p.angle) * p.speed, mvy = Math.sin(p.angle) * p.speed;
  let nx = p.x + mvx * dt, ny = p.y + mvy * dt;
  const res = collideSolids(solids, nx, ny, R);
  nx = res.x; ny = res.y;
  if (res.hit) {
    const dot = mvx * res.nx + mvy * res.ny;
    const impact = Math.max(0, -dot);
    if (impact > 5 && g.invincible <= 0) {
      audio.play("crash");
      g.shake = Math.max(g.shake, 180);
      addParticles(g, nx, ny, 8, "#ffcc44", "spark", impact * 0.4);
    }
    p.speed *= impact > 5 ? 0.4 : 0.82; // pierde velocidad al rozar
  }
  // límites del mapa
  if (nx < R) { nx = R; p.speed *= 0.5; }
  if (nx > MAP - R) { nx = MAP - R; p.speed *= 0.5; }
  if (ny < R) { ny = R; p.speed *= 0.5; }
  if (ny > MAP - R) { ny = MAP - R; p.speed *= 0.5; }
  p.x = nx; p.y = ny;

  // ---- audio del motor ----
  audio.updateDrive({
    speed: p.speed, maxSpeed: MAX_SPD,
    throttle: accelerating ? 1 : Math.abs(p.speed) > 0.5 ? 0.35 : 0,
    turbo: p.turbo > 0, drifting: drift, wanted: g.wanted,
  });
  if (p.turbo > 0 && Math.abs(p.speed) > MAX_SPD * 1.5) unlock(g, "speed_demon", audio);

  // ---- multiplicador ----
  g.multTimer = Math.max(0, g.multTimer - ms);
  if (g.multTimer <= 0 && g.mult > 1) { g.mult = Math.max(1, g.mult - 0.5); g.multTimer = 2000; }

  // ---- monedas (con imán) ----
  g.coins = g.coins.filter((c) => {
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (p.magnet > 0 && d < 190) {
      const ang = Math.atan2(p.y - c.y, p.x - c.x);
      c.x += Math.cos(ang) * 11 * dt; c.y += Math.sin(ang) * 11 * dt;
    }
    if (d < (p.magnet > 0 ? 42 : 28)) {
      g.coinsTotal++;
      g.score += Math.floor(15 * g.mult);
      g.mult = Math.min(g.mult + 0.3, 10); g.multTimer = 4000;
      audio.play("coin");
      addParticles(g, c.x, c.y, 4, "#ffd700", "spark", 2);
      if (g.coinsTotal === 1) unlock(g, "first_coin", audio);
      if (g.coinsTotal >= 50) unlock(g, "coin_hunter", audio);
      return false;
    }
    return true;
  });
  if (g.coins.length < 40) {
    for (let i = 0; i < 18; i++) {
      const rp = randomRoadPoint(g.rnd);
      g.coins.push({ x: rp.x, y: rp.y, id: Date.now() + i });
    }
  }

  // ---- power-ups ----
  g.powerUps = g.powerUps.filter((pu) => {
    if (Math.hypot(p.x - pu.x, p.y - pu.y) < 34) {
      audio.play("powerup");
      g.score += Math.floor(150 * g.mult);
      addParticles(g, pu.x, pu.y, 10, "#00ffff", "spark", 3);
      if (pu.type === "turbo") p.turbo = 6000;
      else if (pu.type === "shield") p.shield = 10000;
      else if (pu.type === "magnet") p.magnet = 12000;
      else if (pu.type === "bomb" && g.cops.length > 0) {
        let minD = Infinity, idx = 0;
        g.cops.forEach((c, i) => { const d = Math.hypot(p.x - c.x, p.y - c.y); if (d < minD) { minD = d; idx = i; } });
        const cop = g.cops[idx];
        g.explosions.push({ x: cop.x, y: cop.y, id: Date.now(), t: 0, big: true });
        addParticles(g, cop.x, cop.y, 18, "#ff8800", "debris", 5);
        g.cops.splice(idx, 1);
        g.copsDestroyed++;
        g.score += Math.floor(500 * g.mult);
        audio.play("explode"); g.shake = Math.max(g.shake, 250);
        if (g.copsDestroyed === 1) unlock(g, "first_blood", audio);
        if (g.copsDestroyed >= 10) unlock(g, "destroyer", audio);
        if (g.copsDestroyed >= 25) unlock(g, "demolition", audio);
      }
      return false;
    }
    return true;
  });
  if (g.powerUps.length < 4 && Math.random() < 0.005 * dt) {
    const isBomb = Math.random() < 0.12;
    const t2: PowerUp["type"][] = ["turbo", "shield", "magnet"];
    const rp = randomRoadPoint(g.rnd);
    g.powerUps.push({ x: rp.x, y: rp.y, id: Date.now(), type: isBomb ? "bomb" : t2[Math.floor(Math.random() * 3)] });
  }

  // ---- nivel de búsqueda (estrellas estilo GTA) ----
  const old = g.stars;
  if (g.surviveTime > 30000 && g.stars < 2) g.stars = 2;
  if (g.surviveTime > 60000 && g.stars < 3) g.stars = 3;
  if (g.surviveTime > 100000 && g.stars < 4) g.stars = 4;
  if (g.surviveTime > 150000 && g.stars < 5) g.stars = 5;
  if (g.copsDestroyed >= 3 && g.stars < 2) g.stars = 2;
  if (g.copsDestroyed >= 6 && g.stars < 3) g.stars = 3;
  if (g.copsDestroyed >= 10 && g.stars < 4) g.stars = 4;
  if (g.stars > old) audio.play("star");
  if (g.stars >= 5) unlock(g, "five_stars", audio);

  // ---- aparición de patrullas (presión constante) ----
  const cfg = DIFFS[g.diff];
  g.spawnTimer += ms;
  const maxCops = Math.min(cfg.max, 4 + g.stars * 2);
  const desired = Math.min(maxCops, cfg.cops + g.stars); // presencia mínima
  // si caen por debajo del mínimo, reaparecen rápido; si no, gotean hasta el máximo
  const spawnRate = g.cops.length < desired ? 1800 : (cfg.spawn * 1000) / g.stars;
  if (g.spawnTimer >= spawnRate && g.cops.length < maxCops) {
    g.spawnTimer = 0;
    // elegir el punto de avenida más lejano al jugador entre varios candidatos
    let best = randomRoadPoint(g.rnd), bestD = Math.hypot(best.x - p.x, best.y - p.y);
    for (let k = 0; k < 9; k++) {
      const c = randomRoadPoint(g.rnd);
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d > bestD) { best = c; bestD = d; }
    }
    if (bestD > 600) {
      const roles: Role[] = ["pursuer", "interceptor", "flankL", "flankR", "blocker"];
      const tier = g.stars >= 4 ? 2 : g.stars >= 3 ? 1 : 0;
      g.cops.push({
        x: best.x, y: best.y, angle: Math.atan2(p.y - best.y, p.x - best.x),
        spd: cfg.spd * (1 + g.stars * 0.08), baseSpd: cfg.spd * (1 + g.stars * 0.08),
        id: Date.now(), role: roles[g.cops.length % roles.length], tier, stuck: 0,
      });
    }
  }

  // ---- IA policial coordinada ----
  updateCops(g, dt, solids);

  // ---- choques entre patrullas ----
  let chain = 0;
  for (let i = 0; i < g.cops.length; i++) {
    for (let j = i + 1; j < g.cops.length; j++) {
      const a = g.cops[i], b = g.cops[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const rel = Math.hypot(
        Math.cos(a.angle) * a.spd - Math.cos(b.angle) * b.spd,
        Math.sin(a.angle) * a.spd - Math.sin(b.angle) * b.spd
      );
      if (d < CAR * 0.7 && rel > 0.3) {
        g.explosions.push({ x: a.x, y: a.y, id: Date.now() + i, t: 0, big: true });
        g.explosions.push({ x: b.x, y: b.y, id: Date.now() + j + 1000, t: 0, big: true });
        addParticles(g, a.x, a.y, 14, "#ff8800", "debris", 4.5);
        addParticles(g, b.x, b.y, 14, "#ff8800", "debris", 4.5);
        a.spd = -999; b.spd = -999;
        g.copsDestroyed += 2;
        g.score += Math.floor(400 * g.mult);
        audio.play("explode"); g.shake = Math.max(g.shake, 220);
        chain += 2;
      }
    }
  }
  g.cops = g.cops.filter((c) => c.spd !== -999);
  if (chain >= 3) unlock(g, "chain_reaction", audio);
  if (g.copsDestroyed >= 10) unlock(g, "destroyer", audio);
  if (g.copsDestroyed >= 25) unlock(g, "demolition", audio);

  // ---- roces y colisión con el jugador ----
  let nearest = Infinity;
  for (const cop of g.cops) {
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    nearest = Math.min(nearest, d);
    if (d < 70 && d > 40 && Math.abs(p.speed) > 3) {
      g.nearMissStreak++;
      g.maxNearMiss = Math.max(g.maxNearMiss, g.nearMissStreak);
      g.score += Math.floor(30 * g.mult * Math.min(g.nearMissStreak, 8));
      g.mult = Math.min(g.mult + 0.2, 10); g.multTimer = 4000;
      if (g.maxNearMiss >= 10) unlock(g, "close_call", audio);
    } else if (d >= 110) g.nearMissStreak = 0;

    if (g.invincible <= 0 && p.shield <= 0 && d < 32) {
      g.lives--; g.lostLives++;
      g.invincible = 2500; g.shake = 500; g.flashHit = 350;
      g.mult = 1; g.nearMissStreak = 0;
      audio.play("hit");
      g.explosions.push({ x: p.x, y: p.y, id: Date.now(), t: 0, big: false });
      addParticles(g, p.x, p.y, 12, "#ff4444", "spark", 4);
      if (g.lives <= 0) {
        saveHS(g); audio.play("lose"); audio.stopDrive(); g.phase = "over"; return;
      }
      break;
    }
  }
  // nivel de búsqueda para audio (sirena) según cercanía y estrellas
  const prox = nearest < 500 ? 1 - nearest / 500 : 0;
  g.wanted = clamp(Math.max(prox, g.stars >= 2 ? 0.35 : 0) * (0.5 + g.stars * 0.12), 0, 1);

  // ---- tráfico civil ----
  updateTraffic(g, dt, audio);

  // ---- partículas ----
  g.particles = g.particles.filter((pt) => {
    pt.life += ms;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.94; pt.vy *= 0.94;
    return pt.life < pt.max;
  });
  // marcas de derrape se desvanecen
  for (const sk of g.skids) sk.alpha -= 0.0006 * ms;
  g.skids = g.skids.filter((s) => s.alpha > 0);

  // explosiones
  g.explosions = g.explosions.map((e) => ({ ...e, t: e.t + ms })).filter((e) => e.t < (e.big ? 600 : 400));

  // logros por tiempo
  if (g.driftTime >= 30) unlock(g, "drift_king", audio);
  if (g.surviveTime >= 120000) unlock(g, "survivor", audio);
}

// ---------- IA policial ----------
function updateCops(g: Game, dt: number, solids: Solid[]) {
  const p = g.player;
  const pvx = Math.cos(p.angle) * p.speed;
  const pvy = Math.sin(p.angle) * p.speed;
  const pdir = Math.atan2(pvy, pvx);

  for (const cop of g.cops) {
    const dx = p.x - cop.x, dy = p.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;

    // objetivo según el rol -> rodean en vez de hacer fila india
    let tx = p.x, ty = p.y;
    const lead = clamp(dist / MAX_SPD, 8, 55);
    if (cop.role === "interceptor") {
      tx = p.x + pvx * lead; ty = p.y + pvy * lead;
    } else if (cop.role === "flankL" || cop.role === "flankR") {
      const side = cop.role === "flankL" ? 1 : -1;
      const ahead = 130 + Math.min(dist, 320) * 0.4;
      const off = 130;
      tx = p.x + Math.cos(pdir) * ahead + Math.cos(pdir + Math.PI / 2) * off * side;
      ty = p.y + Math.sin(pdir) * ahead + Math.sin(pdir + Math.PI / 2) * off * side;
    } else if (cop.role === "blocker") {
      const ahead = 240 + Math.abs(p.speed) * 12;
      tx = p.x + Math.cos(pdir) * ahead; ty = p.y + Math.sin(pdir) * ahead;
    }

    let target = Math.atan2(ty - cop.y, tx - cop.x);

    // separación de otras patrullas
    let sx = 0, sy = 0;
    for (const o of g.cops) {
      if (o === cop) continue;
      const odx = cop.x - o.x, ody = cop.y - o.y;
      const od = Math.hypot(odx, ody);
      if (od > 0 && od < CAR * 2.4) { sx += (odx / od) * (CAR * 2.4 - od); sy += (ody / od) * (CAR * 2.4 - od); }
    }
    if (sx || sy) {
      const sepAng = Math.atan2(sy, sx);
      target += angDiff(sepAng, target) * 0.3;
    }

    // evasión de edificios con "bigotes" (whiskers)
    const probe = CAR * 2.6;
    const clear = (ang: number) => !pointBlocked(solids, cop.x + Math.cos(ang) * probe, cop.y + Math.sin(ang) * probe, 4) &&
      cop.x + Math.cos(ang) * probe > 0 && cop.x + Math.cos(ang) * probe < MAP &&
      cop.y + Math.sin(ang) * probe > 0 && cop.y + Math.sin(ang) * probe < MAP;
    if (!clear(target)) {
      let found = false;
      for (const off of [0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.3, -2.3]) {
        if (clear(target + off)) { target += off; found = true; break; }
      }
      if (!found) cop.stuck += dt * 16.67;
    } else cop.stuck = Math.max(0, cop.stuck - dt * 16.67);

    // giro suave hacia el objetivo
    const da = angDiff(target, cop.angle);
    const turn = (0.05 + g.stars * 0.008) * dt;
    cop.angle += clamp(da, -turn, turn);

    // velocidad: alcanza cuando lejos, frena cuando muy cerca, embiste si está detrás
    let want = cop.baseSpd * (dist > 360 ? 1.3 : dist < 90 ? 0.72 : 1.0);
    if (dist < 130 && Math.abs(angDiff(Math.atan2(dy, dx), p.angle)) < 0.7) want *= 1.22; // intento de embestida (PIT)
    if (cop.stuck > 400) want *= 0.5; // atascado contra un muro
    cop.spd += (want - cop.spd) * 0.06 * dt;

    const move = cop.spd * MAX_SPD * 0.72 * dt;
    let nx = cop.x + Math.cos(cop.angle) * move;
    let ny = cop.y + Math.sin(cop.angle) * move;
    const res = collideSolids(solids, nx, ny, R);
    nx = res.x; ny = res.y;
    if (res.hit) { cop.spd *= 0.7; cop.stuck += dt * 16.67; }
    cop.x = clamp(nx, CAR, MAP - CAR);
    cop.y = clamp(ny, CAR, MAP - CAR);

    // si lleva mucho atascado, lo reubicamos en una avenida cercana
    if (cop.stuck > 2200) {
      const rp = randomRoadPoint(g.rnd);
      if (Math.hypot(rp.x - p.x, rp.y - p.y) > 500) { cop.x = rp.x; cop.y = rp.y; cop.stuck = 0; }
    }
  }
}

// ---------- tráfico civil ----------
function updateTraffic(g: Game, dt: number, audio: GameAudio) {
  const p = g.player;
  g.trafficTimer -= dt * 16.67;
  const want = 10;
  if (g.trafficTimer <= 0 && g.traffic.length < want) {
    g.trafficTimer = 600;
    // aparece sobre una avenida, lejos del jugador
    const cols = Math.round(MAP / BLOCK);
    let x: number, y: number, angle: number;
    if (Math.random() < 0.5) {
      x = Math.floor(Math.random() * cols) * BLOCK + (Math.random() < 0.5 ? -ROAD_W / 4 : ROAD_W / 4);
      y = Math.random() * MAP; angle = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      y = Math.floor(Math.random() * cols) * BLOCK + (Math.random() < 0.5 ? -ROAD_W / 4 : ROAD_W / 4);
      x = Math.random() * MAP; angle = Math.random() < 0.5 ? 0 : Math.PI;
    }
    if (Math.hypot(x - p.x, y - p.y) > 600) {
      const colors = ["#c0392b", "#2980b9", "#16a085", "#f39c12", "#bdc3c7", "#8e44ad", "#34495e"];
      g.traffic.push({ x, y, angle, spd: 2 + Math.random() * 2, color: colors[Math.floor(Math.random() * colors.length)], id: Date.now() });
    }
  }
  g.traffic = g.traffic.filter((t) => {
    t.x += Math.cos(t.angle) * t.spd * dt;
    t.y += Math.sin(t.angle) * t.spd * dt;
    // colisión con el jugador (golpe, sin quitar vida)
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d < CAR * 0.95 && g.invincible <= 0) {
      const n = Math.atan2(p.y - t.y, p.x - t.x);
      p.x += Math.cos(n) * (CAR * 0.95 - d);
      p.y += Math.sin(n) * (CAR * 0.95 - d);
      p.speed *= 0.5;
      g.shake = Math.max(g.shake, 120);
      addParticles(g, (t.x + p.x) / 2, (t.y + p.y) / 2, 5, "#ffaa33", "spark", 2.5);
      audio.play("crash");
    }
    return t.x > -120 && t.x < MAP + 120 && t.y > -120 && t.y < MAP + 120;
  });
}

// ============================================================================
// RENDER del canvas
// ============================================================================
export function draw(ctx: CanvasRenderingContext2D, g: Game, canvas: HTMLCanvasElement) {
  const W = canvas.width, H = canvas.height;
  const p = g.player;
  const sx = g.shake > 0 ? (Math.random() - 0.5) * (g.shake / 30) : 0;
  const sy = g.shake > 0 ? (Math.random() - 0.5) * (g.shake / 30) : 0;
  // cámara con leve adelanto en la dirección de marcha
  const camX = Math.floor(p.x + Math.cos(p.angle) * p.speed * 5 - W / 2 + sx);
  const camY = Math.floor(p.y + Math.sin(p.angle) * p.speed * 5 - H / 2 + sy);
  const inView = (x: number, y: number, m: number) => x - camX > -m && x - camX < W + m && y - camY > -m && y - camY < H + m;

  // fondo (asfalto base = avenidas)
  ctx.fillStyle = "#101019";
  ctx.fillRect(0, 0, W, H);

  // suelo de las manzanas
  const groundColor: Record<string, string> = {
    grass: "#16361f", parking: "#1b1b26", plaza: "#23232f", water: "#0e2a4a", concrete: "#1a1a24",
  };
  for (const lot of g.city.lots) {
    if (!inView(lot.x + lot.w / 2, lot.y + lot.h / 2, lot.w)) continue;
    // acera
    ctx.fillStyle = "#33333f";
    ctx.fillRect(lot.x - camX, lot.y - camY, lot.w, lot.h);
    // suelo interno
    ctx.fillStyle = groundColor[lot.ground] || "#1a1a24";
    ctx.fillRect(lot.x - camX + 16, lot.y - camY + 16, lot.w - 32, lot.h - 32);
  }

  // líneas de carril sobre las avenidas
  ctx.strokeStyle = "rgba(236,201,75,0.5)";
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 18]);
  const startX = Math.floor(camX / BLOCK) * BLOCK, startY = Math.floor(camY / BLOCK) * BLOCK;
  for (let gx = startX; gx < camX + W + BLOCK; gx += BLOCK) {
    ctx.beginPath(); ctx.moveTo(gx - camX, 0); ctx.lineTo(gx - camX, H); ctx.stroke();
  }
  for (let gy = startY; gy < camY + H + BLOCK; gy += BLOCK) {
    ctx.beginPath(); ctx.moveTo(0, gy - camY); ctx.lineTo(W, gy - camY); ctx.stroke();
  }
  ctx.setLineDash([]);

  // marcas de derrape
  for (const sk of g.skids) {
    if (!inView(sk.x, sk.y, 20)) continue;
    ctx.save();
    ctx.globalAlpha = sk.alpha;
    ctx.strokeStyle = "#0c0c10";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sk.x - camX - Math.cos(sk.a) * 6, sk.y - camY - Math.sin(sk.a) * 6);
    ctx.lineTo(sk.x - camX + Math.cos(sk.a) * 6, sk.y - camY + Math.sin(sk.a) * 6);
    ctx.stroke();
    ctx.restore();
  }

  // sólidos (edificios, árboles, autos estacionados, fuentes, agua)
  for (const s of g.city.solids) {
    if (!inView(s.x + s.w / 2, s.y + s.h / 2, Math.max(s.w, s.h))) continue;
    const x = s.x - camX, y = s.y - camY;
    if (s.kind === "building") {
      // sombra proyectada
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(x + 5, y + 6, s.w, s.h);
      // cuerpo
      ctx.fillStyle = s.color;
      ctx.fillRect(x, y, s.w, s.h);
      // borde superior (techo iluminado)
      ctx.fillStyle = s.roof || "#3a3a4a";
      ctx.fillRect(x, y, s.w, 5);
      // ventanas
      const sd = s.seed || 1;
      ctx.fillStyle = "rgba(255,220,120,0.85)";
      for (let wy = y + 10; wy < y + s.h - 6; wy += 12) {
        for (let wx = x + 6; wx < x + s.w - 6; wx += 11) {
          const lit = (Math.floor((wx + sd) * 0.7) ^ Math.floor((wy + sd) * 1.3)) % 5;
          if (lit === 0) ctx.fillStyle = "rgba(120,230,255,0.8)";
          else if (lit === 1) ctx.fillStyle = "rgba(255,210,110,0.8)";
          else { continue; }
          ctx.fillRect(wx, wy, 5, 6);
        }
      }
    } else if (s.kind === "tree") {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath(); ctx.arc(x + s.w / 2 + 3, y + s.h / 2 + 3, s.w / 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(x + s.w / 2, y + s.h / 2, s.w / 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath(); ctx.arc(x + s.w / 2 - 3, y + s.h / 2 - 3, s.w / 4, 0, Math.PI * 2); ctx.fill();
    } else if (s.kind === "car") {
      ctx.fillStyle = s.color;
      ctx.fillRect(x, y, s.w, s.h);
      ctx.fillStyle = "#11161f";
      ctx.fillRect(x + 2, y + s.h * 0.3, s.w - 4, s.h * 0.4);
    } else if (s.kind === "fountain") {
      ctx.fillStyle = "#2c3a55"; ctx.beginPath();
      ctx.arc(x + s.w / 2, y + s.h / 2, s.w / 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4a8fd6"; ctx.beginPath();
      ctx.arc(x + s.w / 2, y + s.h / 2, s.w / 4, 0, Math.PI * 2); ctx.fill();
    } else if (s.kind === "water") {
      const t = Date.now() * 0.001;
      ctx.fillStyle = "#0e2a4a"; ctx.fillRect(x, y, s.w, s.h);
      ctx.strokeStyle = "rgba(90,150,220,0.25)"; ctx.lineWidth = 1.5;
      for (let i = 0; i < s.h; i += 14) {
        ctx.beginPath();
        ctx.moveTo(x, y + i + Math.sin(t + i) * 2);
        ctx.lineTo(x + s.w, y + i + Math.cos(t + i) * 2);
        ctx.stroke();
      }
    }
  }

  // borde del mundo
  ctx.strokeStyle = "#e53e3e"; ctx.lineWidth = 6;
  ctx.strokeRect(-camX, -camY, MAP, MAP);

  // monedas
  const time = Date.now() * 0.006;
  for (const c of g.coins) {
    if (!inView(c.x, c.y, 20)) continue;
    const cx = c.x - camX, cy = c.y - camY;
    const pulse = 0.85 + Math.sin(time + c.id * 0.4) * 0.15;
    ctx.fillStyle = `rgba(255,215,0,${pulse})`;
    ctx.beginPath(); ctx.arc(cx, cy, 8 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#b8860b";
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
  }

  // power-ups
  const colors: Record<string, string> = { turbo: "#00ffff", shield: "#00ff88", magnet: "#ff00ff", bomb: "#ff4444" };
  const icons: Record<string, string> = { turbo: "⚡", shield: "🛡️", magnet: "🧲", bomb: "💣" };
  for (const pu of g.powerUps) {
    if (!inView(pu.x, pu.y, 30)) continue;
    const px = pu.x - camX, py = pu.y - camY;
    const pulse = 0.8 + Math.sin(time * 1.5 + pu.id) * 0.2;
    ctx.save(); ctx.shadowColor = colors[pu.type]; ctx.shadowBlur = 14;
    ctx.fillStyle = colors[pu.type];
    ctx.beginPath(); ctx.arc(px, py, 14 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.font = "15px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(icons[pu.type], px, py);
  }

  // tráfico
  for (const t of g.traffic) {
    if (!inView(t.x, t.y, 50)) continue;
    ctx.save(); ctx.translate(t.x - camX, t.y - camY); ctx.rotate(t.angle);
    drawTrafficCar(ctx, CAR * 0.9, t.color); ctx.restore();
  }

  // partículas (debajo de los autos)
  for (const pt of g.particles) {
    if (!inView(pt.x, pt.y, 20)) continue;
    const a = 1 - pt.life / pt.max;
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x - camX, pt.y - camY, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // explosiones
  for (const e of g.explosions) {
    const ex = e.x - camX, ey = e.y - camY;
    const maxT = e.big ? 600 : 400;
    const prog = e.t / maxT;
    const r = (e.big ? 30 : 20) + prog * (e.big ? 55 : 32);
    const alpha = 1 - prog;
    ctx.save(); ctx.shadowColor = "#ff6600"; ctx.shadowBlur = 30;
    ctx.fillStyle = `rgba(255,100,0,${alpha * 0.9})`;
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,255,120,${alpha * 0.8})`;
    ctx.beginPath(); ctx.arc(ex, ey, r * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // patrullas
  for (const cop of g.cops) {
    if (!inView(cop.x, cop.y, 60)) continue;
    ctx.save(); ctx.translate(cop.x - camX, cop.y - camY); ctx.rotate(cop.angle);
    drawPoliceCar(ctx, CAR, cop.tier, Date.now());
    ctx.restore();
  }

  // jugador (parpadea cuando es invencible)
  const flash = g.invincible > 0 && Math.floor(g.invincible / 70) % 2 === 0;
  if (!flash) {
    ctx.save(); ctx.translate(p.x - camX, p.y - camY); ctx.rotate(p.angle);
    drawPlayerCar(ctx, g.paint, CAR, {
      braking: g.braking || p.speed < 0,
      turbo: p.turbo > 0, shield: p.shield, magnet: p.magnet, t: Date.now() * 0.05,
    });
    ctx.restore();
  }

  // viñeta de búsqueda (rojo/azul parpadeante cuando el nivel es alto)
  if (g.stars >= 3) {
    const on = Math.floor(Date.now() * 0.006) % 2 === 0;
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.8);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, on ? "rgba(255,40,40,0.22)" : "rgba(40,80,255,0.22)");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  }

  // flash blanco al recibir golpe
  if (g.flashHit > 0) {
    ctx.fillStyle = `rgba(255,60,60,${(g.flashHit / 350) * 0.4})`;
    ctx.fillRect(0, 0, W, H);
  }
}
