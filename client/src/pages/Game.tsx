import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/useMobile";


// ============================================================
// AUDIO
// ============================================================
class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private muted = false;

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);
    } catch (e) { }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.25;
    return this.muted;
  }

  get isMuted() { return this.muted; }

  startEngine() {
    if (!this.ctx || !this.master || this.engine) return;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.05;
    this.engineGain.connect(this.master);
    this.engine = this.ctx.createOscillator();
    this.engine.type = 'sawtooth';
    this.engine.frequency.value = 50;
    this.engine.connect(this.engineGain);
    this.engine.start();
  }

  updateEngine(speed: number, max: number) {
    if (!this.engine || !this.engineGain) return;
    const r = Math.abs(speed) / max;
    this.engine.frequency.value = 50 + r * 250;
    this.engineGain.gain.value = 0.03 + r * 0.12;
  }

  stop() {
    if (this.engine) { try { this.engine.stop(); } catch (e) { } this.engine = null; }
    if (this.engineGain) { this.engineGain.disconnect(); this.engineGain = null; }
  }

  play(type: string) {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.connect(g);
    g.connect(this.master);
    const t = this.ctx.currentTime;

    switch (type) {
      case 'coin':
        g.gain.value = 0.15;
        o.type = 'sine';
        o.frequency.setValueAtTime(880, t);
        o.frequency.setValueAtTime(1320, t + 0.05);
        o.start(t);
        o.stop(t + 0.1);
        break;
      case 'explode':
        g.gain.value = 0.25;
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(20, t + 0.4);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        o.start(t);
        o.stop(t + 0.45);
        break;
      case 'powerup':
        g.gain.value = 0.12;
        o.type = 'sine';
        o.frequency.setValueAtTime(400, t);
        o.frequency.exponentialRampToValueAtTime(1200, t + 0.2);
        o.start(t);
        o.stop(t + 0.25);
        break;
      case 'freeze':
        g.gain.value = 0.14;
        o.type = 'triangle';
        o.frequency.setValueAtTime(1400, t);
        o.frequency.exponentialRampToValueAtTime(300, t + 0.4);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
        o.start(t);
        o.stop(t + 0.5);
        break;
      case 'repair':
        g.gain.value = 0.13;
        o.type = 'sine';
        o.frequency.setValueAtTime(440, t);
        o.frequency.setValueAtTime(660, t + 0.1);
        o.frequency.setValueAtTime(880, t + 0.2);
        o.start(t);
        o.stop(t + 0.3);
        break;
      case 'star':
        g.gain.value = 0.15;
        o.type = 'square';
        o.frequency.setValueAtTime(200, t);
        o.frequency.setValueAtTime(300, t + 0.1);
        o.frequency.setValueAtTime(400, t + 0.2);
        o.start(t);
        o.stop(t + 0.3);
        break;
      case 'achieve':
        g.gain.value = 0.12;
        o.type = 'sine';
        o.frequency.setValueAtTime(523, t);
        o.frequency.setValueAtTime(659, t + 0.1);
        o.frequency.setValueAtTime(784, t + 0.2);
        o.frequency.setValueAtTime(1047, t + 0.3);
        o.start(t);
        o.stop(t + 0.5);
        break;
      case 'hit':
        g.gain.value = 0.18;
        o.type = 'square';
        o.frequency.value = 80;
        o.start(t);
        o.stop(t + 0.15);
        break;
      case 'win':
        g.gain.value = 0.15;
        o.type = 'sine';
        [523, 659, 784, 1047].forEach((f, i) => o.frequency.setValueAtTime(f, t + i * 0.12));
        o.start(t);
        o.stop(t + 0.6);
        break;
      case 'lose':
        g.gain.value = 0.15;
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(200, t);
        o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
        o.start(t);
        o.stop(t + 0.5);
        break;
      case 'drift':
        g.gain.value = 0.06;
        o.type = 'sawtooth';
        o.frequency.value = 100 + Math.random() * 50;
        o.start(t);
        o.stop(t + 0.08);
        break;
    }
  }
}


const audio = new GameAudio();

// ============================================================
// CONFIG
// ============================================================
const MAP = 2800;
const CAR = 36;
const MAX_SPD = 13;
const ACCEL = 0.5;
const BRAKE = 0.7;
const FRIC = 0.97;
const TURN = 0.048;
const DRIFT_FRIC = 0.85;
const DRIFT_TURN = 0.11;
const REV_SPD = 6;
const MAX_LIVES = 5;

type Diff = 'normal' | 'hard' | 'impossible' | 'endless';

const DIFFS: Record<Diff, { cops: number; spd: number; time: number; spawn: number; max: number }> = {
  normal: { cops: 4, spd: 0.7, time: 120, spawn: 25, max: 10 },
  hard: { cops: 6, spd: 0.8, time: 180, spawn: 18, max: 15 },
  impossible: { cops: 8, spd: 0.9, time: 240, spawn: 12, max: 25 },
  endless: { cops: 5, spd: 0.8, time: Infinity, spawn: 14, max: 30 }
};

const DIFF_LABEL: Record<Diff, string> = {
  normal: '⭐ NORMAL',
  hard: '⭐⭐ DIFÍCIL',
  impossible: '⭐⭐⭐ IMPOSIBLE',
  endless: '♾️ INFINITO'
};


// ============================================================
// ACHIEVEMENTS
// ============================================================
const ACHIEVEMENTS = [
  { id: 'first_coin', name: 'Primera Moneda', desc: 'Recoge tu primera moneda', icon: '🪙' },
  { id: 'coin_hunter', name: 'Cazador', desc: 'Recoge 50 monedas', icon: '💰' },
  { id: 'rich', name: 'Millonario', desc: 'Recoge 200 monedas', icon: '💎' },
  { id: 'first_blood', name: 'Primera Sangre', desc: 'Destruye un policía', icon: '💥' },
  { id: 'destroyer', name: 'Destructor', desc: 'Destruye 10 policías', icon: '🔥' },
  { id: 'demolition', name: 'Demoledor', desc: 'Destruye 25 policías', icon: '🚧' },
  { id: 'drift_king', name: 'Rey del Drift', desc: 'Driftea 30 segundos', icon: '💨' },
  { id: 'close_call', name: 'Por Poco', desc: '10 near miss seguidos', icon: '😰' },
  { id: 'survivor', name: 'Superviviente', desc: 'Sobrevive 2 minutos', icon: '⏱️' },
  { id: 'marathon', name: 'Maratón', desc: 'Sobrevive 5 minutos', icon: '🏃' },
  { id: 'five_stars', name: '5 Estrellas', desc: 'Alcanza nivel máximo', icon: '⭐' },
  { id: 'iceman', name: 'Hombre de Hielo', desc: 'Congela a la policía', icon: '🧊' },
  { id: 'untouchable', name: 'Intocable', desc: 'Gana sin perder vidas', icon: '🛡️' },
  { id: 'chain_reaction', name: 'Reacción en Cadena', desc: '3 policías explotan a la vez', icon: '💣' },
];


// ============================================================
// TYPES
// ============================================================
interface Coin { x: number; y: number; id: number; }
type PUType = 'turbo' | 'shield' | 'magnet' | 'bomb' | 'freeze' | 'repair';
interface PowerUp { x: number; y: number; id: number; type: PUType; }
interface Explosion { x: number; y: number; id: number; t: number; big: boolean; }
type CopKind = 'patrol' | 'interceptor';
interface Cop { x: number; y: number; angle: number; spd: number; id: number; kind: CopKind; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; }
interface Skid { x: number; y: number; a: number; life: number; }

