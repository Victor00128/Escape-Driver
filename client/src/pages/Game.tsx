import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";


// audio
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

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.25;
    return this.muted;
  }

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
    if (this.engine) { this.engine.stop(); this.engine = null; }
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

// config
const MAP = 2800;
const CAR = 36;
const MAX_SPD = 13; // Reduced from 18
const ACCEL = 0.5; // Reduced from 0.7
const BRAKE = 0.7;
const FRIC = 0.97;
const TURN = 0.048;
const DRIFT_FRIC = 0.85;
const DRIFT_TURN = 0.11;
const REV_SPD = 6;

type Diff = 'normal' | 'hard' | 'impossible';

const DIFFS = {
  normal: { cops: 4, spd: 0.7, time: 120, spawn: 25, max: 10 },
  hard: { cops: 6, spd: 0.8, time: 180, spawn: 18, max: 15 },
  impossible: { cops: 8, spd: 0.9, time: 240, spawn: 12, max: 25 }
};


// logros
const ACHIEVEMENTS = [
  { id: 'first_coin', name: 'Primera Moneda', desc: 'Recoge tu primera moneda', icon: '🪙' },
  { id: 'coin_hunter', name: 'Cazador', desc: 'Recoge 50 monedas', icon: '💰' },
  { id: 'first_blood', name: 'Primera Sangre', desc: 'Destruye un policía', icon: '💥' },
  { id: 'destroyer', name: 'Destructor', desc: 'Destruye 10 policías', icon: '🔥' },
  { id: 'drift_king', name: 'Rey del Drift', desc: 'Driftea 30 segundos', icon: '💨' },
  { id: 'close_call', name: 'Por Poco', desc: '10 near miss seguidos', icon: '😰' },
  { id: 'survivor', name: 'Superviviente', desc: 'Sobrevive 2 minutos', icon: '⏱️' },
  { id: 'five_stars', name: '5 Estrellas', desc: 'Alcanza nivel máximo', icon: '⭐' },
  { id: 'untouchable', name: 'Intocable', desc: 'Gana sin perder vidas', icon: '🛡️' },
  { id: 'chain_reaction', name: 'Reacción en Cadena', desc: '3 policías explotan a la vez', icon: '💣' },
];


// tipos
interface Coin { x: number; y: number; id: number; }
interface PowerUp { x: number; y: number; id: number; type: 'turbo' | 'shield' | 'magnet' | 'bomb'; }
interface Explosion { x: number; y: number; id: number; t: number; big: boolean; }
interface Cop { x: number; y: number; angle: number; spd: number; id: number; }

interface Player {
  x: number; y: number; angle: number; speed: number;
  drifting: boolean; turbo: number; shield: number; magnet: number;
}

interface State {
  player: Player;
  cops: Cop[];
  coins: Coin[];
  powerUps: PowerUp[];
  explosions: Explosion[];
  lives: number;
  score: number;
  stars: number; // GTA stars 1-5
  mult: number;
  multTimer: number;
  coinsTotal: number;
  copsDestroyed: number;
  driftTime: number;
  nearMissStreak: number;
  maxNearMiss: number;
  gameOver: boolean;
  won: boolean;
  paused: boolean;
  time: number;
  diff: Diff;
  started: boolean;
  invincible: number;
  shake: number;
  spawnTimer: number;
  surviveTime: number;
  achievements: string[];
  newAchievement: { name: string; icon: string } | null;
  achieveTimer: number;
  lostLives: number;
}