interface Player {
  x: number; y: number; angle: number; speed: number;
  drifting: boolean; turbo: number; shield: number; magnet: number;
}

interface GameState {
  player: Player;
  cops: Cop[];
  coins: Coin[];
  powerUps: PowerUp[];
  explosions: Explosion[];
  particles: Particle[];
  skids: Skid[];
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
  gameOver: boolean;
  won: boolean;
  time: number;
  diff: Diff;
  endless: boolean;
  invincible: number;
  shake: number;
  freezeTimer: number;
  spawnTimer: number;
  surviveTime: number;
  achievements: string[];
  newAchievement: { name: string; icon: string } | null;
  achieveTimer: number;
  lostLives: number;
}

// snapshot for the React-rendered HUD (updated at low frequency, not per frame)
interface Hud {
  lives: number; score: number; coinsTotal: number; stars: number;
  time: number; surviveTime: number; copsCount: number; copsDestroyed: number;
  mult: number; shield: number; turbo: number; magnet: number; freeze: number; endless: boolean;
}

interface FinalStats {
  score: number; coinsTotal: number; copsDestroyed: number;
  surviveTime: number; diff: Diff; won: boolean; newRecord: boolean;
}


// ============================================================
// HELPERS
// ============================================================
const hsKey = (d: Diff) => `escape_hs_${d}`;
const bestScore = (d: Diff) => parseInt(localStorage.getItem(hsKey(d)) || '0');
function saveScore(d: Diff, score: number): boolean {
  const prev = bestScore(d);
  if (score > prev) {
    localStorage.setItem(hsKey(d), score.toString());
    // keep a global best for the Home screen
    const globalBest = parseInt(localStorage.getItem('escape_hs') || '0');
    if (score > globalBest) localStorage.setItem('escape_hs', score.toString());
    return true;
  }
  return false;
}

const PU_WEIGHTS: [PUType, number][] = [
  ['turbo', 26], ['shield', 22], ['magnet', 20], ['freeze', 14], ['repair', 10], ['bomb', 8]
];
function pickPU(): PUType {
  const total = PU_WEIGHTS.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [t, w] of PU_WEIGHTS) { if (r < w) return t; r -= w; }
  return 'turbo';
}