export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setLocation] = useLocation();
  const [state, setState] = useState<State | null>(null);
  const [diff, setDiff] = useState<Diff>('normal');
  const [menu, setMenu] = useState(true);
  const [muted, setMuted] = useState(false);
  const keys = useRef<Set<string>>(new Set());
  const loop = useRef<number | null>(null);
  const lastT = useRef<number>(0);
  const stateRef = useRef<State | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);

  const makeCoins = useCallback((): Coin[] => {
    const c: Coin[] = [];
    for (let i = 0; i < 60; i++) {
      c.push({ x: 100 + Math.random() * (MAP - 200), y: 100 + Math.random() * (MAP - 200), id: i });
    }
    return c;
  }, []);

  const makePowerUps = useCallback((): PowerUp[] => {
    // Bombs are RARE - only 1 in the initial set
    const p: PowerUp[] = [];
    const types: PowerUp['type'][] = ['turbo', 'shield', 'magnet'];
    for (let i = 0; i < 6; i++) { // Less power-ups (was 10)
      p.push({ x: 150 + Math.random() * (MAP - 300), y: 150 + Math.random() * (MAP - 300), id: i, type: types[Math.floor(Math.random() * 3)] });
    }
    // Add exactly 1 bomb
    p.push({ x: 200 + Math.random() * (MAP - 400), y: 200 + Math.random() * (MAP - 400), id: 99, type: 'bomb' });
    return p;
  }, []);

  const initGame = useCallback((d: Diff) => {
    const cfg = DIFFS[d];
    const px = MAP / 2, py = MAP / 2;
    const cops: Cop[] = [];
    for (let i = 0; i < cfg.cops; i++) {
      const a = (Math.PI * 2 / cfg.cops) * i;
      const dist = 450 + Math.random() * 250;
      cops.push({ x: px + Math.cos(a) * dist, y: py + Math.sin(a) * dist, angle: Math.random() * Math.PI * 2, spd: cfg.spd, id: i });
    }

    const saved = JSON.parse(localStorage.getItem('escape_achievements') || '[]');

    setState({
      player: { x: px, y: py, angle: -Math.PI / 2, speed: 0, drifting: false, turbo: 0, shield: 0, magnet: 0 },
      cops,
      coins: makeCoins(),
      powerUps: makePowerUps(),
      explosions: [],
      lives: 3,
      score: 0,
      stars: 1,
      mult: 1,
      multTimer: 0,
      coinsTotal: 0,
      copsDestroyed: 0,
      driftTime: 0,
      nearMissStreak: 0,
      maxNearMiss: 0,
      gameOver: false,
      won: false,
      paused: false,
      time: cfg.time * 1000,
      diff: d,
      started: true,
      invincible: 0,
      shake: 0,
      spawnTimer: 0,
      surviveTime: 0,
      achievements: saved,
      newAchievement: null,
      achieveTimer: 0,
      lostLives: 0
    });

    audio.init();
    audio.startEngine();
    setMenu(false);
    lastT.current = performance.now();
  }, [makeCoins, makePowerUps]);

  // Keys
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current.add(k);
      if (k === 'p' && stateRef.current && !stateRef.current.gameOver && !stateRef.current.won) {
        setState(p => p ? { ...p, paused: !p.paused } : null);
      }
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Achievement helper
  const unlock = useCallback((s: State, id: string): State => {
    if (s.achievements.includes(id)) return s;
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (!ach) return s;
    audio.play('achieve');
    const newAchs = [...s.achievements, id];
    localStorage.setItem('escape_achievements', JSON.stringify(newAchs));
    return { ...s, achievements: newAchs, newAchievement: { name: ach.name, icon: ach.icon }, achieveTimer: 3000 };
  }, []);


  // game loop
  useEffect(() => {
    if (!state || state.gameOver || state.won || state.paused || !state.started) return;

    const tick = (ts: number) => {
      const dt = Math.min((ts - lastT.current) / 16.67, 2.5);
      lastT.current = ts;

      setState(prev => {
        if (!prev || prev.gameOver || prev.won || prev.paused) return prev;

        const k = keys.current;
        const cfg = DIFFS[prev.diff];
        let s = { ...prev };

        // Time
        s.time -= dt * 16.67;
        s.surviveTime += dt * 16.67;
        s.achieveTimer = Math.max(0, s.achieveTimer - dt * 16.67);
        if (s.achieveTimer <= 0) s.newAchievement = null;

        // Win by time
        if (s.time <= 0) {
          localStorage.setItem('escape_hs', Math.max(s.score, parseInt(localStorage.getItem('escape_hs') || '0')).toString());
          audio.play('win');
          audio.stop();
          if (s.lostLives === 0) s = unlock(s, 'untouchable');
          return { ...s, won: true, time: 0 };
        }

        // Win by destroying all cops
        if (s.cops.length === 0 && s.started) {
          localStorage.setItem('escape_hs', Math.max(s.score, parseInt(localStorage.getItem('escape_hs') || '0')).toString());
          audio.play('win');
          audio.stop();
          return { ...s, won: true };
        }

        // Player physics
        let p = { ...s.player };
        const drift = k.has(' ') && Math.abs(p.speed) > 1.5;
        p.drifting = drift;
        if (drift) {
          s.driftTime += dt * 16.67 / 1000;
          if (Math.random() < 0.3) audio.play('drift');
        }
        p.turbo = Math.max(0, p.turbo - dt * 16.67);
        p.shield = Math.max(0, p.shield - dt * 16.67);
        p.magnet = Math.max(0, p.magnet - dt * 16.67);

        const turboMult = p.turbo > 0 ? 1.8 : 1;
        const maxSpd = MAX_SPD * turboMult;

        // controles
        if (k.has('arrowup') || k.has('w')) {
          p.speed = Math.min(p.speed + ACCEL * dt, maxSpd);
        } else if (k.has('arrowdown') || k.has('s')) {
          if (p.speed > 0.5) {
            p.speed = Math.max(p.speed - BRAKE * dt, 0);
          } else {
            // reversa
            p.speed = Math.max(p.speed - ACCEL * 0.8 * dt, -REV_SPD);
          }
        } else {
          p.speed *= Math.pow(drift ? DRIFT_FRIC : FRIC, dt);
          if (Math.abs(p.speed) < 0.08) p.speed = 0;
        }

        // giros
        if (Math.abs(p.speed) > 0.15) {
          const dir = p.speed > 0 ? 1 : -1;
          const turnRate = drift ? DRIFT_TURN : TURN;
          const spdFactor = Math.min(Math.abs(p.speed) / 5, 1);
          if (k.has('arrowleft') || k.has('a')) p.angle -= turnRate * spdFactor * dir * dt;
          if (k.has('arrowright') || k.has('d')) p.angle += turnRate * spdFactor * dir * dt;
        }

        // Movement
        p.x += Math.cos(p.angle) * p.speed * dt;
        p.y += Math.sin(p.angle) * p.speed * dt;

        // bordes
        const margin = CAR * 0.6;
        if (p.x < margin) { p.x = margin + 5; p.speed = Math.abs(p.speed) * 0.5; p.angle = Math.PI - p.angle; }
        if (p.x > MAP - margin) { p.x = MAP - margin - 5; p.speed = Math.abs(p.speed) * 0.5; p.angle = Math.PI - p.angle; }
        if (p.y < margin) { p.y = margin + 5; p.speed = Math.abs(p.speed) * 0.5; p.angle = -p.angle; }
        if (p.y > MAP - margin) { p.y = MAP - margin - 5; p.speed = Math.abs(p.speed) * 0.5; p.angle = -p.angle; }

        s.player = p;
        audio.updateEngine(p.speed, MAX_SPD);

        // Multiplier decay
        s.multTimer = Math.max(0, s.multTimer - dt * 16.67);
        if (s.multTimer <= 0 && s.mult > 1) { s.mult = Math.max(1, s.mult - 0.5); s.multTimer = 2000; }

        // Coins with magnet
        let coins = s.coins.filter(c => {
          const dist = Math.hypot(p.x - c.x, p.y - c.y);

          // Magnet attraction
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
            if (s.coinsTotal === 1) s = unlock(s, 'first_coin');
            if (s.coinsTotal >= 50) s = unlock(s, 'coin_hunter');
            return false;
          }
          return true;
        });

        // Respawn coins
        if (coins.length < 30) {
          for (let i = 0; i < 15; i++) {
            coins.push({ x: 100 + Math.random() * (MAP - 200), y: 100 + Math.random() * (MAP - 200), id: Date.now() + i });
          }
        }
        s.coins = coins;

        // Power-ups
        s.powerUps = s.powerUps.filter(pu => {
          if (Math.hypot(p.x - pu.x, p.y - pu.y) < 32) {
            audio.play('powerup');
            s.score += Math.floor(150 * s.mult);
            if (pu.type === 'turbo') s.player.turbo = 6000;
            else if (pu.type === 'shield') s.player.shield = 10000;
            else if (pu.type === 'magnet') s.player.magnet = 12000;
            else if (pu.type === 'bomb' && s.cops.length > 0) {
              // Destroy nearest cop
              let minD = Infinity, idx = 0;
              s.cops.forEach((c, i) => { const d = Math.hypot(p.x - c.x, p.y - c.y); if (d < minD) { minD = d; idx = i; } });
              const cop = s.cops[idx];
              s.explosions.push({ x: cop.x, y: cop.y, id: Date.now(), t: 0, big: true });
              s.cops.splice(idx, 1);
              s.copsDestroyed++;
              s.score += Math.floor(500 * s.mult);
              audio.play('explode');
              if (s.copsDestroyed === 1) s = unlock(s, 'first_blood');
              if (s.copsDestroyed >= 10) s = unlock(s, 'destroyer');
            }
            return false;
          }
          return true;
        });

        // Respawn power-ups - bombs are RARE (10% chance)
        if (s.powerUps.length < 4 && Math.random() < 0.005 * dt) { // Less frequent spawning
          const isBomb = Math.random() < 0.1; // Only 10% chance for bomb
          const types: PowerUp['type'][] = ['turbo', 'shield', 'magnet'];
          const type = isBomb ? 'bomb' : types[Math.floor(Math.random() * 3)];
          s.powerUps.push({ x: 150 + Math.random() * (MAP - 300), y: 150 + Math.random() * (MAP - 300), id: Date.now(), type });
        }

        // GTA STAR SYSTEM - More aggression over time!
        const oldStars = s.stars;
        if (s.surviveTime > 30000 && s.stars < 2) s.stars = 2;
        if (s.surviveTime > 60000 && s.stars < 3) s.stars = 3;
        if (s.surviveTime > 100000 && s.stars < 4) s.stars = 4;
        if (s.surviveTime > 150000 && s.stars < 5) s.stars = 5;
        if (s.copsDestroyed >= 3 && s.stars < 2) s.stars = 2;
        if (s.copsDestroyed >= 6 && s.stars < 3) s.stars = 3;
        if (s.copsDestroyed >= 10 && s.stars < 4) s.stars = 4;
        if (s.stars > oldStars) audio.play('star');
        if (s.stars >= 5) s = unlock(s, 'five_stars');

        // Spawn cops based on stars
        const spawnRate = cfg.spawn * 1000 / s.stars;
        s.spawnTimer += dt * 16.67;
        const maxCopsNow = Math.min(cfg.max, 4 + s.stars * 2);
        if (s.spawnTimer >= spawnRate && s.cops.length < maxCopsNow) {
          s.spawnTimer = 0;
          const edge = Math.floor(Math.random() * 4);
          let sx, sy;
          if (edge === 0) { sx = Math.random() * MAP; sy = 30; }
          else if (edge === 1) { sx = Math.random() * MAP; sy = MAP - 30; }
          else if (edge === 2) { sx = 30; sy = Math.random() * MAP; }
          else { sx = MAP - 30; sy = Math.random() * MAP; }
          s.cops.push({ x: sx, y: sy, angle: Math.atan2(p.y - sy, p.x - sx), spd: cfg.spd * (1 + s.stars * 0.08), id: Date.now() });
        }

        // ia policia
        let cops = s.cops.map((cop, idx) => {
          const dx = p.x - cop.x, dy = p.y - cop.y;
          const dist = Math.hypot(dx, dy);
          let targetAngle = Math.atan2(dy, dx);

          // evitar otros
          for (let j = 0; j < s.cops.length; j++) {
            if (j === idx) continue;
            const other = s.cops[j];
            const odist = Math.hypot(cop.x - other.x, cop.y - other.y);
            if (odist < CAR * 2.5 && odist > 0) {
              // Push away from other cop
              const avoidAngle = Math.atan2(cop.y - other.y, cop.x - other.x);
              const avoidStrength = (CAR * 2.5 - odist) / (CAR * 2.5);
              targetAngle += (avoidAngle - targetAngle) * avoidStrength * 0.4;
            }
          }

          // prediccion
          if (idx % 3 === 0 && Math.abs(p.speed) > 3) {
            const predictX = p.x + Math.cos(p.angle) * p.speed * 30;
            const predictY = p.y + Math.sin(p.angle) * p.speed * 30;
            targetAngle = Math.atan2(predictY - cop.y, predictX - cop.x);
          }

          let diff = targetAngle - cop.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;

          const turnSpd = (0.045 + s.stars * 0.01) * dt; // Slower turning
          const newAng = cop.angle + Math.sign(diff) * Math.min(Math.abs(diff), turnSpd);

          // Speed based on distance
          let spd = cop.spd * (dist > 300 ? 1.25 : dist < 100 ? 0.6 : 1);
          const move = spd * MAX_SPD * 0.65 * dt; // Slower cops overall

          let nx = cop.x + Math.cos(newAng) * move;
          let ny = cop.y + Math.sin(newAng) * move;
          nx = Math.max(CAR, Math.min(MAP - CAR, nx));
          ny = Math.max(CAR, Math.min(MAP - CAR, ny));
          return { ...cop, x: nx, y: ny, angle: newAng };
        });

        // colisiones entre policias
        let chainExplosions = 0;
        for (let i = 0; i < cops.length; i++) {
          for (let j = i + 1; j < cops.length; j++) {
            const d = Math.hypot(cops[i].x - cops[j].x, cops[i].y - cops[j].y);
            // Must be VERY close AND both moving fast (relative to each other)
            const relSpeed = Math.hypot(
              Math.cos(cops[i].angle) * cops[i].spd - Math.cos(cops[j].angle) * cops[j].spd,
              Math.sin(cops[i].angle) * cops[i].spd - Math.sin(cops[j].angle) * cops[j].spd
            );
            if (d < CAR * 0.7 && relSpeed > 0.3) { // Harder condition
              s.explosions.push({ x: cops[i].x, y: cops[i].y, id: Date.now() + i, t: 0, big: true });
              s.explosions.push({ x: cops[j].x, y: cops[j].y, id: Date.now() + j + 1000, t: 0, big: true });
              cops[i].spd = -999;
              cops[j].spd = -999;
              s.copsDestroyed += 2;
              s.score += Math.floor(400 * s.mult); // Less reward (was 800)
              audio.play('explode');
              chainExplosions += 2;
            }
          }
        }
        cops = cops.filter(c => c.spd !== -999);
        if (chainExplosions >= 3) s = unlock(s, 'chain_reaction');
        s.cops = cops;

        // Near miss & collision with player
        s.invincible = Math.max(0, s.invincible - dt * 16.67);
        s.shake = Math.max(0, s.shake - dt * 16.67);

        let hitThisFrame = false;
        for (const cop of s.cops) {
          const dist = Math.hypot(s.player.x - cop.x, s.player.y - cop.y);

          // Near miss
          if (dist < 65 && dist > 38 && Math.abs(s.player.speed) > 3) {
            s.nearMissStreak++;
            s.maxNearMiss = Math.max(s.maxNearMiss, s.nearMissStreak);
            s.score += Math.floor(30 * s.mult * s.nearMissStreak);
            s.mult = Math.min(s.mult + 0.2, 10);
            s.multTimer = 4000;
            if (s.maxNearMiss >= 10) s = unlock(s, 'close_call');
          } else if (dist >= 100) {
            s.nearMissStreak = 0;
          }

          // Collision
          if (s.invincible <= 0 && s.player.shield <= 0 && dist < 32) {
            hitThisFrame = true;
            s.lives--;
            s.lostLives++;
            s.invincible = 2500;
            s.shake = 500;
            s.mult = 1;
            s.nearMissStreak = 0;
            audio.play('hit');
            s.explosions.push({ x: s.player.x, y: s.player.y, id: Date.now(), t: 0, big: false });

            if (s.lives <= 0) {
              localStorage.setItem('escape_hs', Math.max(s.score, parseInt(localStorage.getItem('escape_hs') || '0')).toString());
              audio.play('lose');
              audio.stop();
              return { ...s, gameOver: true };
            }
            break;
          }
        }

        // Update explosions
        s.explosions = s.explosions.map(e => ({ ...e, t: e.t + dt * 16.67 })).filter(e => e.t < (e.big ? 600 : 400));

        // Achievements
        if (s.driftTime >= 30) s = unlock(s, 'drift_king');
        if (s.surviveTime >= 120000) s = unlock(s, 'survivor');

        return s;
      });

      loop.current = requestAnimationFrame(tick);
    };

    loop.current = requestAnimationFrame(tick);
    return () => { if (loop.current) cancelAnimationFrame(loop.current); };
  }, [state?.gameOver, state?.won, state?.paused, state?.started, unlock]);

  // =========================================
  // RENDER
  // =========================================
  useEffect(() => {
    if (!state || !state.started) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const { player, cops, coins, powerUps, explosions, shake, invincible, mult, stars, newAchievement } = state;

    const sx = shake > 0 ? (Math.random() - 0.5) * 14 : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * 14 : 0;
    const camX = Math.floor(player.x - canvas.width / 2 + sx);
    const camY = Math.floor(player.y - canvas.height / 2 + sy);

    // BG
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid roads
    const grid = 160, road = 55;
    ctx.fillStyle = '#2d3748';
    const startX = Math.floor(camX / grid) * grid, startY = Math.floor(camY / grid) * grid;
    for (let gx = startX - grid; gx < camX + canvas.width + grid; gx += grid)
      ctx.fillRect(Math.floor(gx - camX - road / 2), 0, road, canvas.height);
    for (let gy = startY - grid; gy < camY + canvas.height + grid; gy += grid)
      ctx.fillRect(0, Math.floor(gy - camY - road / 2), canvas.width, road);

    // Lane lines
    ctx.strokeStyle = '#ecc94b';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 16]);
    for (let gx = startX; gx < camX + canvas.width + grid; gx += grid) {
      ctx.beginPath(); ctx.moveTo(Math.floor(gx - camX), 0); ctx.lineTo(Math.floor(gx - camX), canvas.height); ctx.stroke();
    }
    for (let gy = startY; gy < camY + canvas.height + grid; gy += grid) {
      ctx.beginPath(); ctx.moveTo(0, Math.floor(gy - camY)); ctx.lineTo(canvas.width, Math.floor(gy - camY)); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Boundary
    ctx.strokeStyle = '#e53e3e';
    ctx.lineWidth = 6;
    ctx.strokeRect(-camX, -camY, MAP, MAP);

    // Coins
    const time = Date.now() * 0.006;
    coins.forEach(c => {
      const cx = Math.floor(c.x - camX), cy = Math.floor(c.y - camY);
      if (cx < -20 || cx > canvas.width + 20 || cy < -20 || cy > canvas.height + 20) return;
      const pulse = 0.85 + Math.sin(time + c.id * 0.4) * 0.15;
      ctx.fillStyle = `rgba(255, 215, 0, ${pulse})`;
      ctx.beginPath(); ctx.arc(cx, cy, 9 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b8860b';
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    });

    // Power-ups
    const colors: Record<string, string> = { turbo: '#00ffff', shield: '#00ff88', magnet: '#ff00ff', bomb: '#ff4444' };
    const icons: Record<string, string> = { turbo: '⚡', shield: '🛡️', magnet: '🧲', bomb: '💣' };
    powerUps.forEach(pu => {
      const px = Math.floor(pu.x - camX), py = Math.floor(pu.y - camY);
      if (px < -25 || px > canvas.width + 25 || py < -25 || py > canvas.height + 25) return;
      const pulse = 0.8 + Math.sin(time * 1.5 + pu.id) * 0.2;
      ctx.fillStyle = colors[pu.type] + Math.floor(pulse * 200).toString(16).padStart(2, '0');
      ctx.beginPath(); ctx.arc(px, py, 15 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.font = '14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(icons[pu.type], px, py);
    });

    // Explosions
    explosions.forEach(e => {
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
    });

    // Cars
    const drawCar = (x: number, y: number, ang: number, isPlayer: boolean, flash: boolean) => {
      if (flash) return;
      const cx = Math.floor(x - camX), cy = Math.floor(y - camY);
      if (cx < -50 || cx > canvas.width + 50 || cy < -50 || cy > canvas.height + 50) return;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      const len = CAR, w = len * 0.5;

      if (isPlayer) {
        if (state.player.shield > 0) {
          ctx.fillStyle = 'rgba(0, 255, 136, 0.35)';
          ctx.beginPath(); ctx.arc(0, 0, len * 0.85, 0, Math.PI * 2); ctx.fill();
        }
        if (state.player.turbo > 0) {
          ctx.fillStyle = '#00d4ff';
          ctx.beginPath(); ctx.moveTo(-len / 2 - 20, 0); ctx.lineTo(-len / 2, -8); ctx.lineTo(-len / 2, 8); ctx.closePath(); ctx.fill();
        }
        if (state.player.magnet > 0) {
          ctx.strokeStyle = 'rgba(255, 0, 255, 0.35)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = '#ecc94b';
        ctx.beginPath(); ctx.roundRect(-len / 2, -w / 2, len, w, 5); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(-len / 2 + 4, -2, len - 8, 1.5);
        ctx.fillRect(-len / 2 + 4, 0.5, len - 8, 1.5);
        ctx.fillStyle = '#1a365d';
        ctx.fillRect(len / 7, -w / 3, len / 5, w * 0.66);
      } else {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.roundRect(-len / 2, -w / 2, len, w, 4); ctx.fill();
        ctx.fillStyle = '#1a202c';
        ctx.fillRect(-len / 2 + 2, -w / 3, len / 4, w * 0.66);
        ctx.fillRect(len / 4, -w / 3, len / 4, w * 0.66);
        const flash = Math.sin(Date.now() * 0.025) > 0;
        ctx.fillStyle = flash ? '#e53e3e' : '#7f1d1d';
        ctx.fillRect(-4, -w / 2 + 1, 3, 4);
        ctx.fillStyle = flash ? '#3b82f6' : '#1e3a8a';
        ctx.fillRect(1, -w / 2 + 1, 3, 4);
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

    cops.forEach(c => drawCar(c.x, c.y, c.angle, false, false));
    const isFlash = invincible > 0 && Math.floor(invincible / 70) % 2 === 0;
    drawCar(player.x, player.y, player.angle, true, isFlash);

    // Multiplier
    if (mult > 1) {
      ctx.fillStyle = mult >= 5 ? '#ff00ff' : '#00ff88';
      ctx.font = 'bold 32px Arial'; ctx.textAlign = 'right';
      ctx.fillText(`x${mult.toFixed(1)}`, canvas.width - 15, 45);
    }

    // Achievement popup
    if (newAchievement) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(canvas.width / 2 - 130, canvas.height - 70, 260, 55);
      ctx.strokeStyle = '#ecc94b'; ctx.lineWidth = 2;
      ctx.strokeRect(canvas.width / 2 - 130, canvas.height - 70, 260, 55);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
      ctx.fillText('🏆 LOGRO DESBLOQUEADO!', canvas.width / 2, canvas.height - 50);
      ctx.fillStyle = '#ecc94b'; ctx.font = '16px Arial';
      ctx.fillText(`${newAchievement.icon} ${newAchievement.name}`, canvas.width / 2, canvas.height - 28);
    }

  }, [state]);

  const fmt = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  // MENU
  if (menu) {
    const hs = parseInt(localStorage.getItem('escape_hs') || '0');
    const achs = JSON.parse(localStorage.getItem('escape_achievements') || '[]') as string[];
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-bold text-[#ecc94b] mb-1">🚗 ESCAPE DRIVER</h1>
        <p className="text-[#64748b] text-sm mb-3">Escapa • Destruye • Sobrevive</p>
        {hs > 0 && <p className="text-[#00ff88] text-lg mb-3">🏆 High Score: {hs.toLocaleString()}</p>}

        <div className="flex flex-col gap-2 w-64 mb-4">
          {(['normal', 'hard', 'impossible'] as Diff[]).map(d => (
            <button key={d} onClick={() => setDiff(d)}
              className={`p-3 rounded-lg border-2 transition-all ${diff === d ? 'border-[#ecc94b] bg-[#ecc94b]/20 scale-105' : 'border-[#4a5568] bg-[#2d3748]'}`}>
              <span className={`font-bold ${d === 'normal' ? 'text-green-400' : d === 'hard' ? 'text-yellow-400' : 'text-red-400'}`}>
                {d === 'normal' ? '⭐ NORMAL' : d === 'hard' ? '⭐⭐ DIFÍCIL' : '⭐⭐⭐ IMPOSIBLE'}
              </span>
            </button>
          ))}
        </div>

        <button onClick={() => initGame(diff)}
          className="px-12 py-4 bg-[#ecc94b] text-[#1a1a2e] font-bold rounded-lg hover:scale-110 transition-transform text-xl mb-4">
          ▶ JUGAR
        </button>

        <div className="flex gap-2 mb-4">
          {ACHIEVEMENTS.slice(0, 5).map(a => (
            <div key={a.id} className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${achs.includes(a.id) ? 'bg-[#ecc94b]/30' : 'bg-[#1a1a2e] opacity-30'}`} title={a.name}>
              {a.icon}
            </div>
          ))}
        </div>

        <button onClick={() => setLocation('/')} className="text-[#64748b] hover:text-white text-sm">← Volver</button>

        <div className="mt-4 text-[#475569] text-xs space-y-1 text-center">
          <p><span className="text-[#ecc94b]">↑↓←→</span> Mover · <span className="text-[#00ffff]">ESPACIO</span> Drift · <span className="text-[#ecc94b]">P</span> Pausa</p>
          <p>💰 Monedas · ⚡ Turbo · 🛡️ Escudo · 🧲 Imán · 💣 Bomba</p>
          <p className="text-[#e53e3e]">¡Haz que los policías choquen entre sí!</p>
        </div>
      </div>
    );
  }

  // GAME UI
  return (
    <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center p-2">
      {/* HUD */}
      <div className="flex items-center justify-between w-full max-w-[920px] mb-2 px-2">
        <div className="flex items-center gap-2">
          <div className="bg-black/70 px-3 py-1 rounded-lg">
            <span className="text-xl">{'❤️'.repeat(state?.lives || 0)}{'🖤'.repeat(3 - (state?.lives || 0))}</span>
          </div>
          <div className="bg-black/70 px-3 py-1 rounded-lg border border-[#00ff88]">
            <p className="text-[#64748b] text-[9px]">PUNTOS</p>
            <p className="text-[#00ff88] font-bold">{(state?.score || 0).toLocaleString()}</p>
          </div>
          <div className="bg-black/70 px-3 py-1 rounded-lg">
            <span className="text-[#ffd700]">💰 {state?.coinsTotal || 0}</span>
          </div>
        </div>

        {/* STARS - GTA STYLE */}
        <div className="bg-black/70 px-4 py-1 rounded-lg border border-[#e53e3e]">
          <span className="text-xl">{'⭐'.repeat(state?.stars || 1)}{'☆'.repeat(5 - (state?.stars || 1))}</span>
        </div>

        <div className="bg-black/70 px-5 py-1 rounded-lg border border-[#ecc94b]">
          <p className="text-[#64748b] text-xs">TIEMPO</p>
          <p className={`text-xl font-bold ${state && state.time < 15000 ? 'text-[#e53e3e] animate-pulse' : 'text-[#ecc94b]'}`}>
            {fmt(state?.time || 0)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {state?.player.shield && state.player.shield > 0 && <div className="bg-[#00ff88]/30 px-2 py-1 rounded">🛡️</div>}
          {state?.player.turbo && state.player.turbo > 0 && <div className="bg-[#00ffff]/30 px-2 py-1 rounded">⚡</div>}
          {state?.player.magnet && state.player.magnet > 0 && <div className="bg-[#ff00ff]/30 px-2 py-1 rounded">🧲</div>}
          <div className="bg-black/70 px-2 py-1 rounded-lg">
            <span className="text-[#e53e3e]">🚔 {state?.cops.length || 0}</span>
          </div>
          <div className="bg-black/70 px-2 py-1 rounded-lg">
            <span className="text-[#ff6600]">💥 {state?.copsDestroyed || 0}</span>
          </div>
          <button onClick={() => setMuted(audio.toggleMute())} className="bg-black/70 px-2 py-1 rounded-lg">
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      <div className="relative border-4 border-[#4a5568] rounded-lg overflow-hidden">
        <canvas ref={canvasRef} width={920} height={600} className="block" />

        {state?.paused && !state.gameOver && !state.won && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center">
            <h2 className="text-3xl text-[#ecc94b] mb-6">⏸ PAUSADO</h2>
            <button onClick={() => setState(p => p ? { ...p, paused: false } : null)}
              className="px-8 py-3 bg-[#ecc94b] text-[#1a1a2e] font-bold rounded-lg mb-3">CONTINUAR</button>
            <button onClick={() => { audio.stop(); setMenu(true); setState(null); }}
              className="px-8 py-3 border-2 border-[#e53e3e] text-[#e53e3e] rounded-lg">SALIR</button>
          </div>
        )}

        {state?.won && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center">
            <h2 className="text-4xl text-[#00ff88] mb-2">🏆 ¡VICTORIA!</h2>
            <p className="text-[#ecc94b] text-5xl font-bold mb-2">{state.score.toLocaleString()}</p>
            <p className="text-[#64748b] mb-4">💰 {state.coinsTotal} · 💥 {state.copsDestroyed} destruidos</p>
            <button onClick={() => initGame(state.diff)}
              className="px-8 py-3 bg-[#00ff88] text-[#1a1a2e] font-bold rounded-lg mb-3">JUGAR DE NUEVO</button>
            <button onClick={() => { setMenu(true); setState(null); }}
              className="px-8 py-3 border-2 border-[#ecc94b] text-[#ecc94b] rounded-lg">MENÚ</button>
          </div>
        )}

        {state?.gameOver && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center">
            <h2 className="text-4xl text-[#e53e3e] mb-2">💀 GAME OVER</h2>
            <p className="text-[#ecc94b] text-5xl font-bold mb-2">{state.score.toLocaleString()}</p>
            <p className="text-[#64748b] mb-4">💰 {state.coinsTotal} · 💥 {state.copsDestroyed} · ⏱ {fmt(state.time)}</p>
            <button onClick={() => initGame(state.diff)}
              className="px-8 py-3 bg-[#ecc94b] text-[#1a1a2e] font-bold rounded-lg mb-3">REINTENTAR</button>
            <button onClick={() => { setMenu(true); setState(null); }}
              className="px-8 py-3 border-2 border-[#ecc94b] text-[#ecc94b] rounded-lg">MENÚ</button>
          </div>
        )}
      </div>

      {/* Minimap */}
      {state && !state.paused && !state.gameOver && !state.won && (
        <div className="fixed bottom-3 right-3 w-28 h-28 bg-black/80 border-2 border-[#4a5568] rounded-lg overflow-hidden">
          <canvas
            width={112}
            height={112}
            ref={(miniCanvas) => {
              if (!miniCanvas || !state) return;
              const ctx = miniCanvas.getContext('2d');
              if (!ctx) return;

              ctx.fillStyle = '#1a1a2e';
              ctx.fillRect(0, 0, 112, 112);

              const scale = 112 / MAP;

              // Roads on minimap
              ctx.strokeStyle = '#2d3748';
              ctx.lineWidth = 1;
              for (let i = 0; i < MAP; i += 160) {
                ctx.beginPath();
                ctx.moveTo(i * scale, 0);
                ctx.lineTo(i * scale, 112);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, i * scale);
                ctx.lineTo(112, i * scale);
                ctx.stroke();
              }

              // Boundary
              ctx.strokeStyle = '#e53e3e';
              ctx.lineWidth = 1;
              ctx.strokeRect(0, 0, 112, 112);

              // Coins
              ctx.fillStyle = '#ffd70066';
              state.coins.forEach(c => {
                ctx.beginPath();
                ctx.arc(c.x * scale, c.y * scale, 1.5, 0, Math.PI * 2);
                ctx.fill();
              });

              // Power-ups
              ctx.fillStyle = '#00ffff';
              state.powerUps.forEach(pu => {
                ctx.beginPath();
                ctx.arc(pu.x * scale, pu.y * scale, 2, 0, Math.PI * 2);
                ctx.fill();
              });

              // Cops
              ctx.fillStyle = '#e53e3e';
              state.cops.forEach(cop => {
                ctx.beginPath();
                ctx.arc(cop.x * scale, cop.y * scale, 2.5, 0, Math.PI * 2);
                ctx.fill();
              });

              // Player (larger, yellow)
              ctx.fillStyle = '#ecc94b';
              ctx.beginPath();
              ctx.arc(state.player.x * scale, state.player.y * scale, 4, 0, Math.PI * 2);
              ctx.fill();

              // Player direction indicator
              ctx.strokeStyle = '#ecc94b';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(state.player.x * scale, state.player.y * scale);
              ctx.lineTo(
                state.player.x * scale + Math.cos(state.player.angle) * 8,
                state.player.y * scale + Math.sin(state.player.angle) * 8
              );
              ctx.stroke();
            }}
          />
        </div>
      )}

      <div className="mt-1 text-[#475569] text-xs">
        <span className="text-[#ecc94b]">↑↓←→</span> mover · <span className="text-[#00ffff]">ESPACIO</span> drift · <span className="text-[#ecc94b]">P</span> pausa · <span className="text-[#ffd700]">💰</span> monedas · <span className="text-[#e53e3e]">¡Haz chocar a los policías!</span>
      </div>
    </div>
  );
}