export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [isTouch] = useState(() =>
    typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0)
  );

  const [screen, setScreen] = useState<'menu' | 'playing' | 'paused' | 'won' | 'over'>('menu');
  const [diff, setDiff] = useState<Diff>('normal');
  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState<Hud | null>(null);
  const [finalStats, setFinalStats] = useState<FinalStats | null>(null);
  const [menuTick, setMenuTick] = useState(0); // re-read best scores when returning to menu

  // mutable game refs (no re-render)
  const game = useRef<GameState | null>(null);
  const keys = useRef<Set<string>>(new Set());
  const touch = useRef({ active: false, dx: 0, dy: 0, drift: false });
  const raf = useRef<number | null>(null);
  const lastT = useRef<number>(0);
  const hudClock = useRef<number>(0);
  const screenRef = useRef(screen);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  // joystick thumb element (moved imperatively to avoid re-renders)
  const thumbRef = useRef<HTMLDivElement>(null);
  const joyRef = useRef<HTMLDivElement>(null);

  const showTouch = isTouch || isMobile;

  // ----------------------------------------------------------
  // CANVAS SIZING (responsive — camera uses canvas.width/height)
  // ----------------------------------------------------------
  const sizeCanvas = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const pad = 12;
    const maxW = 960;
    let w = Math.min(window.innerWidth - pad, maxW);
    const reserve = showTouch ? 130 : 150;
    let h = Math.min(window.innerHeight - reserve, Math.round(w * 0.66));
    w = Math.max(320, Math.round(w));
    h = Math.max(260, Math.round(h));
    cv.width = w;
    cv.height = h;
  }, [showTouch]);

  useEffect(() => {
    const onResize = () => sizeCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [sizeCanvas]);

  // ----------------------------------------------------------
  // BUILD INITIAL STATE
  // ----------------------------------------------------------
  const buildState = useCallback((d: Diff): GameState => {
    const cfg = DIFFS[d];
    const px = MAP / 2, py = MAP / 2;
    const cops: Cop[] = [];
    for (let i = 0; i < cfg.cops; i++) {
      const a = (Math.PI * 2 / cfg.cops) * i;
      const dist = 450 + Math.random() * 250;
      cops.push({
        x: px + Math.cos(a) * dist, y: py + Math.sin(a) * dist,
        angle: Math.random() * Math.PI * 2, spd: cfg.spd, id: i, kind: 'patrol'
      });
    }

    const coins: Coin[] = [];
    for (let i = 0; i < 60; i++) {
      coins.push({ x: 100 + Math.random() * (MAP - 200), y: 100 + Math.random() * (MAP - 200), id: i });
    }

    const powerUps: PowerUp[] = [];
    const startPool: PUType[] = ['turbo', 'shield', 'magnet', 'freeze', 'turbo', 'magnet'];
    for (let i = 0; i < startPool.length; i++) {
      powerUps.push({ x: 150 + Math.random() * (MAP - 300), y: 150 + Math.random() * (MAP - 300), id: i, type: startPool[i] });
    }
    powerUps.push({ x: 200 + Math.random() * (MAP - 400), y: 200 + Math.random() * (MAP - 400), id: 98, type: 'repair' });
    powerUps.push({ x: 200 + Math.random() * (MAP - 400), y: 200 + Math.random() * (MAP - 400), id: 99, type: 'bomb' });

    const saved = JSON.parse(localStorage.getItem('escape_achievements') || '[]');

    return {
      player: { x: px, y: py, angle: -Math.PI / 2, speed: 0, drifting: false, turbo: 0, shield: 0, magnet: 0 },
      cops, coins, powerUps, explosions: [], particles: [], skids: [],
      lives: 3, score: 0, stars: 1, mult: 1, multTimer: 0,
      coinsTotal: 0, copsDestroyed: 0, driftTime: 0, nearMissStreak: 0, maxNearMiss: 0,
      gameOver: false, won: false,
      time: cfg.time === Infinity ? Infinity : cfg.time * 1000,
      diff: d, endless: d === 'endless',
      invincible: 0, shake: 0, freezeTimer: 0, spawnTimer: 0, surviveTime: 0,
      achievements: saved, newAchievement: null, achieveTimer: 0, lostLives: 0
    };
  }, []);

  const snapshot = useCallback((s: GameState): Hud => ({
    lives: s.lives, score: s.score, coinsTotal: s.coinsTotal, stars: s.stars,
    time: s.time, surviveTime: s.surviveTime, copsCount: s.cops.length, copsDestroyed: s.copsDestroyed,
    mult: s.mult, shield: s.player.shield, turbo: s.player.turbo, magnet: s.player.magnet,
    freeze: s.freezeTimer, endless: s.endless
  }), []);

  // ----------------------------------------------------------
  // ACHIEVEMENT UNLOCK (mutates state in place)
  // ----------------------------------------------------------
  const unlock = useCallback((s: GameState, id: string) => {
    if (s.achievements.includes(id)) return;
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (!ach) return;
    audio.play('achieve');
    s.achievements = [...s.achievements, id];
    localStorage.setItem('escape_achievements', JSON.stringify(s.achievements));
    s.newAchievement = { name: ach.name, icon: ach.icon };
    s.achieveTimer = 3000;
  }, []);

  // particle burst helper
  const burst = useCallback((s: GameState, x: number, y: number, n: number, color: string, spd: number, size: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = spd * (0.4 + Math.random() * 0.8);
      s.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 300 + Math.random() * 350, size: size * (0.6 + Math.random() * 0.7), color });
    }
    if (s.particles.length > 240) s.particles.splice(0, s.particles.length - 240);
  }, []);

  // ----------------------------------------------------------
  // UPDATE — simulation step (mutates s)
  // ----------------------------------------------------------
  const update = useCallback((s: GameState, dt: number) => {
    const k = keys.current;
    const t = touch.current;
    const cfg = DIFFS[s.diff];

    // merged input (keyboard + touch)
    const left = k.has('arrowleft') || k.has('a') || (t.active && t.dx < -0.3);
    const right = k.has('arrowright') || k.has('d') || (t.active && t.dx > 0.3);
    const accel = k.has('arrowup') || k.has('w') || (t.active && t.dy < -0.35);
    const brake = k.has('arrowdown') || k.has('s') || (t.active && t.dy > 0.35);
    const driftHeld = k.has(' ') || t.drift;

    // Time
    if (isFinite(s.time)) s.time -= dt * 16.67;
    s.surviveTime += dt * 16.67;
    s.achieveTimer = Math.max(0, s.achieveTimer - dt * 16.67);
    if (s.achieveTimer <= 0) s.newAchievement = null;
    s.freezeTimer = Math.max(0, s.freezeTimer - dt * 16.67);

    // Win by time
    if (isFinite(s.time) && s.time <= 0) {
      audio.play('win');
      audio.stop();
      if (s.lostLives === 0) unlock(s, 'untouchable');
      s.won = true; s.time = 0;
      return;
    }

    // Win by destroying all cops (not in endless)
    if (!s.endless && s.cops.length === 0) {
      audio.play('win');
      audio.stop();
      s.won = true;
      return;
    }

    // ---- Player physics ----
    const p = s.player;
    const drift = driftHeld && Math.abs(p.speed) > 1.5;
    p.drifting = drift;
    if (drift) {
      s.driftTime += dt * 16.67 / 1000;
      if (Math.random() < 0.3) audio.play('drift');
      // skid marks behind rear wheels
      if (Math.abs(p.speed) > 3) {
        s.skids.push({ x: p.x - Math.cos(p.angle) * 12, y: p.y - Math.sin(p.angle) * 12, a: p.angle, life: 0 });
        if (s.skids.length > 160) s.skids.shift();
      }
    }
    p.turbo = Math.max(0, p.turbo - dt * 16.67);
    p.shield = Math.max(0, p.shield - dt * 16.67);
    p.magnet = Math.max(0, p.magnet - dt * 16.67);

    const turboMult = p.turbo > 0 ? 1.8 : 1;
    const maxSpd = MAX_SPD * turboMult;

    if (accel) {
      p.speed = Math.min(p.speed + ACCEL * dt, maxSpd);
    } else if (brake) {
      if (p.speed > 0.5) {
        p.speed = Math.max(p.speed - BRAKE * dt, 0);
      } else {
        p.speed = Math.max(p.speed - ACCEL * 0.8 * dt, -REV_SPD);
      }
    } else {
      p.speed *= Math.pow(drift ? DRIFT_FRIC : FRIC, dt);
      if (Math.abs(p.speed) < 0.08) p.speed = 0;
    }

    if (Math.abs(p.speed) > 0.15) {
      const dir = p.speed > 0 ? 1 : -1;
      const turnRate = drift ? DRIFT_TURN : TURN;
      const spdFactor = Math.min(Math.abs(p.speed) / 5, 1);
      if (left) p.angle -= turnRate * spdFactor * dir * dt;
      if (right) p.angle += turnRate * spdFactor * dir * dt;
    }

    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;

    // exhaust / turbo flame particles
    if (Math.abs(p.speed) > 6 && Math.random() < 0.5) {
      burst(s, p.x - Math.cos(p.angle) * 18, p.y - Math.sin(p.angle) * 18, 1,
        p.turbo > 0 ? '0,212,255' : '120,120,140', p.turbo > 0 ? 2.2 : 1, p.turbo > 0 ? 4 : 3);
    }

    // borders
    const margin = CAR * 0.6;
    if (p.x < margin) { p.x = margin + 5; p.speed = Math.abs(p.speed) * 0.5; p.angle = Math.PI - p.angle; }
    if (p.x > MAP - margin) { p.x = MAP - margin - 5; p.speed = Math.abs(p.speed) * 0.5; p.angle = Math.PI - p.angle; }
    if (p.y < margin) { p.y = margin + 5; p.speed = Math.abs(p.speed) * 0.5; p.angle = -p.angle; }
    if (p.y > MAP - margin) { p.y = MAP - margin - 5; p.speed = Math.abs(p.speed) * 0.5; p.angle = -p.angle; }

    audio.updateEngine(p.speed, MAX_SPD);

    // Multiplier decay
    s.multTimer = Math.max(0, s.multTimer - dt * 16.67);
    if (s.multTimer <= 0 && s.mult > 1) { s.mult = Math.max(1, s.mult - 0.5); s.multTimer = 2000; }

    // ---- Coins (with magnet) ----
    s.coins = s.coins.filter(c => {
      const dist = Math.hypot(p.x - c.x, p.y - c.y);
      if (p.magnet > 0 && dist < 180) {
        const ang = Math.atan2(p.y - c.y, p.x - c.x);
        c.x += Math.cos(ang) * 10 * dt;
        c.y += Math.sin(ang) * 10 * dt;
      }
      if (dist < (p.magnet > 0 ? 40 : 28)) {
        s.coinsTotal++;
        s.score += Math.floor(15 * s.mult);
        s.mult = Math.min(s.mult + 0.3, 10);
        s.multTimer = 4000;
        audio.play('coin');
        burst(s, c.x, c.y, 5, '255,215,0', 1.6, 3);
        if (s.coinsTotal === 1) unlock(s, 'first_coin');
        if (s.coinsTotal >= 50) unlock(s, 'coin_hunter');
        if (s.coinsTotal >= 200) unlock(s, 'rich');
        return false;
      }
      return true;
    });
    if (s.coins.length < 30) {
      for (let i = 0; i < 15; i++) {
        s.coins.push({ x: 100 + Math.random() * (MAP - 200), y: 100 + Math.random() * (MAP - 200), id: Date.now() + i });
      }
    }

    // ---- Power-ups ----
    s.powerUps = s.powerUps.filter(pu => {
      if (Math.hypot(p.x - pu.x, p.y - pu.y) < 32) {
        s.score += Math.floor(150 * s.mult);
        const col: Record<PUType, string> = {
          turbo: '0,255,255', shield: '0,255,136', magnet: '255,0,255',
          bomb: '255,68,68', freeze: '120,220,255', repair: '0,255,136'
        };
        burst(s, pu.x, pu.y, 10, col[pu.type], 2, 4);
        if (pu.type === 'turbo') { p.turbo = 6000; audio.play('powerup'); }
        else if (pu.type === 'shield') { p.shield = 10000; audio.play('powerup'); }
        else if (pu.type === 'magnet') { p.magnet = 12000; audio.play('powerup'); }
        else if (pu.type === 'freeze') {
          s.freezeTimer = 3500; audio.play('freeze');
          unlock(s, 'iceman');
        }
        else if (pu.type === 'repair') {
          s.lives = Math.min(MAX_LIVES, s.lives + 1); audio.play('repair');
        }
        else if (pu.type === 'bomb' && s.cops.length > 0) {
          audio.play('powerup');
          let minD = Infinity, idx = 0;
          s.cops.forEach((c, i) => { const d = Math.hypot(p.x - c.x, p.y - c.y); if (d < minD) { minD = d; idx = i; } });
          const cop = s.cops[idx];
          s.explosions.push({ x: cop.x, y: cop.y, id: Date.now(), t: 0, big: true });
          burst(s, cop.x, cop.y, 16, '255,120,0', 3, 5);
          s.cops.splice(idx, 1);
          s.copsDestroyed++;
          s.score += Math.floor(500 * s.mult);
          audio.play('explode');
          if (s.copsDestroyed === 1) unlock(s, 'first_blood');
          if (s.copsDestroyed >= 10) unlock(s, 'destroyer');
          if (s.copsDestroyed >= 25) unlock(s, 'demolition');
        }
        return false;
      }
      return true;
    });
    if (s.powerUps.length < 4 && Math.random() < 0.005 * dt) {
      s.powerUps.push({ x: 150 + Math.random() * (MAP - 300), y: 150 + Math.random() * (MAP - 300), id: Date.now(), type: pickPU() });
    }

    // ---- GTA star system ----
    const oldStars = s.stars;
    if (s.surviveTime > 30000 && s.stars < 2) s.stars = 2;
    if (s.surviveTime > 60000 && s.stars < 3) s.stars = 3;
    if (s.surviveTime > 100000 && s.stars < 4) s.stars = 4;
    if (s.surviveTime > 150000 && s.stars < 5) s.stars = 5;
    if (s.copsDestroyed >= 3 && s.stars < 2) s.stars = 2;
    if (s.copsDestroyed >= 6 && s.stars < 3) s.stars = 3;
    if (s.copsDestroyed >= 10 && s.stars < 4) s.stars = 4;
    if (s.stars > oldStars) audio.play('star');
    if (s.stars >= 5) unlock(s, 'five_stars');

    // ---- Spawn cops based on stars ----
    const spawnRate = cfg.spawn * 1000 / s.stars;
    s.spawnTimer += dt * 16.67;
    const maxCopsNow = Math.min(cfg.max, 4 + s.stars * 2);
    if (s.spawnTimer >= spawnRate && s.cops.length < maxCopsNow) {
      s.spawnTimer = 0;
      const edge = Math.floor(Math.random() * 4);
      let sx: number, sy: number;
      if (edge === 0) { sx = Math.random() * MAP; sy = 30; }
      else if (edge === 1) { sx = Math.random() * MAP; sy = MAP - 30; }
      else if (edge === 2) { sx = 30; sy = Math.random() * MAP; }
      else { sx = MAP - 30; sy = Math.random() * MAP; }
      const interceptor = s.stars >= 4 && Math.random() < 0.35;
      s.cops.push({
        x: sx, y: sy, angle: Math.atan2(p.y - sy, p.x - sx),
        spd: cfg.spd * (1 + s.stars * 0.08) * (interceptor ? 1.3 : 1),
        id: Date.now(), kind: interceptor ? 'interceptor' : 'patrol'
      });
    }

    // ---- Police AI (skipped while frozen) ----
    if (s.freezeTimer <= 0) {
      s.cops = s.cops.map((cop, idx) => {
        const dx = p.x - cop.x, dy = p.y - cop.y;
        const dist = Math.hypot(dx, dy);
        let targetAngle = Math.atan2(dy, dx);

        for (let j = 0; j < s.cops.length; j++) {
          if (j === idx) continue;
          const other = s.cops[j];
          const odist = Math.hypot(cop.x - other.x, cop.y - other.y);
          if (odist < CAR * 2.5 && odist > 0) {
            const avoidAngle = Math.atan2(cop.y - other.y, cop.x - other.x);
            const avoidStrength = (CAR * 2.5 - odist) / (CAR * 2.5);
            targetAngle += (avoidAngle - targetAngle) * avoidStrength * 0.4;
          }
        }

        // prediction (interceptors always predict, patrols 1-in-3)
        if ((cop.kind === 'interceptor' || idx % 3 === 0) && Math.abs(p.speed) > 3) {
          const predictX = p.x + Math.cos(p.angle) * p.speed * 30;
          const predictY = p.y + Math.sin(p.angle) * p.speed * 30;
          targetAngle = Math.atan2(predictY - cop.y, predictX - cop.x);
        }

        let dAng = targetAngle - cop.angle;
        while (dAng > Math.PI) dAng -= Math.PI * 2;
        while (dAng < -Math.PI) dAng += Math.PI * 2;

        const turnSpd = (0.045 + s.stars * 0.01) * (cop.kind === 'interceptor' ? 1.4 : 1) * dt;
        const newAng = cop.angle + Math.sign(dAng) * Math.min(Math.abs(dAng), turnSpd);

        const spd = cop.spd * (dist > 300 ? 1.25 : dist < 100 ? 0.6 : 1);
        const move = spd * MAX_SPD * 0.65 * (cop.kind === 'interceptor' ? 1.12 : 1) * dt;

        let nx = cop.x + Math.cos(newAng) * move;
        let ny = cop.y + Math.sin(newAng) * move;
        nx = Math.max(CAR, Math.min(MAP - CAR, nx));
        ny = Math.max(CAR, Math.min(MAP - CAR, ny));
        return { ...cop, x: nx, y: ny, angle: newAng };
      });
    }

    // ---- Cop-vs-cop collisions ----
    let chainExplosions = 0;
    const cops = s.cops;
    const dead = new Set<number>();
    for (let i = 0; i < cops.length; i++) {
      for (let j = i + 1; j < cops.length; j++) {
        if (dead.has(i) || dead.has(j)) continue;
        const d = Math.hypot(cops[i].x - cops[j].x, cops[i].y - cops[j].y);
        const relSpeed = Math.hypot(
          Math.cos(cops[i].angle) * cops[i].spd - Math.cos(cops[j].angle) * cops[j].spd,
          Math.sin(cops[i].angle) * cops[i].spd - Math.sin(cops[j].angle) * cops[j].spd
        );
        if (d < CAR * 0.7 && relSpeed > 0.3) {
          s.explosions.push({ x: cops[i].x, y: cops[i].y, id: Date.now() + i, t: 0, big: true });
          s.explosions.push({ x: cops[j].x, y: cops[j].y, id: Date.now() + j + 1000, t: 0, big: true });
          burst(s, cops[i].x, cops[i].y, 12, '255,120,0', 3, 5);
          burst(s, cops[j].x, cops[j].y, 12, '255,120,0', 3, 5);
          dead.add(i); dead.add(j);
          s.copsDestroyed += 2;
          s.score += Math.floor(400 * s.mult);
          audio.play('explode');
          chainExplosions += 2;
        }
      }
    }
    if (dead.size) s.cops = cops.filter((_, i) => !dead.has(i));
    if (chainExplosions >= 3) unlock(s, 'chain_reaction');
    if (s.copsDestroyed >= 10) unlock(s, 'destroyer');
    if (s.copsDestroyed >= 25) unlock(s, 'demolition');

    // ---- Near miss & player collision ----
    s.invincible = Math.max(0, s.invincible - dt * 16.67);
    s.shake = Math.max(0, s.shake - dt * 16.67);

    for (const cop of s.cops) {
      const dist = Math.hypot(s.player.x - cop.x, s.player.y - cop.y);

      if (dist < 65 && dist > 38 && Math.abs(s.player.speed) > 3) {
        s.nearMissStreak++;
        s.maxNearMiss = Math.max(s.maxNearMiss, s.nearMissStreak);
        s.score += Math.floor(30 * s.mult * s.nearMissStreak);
        s.mult = Math.min(s.mult + 0.2, 10);
        s.multTimer = 4000;
        if (s.maxNearMiss >= 10) unlock(s, 'close_call');
      } else if (dist >= 100) {
        s.nearMissStreak = 0;
      }

      if (s.invincible <= 0 && s.player.shield <= 0 && dist < 32) {
        s.lives--;
        s.lostLives++;
        s.invincible = 2500;
        s.shake = 500;
        s.mult = 1;
        s.nearMissStreak = 0;
        audio.play('hit');
        s.explosions.push({ x: s.player.x, y: s.player.y, id: Date.now(), t: 0, big: false });
        burst(s, s.player.x, s.player.y, 14, '255,80,80', 2.5, 4);

        if (s.lives <= 0) {
          audio.play('lose');
          audio.stop();
          s.gameOver = true;
          return;
        }
        break;
      }
    }

    // ---- Explosions, particles, skids ----
    s.explosions = s.explosions
      .map(e => ({ ...e, t: e.t + dt * 16.67 }))
      .filter(e => e.t < (e.big ? 600 : 400));

    for (const pt of s.particles) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= 0.94; pt.vy *= 0.94;
      pt.life += dt * 16.67;
    }
    s.particles = s.particles.filter(pt => pt.life < pt.max);

    for (const sk of s.skids) sk.life += dt * 16.67;
    s.skids = s.skids.filter(sk => sk.life < 2600);

    // ---- Time-based achievements ----
    if (s.driftTime >= 30) unlock(s, 'drift_king');
    if (s.surviveTime >= 120000) unlock(s, 'survivor');
    if (s.surviveTime >= 300000) unlock(s, 'marathon');
  }, [unlock, burst]);

  // ----------------------------------------------------------
  // RENDER — draws current game state to canvas (called per frame)
  // ----------------------------------------------------------
  const render = useCallback((ctx: CanvasRenderingContext2D, s: GameState, W: number, H: number) => {
    const { player, cops, coins, powerUps, explosions, particles, skids, shake, invincible, mult, stars, newAchievement, freezeTimer } = s;

    const sx = shake > 0 ? (Math.random() - 0.5) * 14 : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * 14 : 0;
    const camX = Math.floor(player.x - W / 2 + sx);
    const camY = Math.floor(player.y - H / 2 + sy);

    // BG
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    // Grid roads
    const grid = 160, road = 55;
    ctx.fillStyle = '#2d3748';
    const startX = Math.floor(camX / grid) * grid, startY = Math.floor(camY / grid) * grid;
    for (let gx = startX - grid; gx < camX + W + grid; gx += grid)
      ctx.fillRect(Math.floor(gx - camX - road / 2), 0, road, H);
    for (let gy = startY - grid; gy < camY + H + grid; gy += grid)
      ctx.fillRect(0, Math.floor(gy - camY - road / 2), W, road);

    // Lane lines
    ctx.strokeStyle = '#ecc94b';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 16]);
    for (let gx = startX; gx < camX + W + grid; gx += grid) {
      ctx.beginPath(); ctx.moveTo(Math.floor(gx - camX), 0); ctx.lineTo(Math.floor(gx - camX), H); ctx.stroke();
    }
    for (let gy = startY; gy < camY + H + grid; gy += grid) {
      ctx.beginPath(); ctx.moveTo(0, Math.floor(gy - camY)); ctx.lineTo(W, Math.floor(gy - camY)); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Boundary
    ctx.strokeStyle = '#e53e3e';
    ctx.lineWidth = 6;
    ctx.strokeRect(-camX, -camY, MAP, MAP);

    // Skid marks (under everything)
    for (const sk of skids) {
      const kx = sk.x - camX, ky = sk.y - camY;
      if (kx < -20 || kx > W + 20 || ky < -20 || ky > H + 20) continue;
      const a = (1 - sk.life / 2600) * 0.35;
      ctx.save();
      ctx.translate(kx, ky);
      ctx.rotate(sk.a);
      ctx.fillStyle = `rgba(20,20,25,${a})`;
      ctx.fillRect(-8, -7, 16, 3);
      ctx.fillRect(-8, 4, 16, 3);
      ctx.restore();
    }

    // Particles
    for (const pt of particles) {
      const px = pt.x - camX, py = pt.y - camY;
      if (px < -10 || px > W + 10 || py < -10 || py > H + 10) continue;
      const a = 1 - pt.life / pt.max;
      ctx.fillStyle = `rgba(${pt.color},${a})`;
      ctx.beginPath();
      ctx.arc(px, py, pt.size * a + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Coins
    const time = Date.now() * 0.006;
    for (const c of coins) {
      const cx = Math.floor(c.x - camX), cy = Math.floor(c.y - camY);
      if (cx < -20 || cx > W + 20 || cy < -20 || cy > H + 20) continue;
      const pulse = 0.85 + Math.sin(time + c.id * 0.4) * 0.15;
      ctx.fillStyle = `rgba(255, 215, 0, ${pulse * 0.25})`;
      ctx.beginPath(); ctx.arc(cx, cy, 14 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
      ctx.beginPath(); ctx.arc(cx, cy, 9 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b8860b';
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    }

    // Power-ups
    const colors: Record<string, string> = { turbo: '#00ffff', shield: '#00ff88', magnet: '#ff00ff', bomb: '#ff4444', freeze: '#78dcff', repair: '#4ade80' };
    const icons: Record<string, string> = { turbo: '⚡', shield: '🛡️', magnet: '🧲', bomb: '💣', freeze: '❄️', repair: '❤️' };
    for (const pu of powerUps) {
      const px = Math.floor(pu.x - camX), py = Math.floor(pu.y - camY);
      if (px < -25 || px > W + 25 || py < -25 || py > H + 25) continue;
      const pulse = 0.8 + Math.sin(time * 1.5 + pu.id) * 0.2;
      ctx.save();
      ctx.shadowColor = colors[pu.type];
      ctx.shadowBlur = 14;
      ctx.fillStyle = colors[pu.type] + Math.floor(pulse * 200).toString(16).padStart(2, '0');
      ctx.beginPath(); ctx.arc(px, py, 15 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.font = '14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(icons[pu.type], px, py);
    }

    // Explosions
    for (const e of explosions) {
      const ex = Math.floor(e.x - camX), ey = Math.floor(e.y - camY);
      const maxT = e.big ? 600 : 400;
      const prog = e.t / maxT;
      const r = (e.big ? 30 : 20) + prog * (e.big ? 50 : 30);
      const alpha = 1 - prog;
      ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.9})`;
      ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 100, ${alpha * 0.7})`;
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.5, 0, Math.PI * 2); ctx.fill();
      if (e.big) {
        ctx.fillStyle = `rgba(255, 50, 0, ${alpha * 0.5})`;
        ctx.beginPath(); ctx.arc(ex, ey, r * 1.3, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ---- Cars ----
    const drawCar = (x: number, y: number, ang: number, kind: 'player' | CopKind, flash: boolean, frozen: boolean) => {
      if (flash) return;
      const cx = Math.floor(x - camX), cy = Math.floor(y - camY);
      if (cx < -50 || cx > W + 50 || cy < -50 || cy > H + 50) return;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      const len = CAR, w = len * 0.5;

      if (kind === 'player') {
        if (player.shield > 0) {
          ctx.fillStyle = 'rgba(0, 255, 136, 0.35)';
          ctx.beginPath(); ctx.arc(0, 0, len * 0.85, 0, Math.PI * 2); ctx.fill();
        }
        if (player.turbo > 0) {
          ctx.fillStyle = '#00d4ff';
          ctx.beginPath(); ctx.moveTo(-len / 2 - 20, 0); ctx.lineTo(-len / 2, -8); ctx.lineTo(-len / 2, 8); ctx.closePath(); ctx.fill();
        }
        if (player.magnet > 0) {
          ctx.strokeStyle = 'rgba(255, 0, 255, 0.35)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.stroke();
        }
        // body with gradient
        const grad = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
        grad.addColorStop(0, '#ffe27a'); grad.addColorStop(0.5, '#ecc94b'); grad.addColorStop(1, '#c99a1e');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.roundRect(-len / 2, -w / 2, len, w, 5); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(-len / 2 + 4, -2, len - 8, 1.5);
        ctx.fillRect(-len / 2 + 4, 0.5, len - 8, 1.5);
        ctx.fillStyle = '#1a365d';
        ctx.fillRect(len / 7, -w / 3, len / 5, w * 0.66);
        // headlights
        ctx.fillStyle = '#fff7cc';
        ctx.fillRect(len / 2 - 3, -w / 2 + 2, 3, 4);
        ctx.fillRect(len / 2 - 3, w / 2 - 6, 3, 4);
      } else {
        const interceptor = kind === 'interceptor';
        const grad = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
        if (interceptor) { grad.addColorStop(0, '#3a3a44'); grad.addColorStop(0.5, '#16161c'); grad.addColorStop(1, '#0a0a0e'); }
        else { grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.5, '#e6e6ee'); grad.addColorStop(1, '#b8b8c4'); }
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.roundRect(-len / 2, -w / 2, len, w, 4); ctx.fill();
        ctx.fillStyle = interceptor ? '#05050a' : '#1a202c';
        ctx.fillRect(-len / 2 + 2, -w / 3, len / 4, w * 0.66);
        ctx.fillRect(len / 4, -w / 3, len / 4, w * 0.66);
        // siren
        const flashOn = Math.sin(Date.now() * 0.025) > 0;
        ctx.fillStyle = flashOn ? '#e53e3e' : '#7f1d1d';
        ctx.fillRect(-4, -w / 2 + 1, 3, 4);
        ctx.fillStyle = flashOn ? '#3b82f6' : '#1e3a8a';
        ctx.fillRect(1, -w / 2 + 1, 3, 4);
        if (frozen) {
          ctx.fillStyle = 'rgba(150, 220, 255, 0.45)';
          ctx.beginPath(); ctx.roundRect(-len / 2, -w / 2, len, w, 4); ctx.fill();
        }
      }
      ctx.fillStyle = '#111';
      ctx.fillRect(-len / 3, -w / 2 - 2, 6, 3);
      ctx.fillRect(-len / 3, w / 2 - 1, 6, 3);
      ctx.fillRect(len / 4, -w / 2 - 2, 6, 3);
      ctx.fillRect(len / 4, w / 2 - 1, 6, 3);
      ctx.restore();
    };

    // Drift smoke
    if (player.drifting && Math.abs(player.speed) > 3) {
      ctx.fillStyle = 'rgba(200, 200, 200, 0.55)';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(
          Math.floor(player.x - camX - Math.cos(player.angle) * (18 + i * 10) + (Math.random() - 0.5) * 12),
          Math.floor(player.y - camY - Math.sin(player.angle) * (18 + i * 10) + (Math.random() - 0.5) * 12),
          4 + i * 3, 0, Math.PI * 2
        );
        ctx.fill();
      }
    }

    // Trail
    if (Math.abs(player.speed) > 4) {
      ctx.fillStyle = player.turbo > 0 ? 'rgba(0, 212, 255, 0.55)' : 'rgba(236, 201, 75, 0.3)';
      const len = Math.abs(player.speed) * 2.2;
      ctx.beginPath();
      ctx.ellipse(
        Math.floor(player.x - camX - Math.cos(player.angle) * len / 2),
        Math.floor(player.y - camY - Math.sin(player.angle) * len / 2),
        len / 2, 5, player.angle, 0, Math.PI * 2
      );
      ctx.fill();
    }

    const frozen = freezeTimer > 0;
    for (const c of cops) drawCar(c.x, c.y, c.angle, c.kind, false, frozen);
    const isFlash = invincible > 0 && Math.floor(invincible / 70) % 2 === 0;
    drawCar(player.x, player.y, player.angle, 'player', isFlash, false);

    // Freeze frost overlay
    if (frozen) {
      ctx.fillStyle = `rgba(140, 210, 255, ${0.10 + 0.05 * Math.sin(time * 2)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // Multiplier
    if (mult > 1) {
      ctx.fillStyle = mult >= 5 ? '#ff00ff' : '#00ff88';
      ctx.font = 'bold 32px Arial'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(`x${mult.toFixed(1)}`, W - 15, 45);
    }

    // Achievement popup
    if (newAchievement) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(W / 2 - 130, H - 70, 260, 55);
      ctx.strokeStyle = '#ecc94b'; ctx.lineWidth = 2;
      ctx.strokeRect(W / 2 - 130, H - 70, 260, 55);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
      ctx.fillText('🏆 LOGRO DESBLOQUEADO!', W / 2, H - 50);
      ctx.fillStyle = '#ecc94b'; ctx.font = '16px Arial';
      ctx.fillText(`${newAchievement.icon} ${newAchievement.name}`, W / 2, H - 28);
    }
  }, []);

  // ----------------------------------------------------------
  // MINIMAP RENDER
  // ----------------------------------------------------------
  const renderMini = useCallback((ctx: CanvasRenderingContext2D, s: GameState) => {
    const SZ = 112;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, SZ, SZ);
    const scale = SZ / MAP;

    ctx.strokeStyle = '#2d3748'; ctx.lineWidth = 1;
    for (let i = 0; i < MAP; i += 160) {
      ctx.beginPath(); ctx.moveTo(i * scale, 0); ctx.lineTo(i * scale, SZ); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * scale); ctx.lineTo(SZ, i * scale); ctx.stroke();
    }
    ctx.strokeStyle = '#e53e3e'; ctx.lineWidth = 1; ctx.strokeRect(0, 0, SZ, SZ);

    ctx.fillStyle = '#ffd70066';
    for (const c of s.coins) { ctx.beginPath(); ctx.arc(c.x * scale, c.y * scale, 1.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#00ffff';
    for (const pu of s.powerUps) { ctx.beginPath(); ctx.arc(pu.x * scale, pu.y * scale, 2, 0, Math.PI * 2); ctx.fill(); }
    for (const cop of s.cops) {
      ctx.fillStyle = cop.kind === 'interceptor' ? '#000' : '#e53e3e';
      ctx.beginPath(); ctx.arc(cop.x * scale, cop.y * scale, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ecc94b';
    ctx.beginPath(); ctx.arc(s.player.x * scale, s.player.y * scale, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ecc94b'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.player.x * scale, s.player.y * scale);
    ctx.lineTo(s.player.x * scale + Math.cos(s.player.angle) * 8, s.player.y * scale + Math.sin(s.player.angle) * 8);
    ctx.stroke();
  }, []);

  // ----------------------------------------------------------
  // FINALIZE (win / lose)
  // ----------------------------------------------------------
  const finalize = useCallback((s: GameState, won: boolean) => {
    const newRecord = saveScore(s.diff, s.score);
    setFinalStats({
      score: s.score, coinsTotal: s.coinsTotal, copsDestroyed: s.copsDestroyed,
      surviveTime: s.surviveTime, diff: s.diff, won, newRecord
    });
    setHud(snapshot(s));
    setScreen(won ? 'won' : 'over');
  }, [snapshot]);

  // ----------------------------------------------------------
  // GAME LOOP
  // ----------------------------------------------------------
  useEffect(() => {
    if (screen !== 'playing') return;
    lastT.current = performance.now();

    const frame = (ts: number) => {
      const dt = Math.min((ts - lastT.current) / 16.67, 2.5);
      lastT.current = ts;
      const s = game.current;
      if (!s) return;

      update(s, dt);

      // render
      const cv = canvasRef.current;
      const ctx = cv?.getContext('2d', { alpha: false });
      if (cv && ctx) render(ctx, s, cv.width, cv.height);
      const mini = miniRef.current;
      const mctx = mini?.getContext('2d');
      if (mctx) renderMini(mctx, s);

      // throttled HUD snapshot (~12 fps)
      hudClock.current += dt * 16.67;
      if (hudClock.current >= 80) { hudClock.current = 0; setHud(snapshot(s)); }

      // transitions
      if (s.gameOver) { finalize(s, false); return; }
      if (s.won) { finalize(s, true); return; }

      raf.current = requestAnimationFrame(frame);
    };

    raf.current = requestAnimationFrame(frame);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [screen, update, render, renderMini, snapshot, finalize]);

  // ----------------------------------------------------------
  // KEYBOARD
  // ----------------------------------------------------------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current.add(k);
      if (k === 'p' && (screenRef.current === 'playing' || screenRef.current === 'paused')) {
        setScreen(prev => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev));
      }
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // reset lastT when resuming so dt doesn't spike
  useEffect(() => { if (screen === 'playing') lastT.current = performance.now(); }, [screen]);

  // ----------------------------------------------------------
  // START / CONTROL
  // ----------------------------------------------------------
  const startGame = useCallback((d: Diff) => {
    audio.init();
    audio.resume();
    audio.startEngine();
    game.current = buildState(d);
    setHud(snapshot(game.current));
    setFinalStats(null);
    sizeCanvas();
    setScreen('playing');
  }, [buildState, snapshot, sizeCanvas]);

  const quitToMenu = useCallback(() => {
    audio.stop();
    if (raf.current) cancelAnimationFrame(raf.current);
    game.current = null;
    setMenuTick(t => t + 1);
    setScreen('menu');
  }, []);

  // ----------------------------------------------------------
  // TOUCH JOYSTICK
  // ----------------------------------------------------------
  const joyRadius = 52;
  const onJoyStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    touch.current.active = true;
    audio.resume();
  }, []);
  const onJoyMove = useCallback((e: React.PointerEvent) => {
    if (!touch.current.active || !joyRef.current) return;
    const rect = joyRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const mag = Math.hypot(dx, dy);
    const clamped = Math.min(mag, joyRadius);
    const nx = mag > 0 ? dx / mag : 0;
    const ny = mag > 0 ? dy / mag : 0;
    touch.current.dx = nx * (clamped / joyRadius);
    touch.current.dy = ny * (clamped / joyRadius);
    if (thumbRef.current) {
      thumbRef.current.style.transform = `translate(${nx * clamped}px, ${ny * clamped}px)`;
    }
  }, []);
  const onJoyEnd = useCallback((e: React.PointerEvent) => {
    touch.current.active = false;
    touch.current.dx = 0; touch.current.dy = 0;
    if (thumbRef.current) thumbRef.current.style.transform = 'translate(0px, 0px)';
  }, []);

  const onDriftStart = useCallback((e: React.PointerEvent) => { e.preventDefault(); touch.current.drift = true; audio.resume(); }, []);
  const onDriftEnd = useCallback(() => { touch.current.drift = false; }, []);

  // ----------------------------------------------------------
  // FORMAT
  // ----------------------------------------------------------
  const fmt = (ms: number) => {
    const sec = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
  };

  // ==========================================================
  // MENU SCREEN
  // ==========================================================
  if (screen === 'menu') {
    void menuTick; // re-read storage on return
    const achs = JSON.parse(localStorage.getItem('escape_achievements') || '[]') as string[];
    const best = bestScore(diff);
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-bold text-[#ecc94b] mb-1 drop-shadow-[0_0_12px_rgba(236,201,75,0.5)]">🚗 ESCAPE DRIVER</h1>
        <p className="text-[#64748b] text-sm mb-3">Escapa • Destruye • Sobrevive</p>
        <p className="text-[#00ff88] text-base mb-3">🏆 Récord {DIFF_LABEL[diff].replace(/[⭐♾️\s]+/g, ' ').trim()}: {best.toLocaleString()}</p>

        <div className="grid grid-cols-2 gap-2 w-72 mb-4">
          {(['normal', 'hard', 'impossible', 'endless'] as Diff[]).map(d => (
            <button key={d} onClick={() => setDiff(d)}
              className={`p-3 rounded-lg border-2 transition-all ${diff === d ? 'border-[#ecc94b] bg-[#ecc94b]/20 scale-105' : 'border-[#4a5568] bg-[#2d3748]'}`}>
              <span className={`font-bold text-sm ${d === 'normal' ? 'text-green-400' : d === 'hard' ? 'text-yellow-400' : d === 'impossible' ? 'text-red-400' : 'text-cyan-400'}`}>
                {DIFF_LABEL[d]}
              </span>
            </button>
          ))}
        </div>

        <button onClick={() => startGame(diff)}
          className="px-12 py-4 bg-[#ecc94b] text-[#1a1a2e] font-bold rounded-lg hover:scale-110 transition-transform text-xl mb-4 shadow-[0_0_18px_rgba(236,201,75,0.5)]">
          ▶ JUGAR
        </button>

        <div className="grid grid-cols-7 gap-1.5 mb-4 max-w-xs">
          {ACHIEVEMENTS.map(a => (
            <div key={a.id} className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${achs.includes(a.id) ? 'bg-[#ecc94b]/30' : 'bg-[#1a1a2e] opacity-30'}`} title={`${a.name}: ${a.desc}`}>
              {a.icon}
            </div>
          ))}
        </div>
        <p className="text-[#475569] text-xs mb-2">{achs.length}/{ACHIEVEMENTS.length} logros</p>

        <button onClick={() => setLocation('/')} className="text-[#64748b] hover:text-white text-sm">← Volver</button>

        <div className="mt-4 text-[#475569] text-xs space-y-1 text-center">
          <p><span className="text-[#ecc94b]">↑↓←→</span> Mover · <span className="text-[#00ffff]">ESPACIO</span> Drift · <span className="text-[#ecc94b]">P</span> Pausa{showTouch ? ' · 📱 Joystick táctil' : ''}</p>
          <p>💰 Monedas · ⚡ Turbo · 🛡️ Escudo · 🧲 Imán · ❄️ Congelar · ❤️ Vida · 💣 Bomba</p>
          <p className="text-[#e53e3e]">¡Haz que los policías choquen entre sí!</p>
        </div>
      </div>
    );
  }

  // ==========================================================
  // GAME SCREEN
  // ==========================================================
  const showTimeUp = hud && !hud.endless && hud.time < 15000;
  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center p-2 select-none">
      {/* HUD */}
      <div className="flex items-center justify-between w-full max-w-[960px] mb-2 px-2 flex-wrap gap-y-1">
        <div className="flex items-center gap-2">
          <div className="bg-black/70 px-3 py-1 rounded-lg">
            <span className="text-xl">{'❤️'.repeat(hud?.lives || 0)}{'🖤'.repeat(Math.max(0, 3 - (hud?.lives || 0)))}</span>
          </div>
          <div className="bg-black/70 px-3 py-1 rounded-lg border border-[#00ff88]">
            <p className="text-[#64748b] text-[9px]">PUNTOS</p>
            <p className="text-[#00ff88] font-bold">{(hud?.score || 0).toLocaleString()}</p>
          </div>
          <div className="bg-black/70 px-3 py-1 rounded-lg">
            <span className="text-[#ffd700]">💰 {hud?.coinsTotal || 0}</span>
          </div>
        </div>

        <div className="bg-black/70 px-4 py-1 rounded-lg border border-[#e53e3e]">
          <span className="text-xl">{'⭐'.repeat(hud?.stars || 1)}{'☆'.repeat(5 - (hud?.stars || 1))}</span>
        </div>

        <div className="bg-black/70 px-5 py-1 rounded-lg border border-[#ecc94b]">
          <p className="text-[#64748b] text-xs">{hud?.endless ? 'TIEMPO' : 'RESTANTE'}</p>
          <p className={`text-xl font-bold ${showTimeUp ? 'text-[#e53e3e] animate-pulse' : 'text-[#ecc94b]'}`}>
            {fmt(hud?.endless ? (hud?.surviveTime || 0) : (hud?.time || 0))}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hud && hud.freeze > 0 && <div className="bg-[#78dcff]/30 px-2 py-1 rounded">❄️</div>}
          {hud && hud.shield > 0 && <div className="bg-[#00ff88]/30 px-2 py-1 rounded">🛡️</div>}
          {hud && hud.turbo > 0 && <div className="bg-[#00ffff]/30 px-2 py-1 rounded">⚡</div>}
          {hud && hud.magnet > 0 && <div className="bg-[#ff00ff]/30 px-2 py-1 rounded">🧲</div>}
          <div className="bg-black/70 px-2 py-1 rounded-lg">
            <span className="text-[#e53e3e]">🚔 {hud?.copsCount || 0}</span>
          </div>
          <div className="bg-black/70 px-2 py-1 rounded-lg">
            <span className="text-[#ff6600]">💥 {hud?.copsDestroyed || 0}</span>
          </div>
          <button onClick={() => setScreen(p => (p === 'playing' ? 'paused' : p))} className="bg-black/70 px-2 py-1 rounded-lg" title="Pausa (P)">⏸</button>
          <button onClick={() => setMuted(audio.toggleMute())} className="bg-black/70 px-2 py-1 rounded-lg">
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      <div className="relative border-4 border-[#4a5568] rounded-lg overflow-hidden touch-none">
        <canvas ref={canvasRef} width={920} height={600} className="block max-w-full" />

        {/* TOUCH CONTROLS */}
        {showTouch && screen === 'playing' && (
          <>
            <div
              ref={joyRef}
              onPointerDown={onJoyStart}
              onPointerMove={onJoyMove}
              onPointerUp={onJoyEnd}
              onPointerCancel={onJoyEnd}
              className="absolute bottom-4 left-4 w-32 h-32 rounded-full bg-black/40 border-2 border-white/30 touch-none"
              style={{ touchAction: 'none' }}
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-white/30 text-3xl">✛</div>
              <div
                ref={thumbRef}
                className="absolute left-1/2 top-1/2 w-14 h-14 -ml-7 -mt-7 rounded-full bg-[#ecc94b]/70 border-2 border-white/50 pointer-events-none"
              />
            </div>
            <button
              onPointerDown={onDriftStart}
              onPointerUp={onDriftEnd}
              onPointerCancel={onDriftEnd}
              className="absolute bottom-6 right-4 w-24 h-24 rounded-full bg-[#00ffff]/30 border-2 border-[#00ffff]/60 text-[#00ffff] font-bold text-sm touch-none active:bg-[#00ffff]/50"
              style={{ touchAction: 'none' }}
            >
              DRIFT
            </button>
          </>
        )}

        {screen === 'paused' && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center">
            <h2 className="text-3xl text-[#ecc94b] mb-6">⏸ PAUSADO</h2>
            <button onClick={() => setScreen('playing')}
              className="px-8 py-3 bg-[#ecc94b] text-[#1a1a2e] font-bold rounded-lg mb-3">CONTINUAR</button>
            <button onClick={quitToMenu}
              className="px-8 py-3 border-2 border-[#e53e3e] text-[#e53e3e] rounded-lg">SALIR</button>
          </div>
        )}

        {screen === 'won' && finalStats && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center px-4">
            <h2 className="text-4xl text-[#00ff88] mb-1">🏆 ¡VICTORIA!</h2>
            {finalStats.newRecord && <p className="text-[#ff00ff] font-bold mb-1 animate-pulse">✨ ¡NUEVO RÉCORD! ✨</p>}
            <p className="text-[#ecc94b] text-5xl font-bold mb-3">{finalStats.score.toLocaleString()}</p>
            <div className="grid grid-cols-3 gap-3 text-center mb-4">
              <div><p className="text-[#ffd700] text-xl">{finalStats.coinsTotal}</p><p className="text-[#64748b] text-xs">💰 monedas</p></div>
              <div><p className="text-[#ff6600] text-xl">{finalStats.copsDestroyed}</p><p className="text-[#64748b] text-xs">💥 destruidos</p></div>
              <div><p className="text-[#ecc94b] text-xl">{fmt(finalStats.surviveTime)}</p><p className="text-[#64748b] text-xs">⏱ sobrevivido</p></div>
            </div>
            <button onClick={() => startGame(finalStats.diff)}
              className="px-8 py-3 bg-[#00ff88] text-[#1a1a2e] font-bold rounded-lg mb-3">JUGAR DE NUEVO</button>
            <button onClick={quitToMenu}
              className="px-8 py-3 border-2 border-[#ecc94b] text-[#ecc94b] rounded-lg">MENÚ</button>
          </div>
        )}

        {screen === 'over' && finalStats && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center px-4">
            <h2 className="text-4xl text-[#e53e3e] mb-1">💀 GAME OVER</h2>
            {finalStats.newRecord && <p className="text-[#ff00ff] font-bold mb-1 animate-pulse">✨ ¡NUEVO RÉCORD! ✨</p>}
            <p className="text-[#ecc94b] text-5xl font-bold mb-3">{finalStats.score.toLocaleString()}</p>
            <div className="grid grid-cols-3 gap-3 text-center mb-4">
              <div><p className="text-[#ffd700] text-xl">{finalStats.coinsTotal}</p><p className="text-[#64748b] text-xs">💰 monedas</p></div>
              <div><p className="text-[#ff6600] text-xl">{finalStats.copsDestroyed}</p><p className="text-[#64748b] text-xs">💥 destruidos</p></div>
              <div><p className="text-[#ecc94b] text-xl">{fmt(finalStats.surviveTime)}</p><p className="text-[#64748b] text-xs">⏱ sobrevivido</p></div>
            </div>
            <button onClick={() => startGame(finalStats.diff)}
              className="px-8 py-3 bg-[#ecc94b] text-[#1a1a2e] font-bold rounded-lg mb-3">REINTENTAR</button>
            <button onClick={quitToMenu}
              className="px-8 py-3 border-2 border-[#ecc94b] text-[#ecc94b] rounded-lg">MENÚ</button>
          </div>
        )}
      </div>

      {/* Minimap */}
      {screen === 'playing' && (
        <div className="fixed bottom-3 right-3 w-28 h-28 bg-black/80 border-2 border-[#4a5568] rounded-lg overflow-hidden pointer-events-none">
          <canvas ref={miniRef} width={112} height={112} />
        </div>
      )}

      <div className="mt-1 text-[#475569] text-xs text-center px-2">
        {showTouch
          ? <span><span className="text-[#ecc94b]">Joystick</span> mover · <span className="text-[#00ffff]">DRIFT</span> derrapar · <span className="text-[#e53e3e]">¡Haz chocar a los policías!</span></span>
          : <span><span className="text-[#ecc94b]">↑↓←→</span> mover · <span className="text-[#00ffff]">ESPACIO</span> drift · <span className="text-[#ecc94b]">P</span> pausa · <span className="text-[#e53e3e]">¡Haz chocar a los policías!</span></span>}
      </div>
    </div>
  );
}
