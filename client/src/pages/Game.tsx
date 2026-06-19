import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { GameAudio } from "@/game/audio";
import {
  createGame,
  simulate,
  draw,
  Game as GameState,
  Diff,
  ACHIEVEMENTS,
  MAP,
} from "@/game/engine";
import { PAINTS } from "@/game/vehicles";

const audio = new GameAudio();

type Phase = "menu" | "playing" | "paused" | "won" | "over";

interface Hud {
  lives: number;
  score: number;
  coins: number;
  stars: number;
  time: number;
  cops: number;
  destroyed: number;
  shield: boolean;
  turbo: boolean;
  magnet: boolean;
  mult: number;
  kmh: number;
  newAch: { name: string; icon: string } | null;
}

const EMPTY_HUD: Hud = {
  lives: 3, score: 0, coins: 0, stars: 1, time: 0, cops: 0, destroyed: 0,
  shield: false, turbo: false, magnet: false, mult: 1, kmh: 0, newAch: null,
};

function snapshot(g: GameState): Hud {
  return {
    lives: g.lives, score: g.score, coins: g.coinsTotal, stars: g.stars,
    time: g.time, cops: g.cops.length, destroyed: g.copsDestroyed,
    shield: g.player.shield > 0, turbo: g.player.turbo > 0, magnet: g.player.magnet > 0,
    mult: g.mult, kmh: Math.round(Math.abs(g.player.speed) * 13), newAch: g.newAchievement,
  };
}

export default function Game() {
  const [, setLocation] = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const keys = useRef<Set<string>>(new Set());
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);
  const phaseRef = useRef<Phase>("menu");
  const hudAcc = useRef<number>(0);

  const [phase, setPhaseState] = useState<Phase>("menu");
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);
  const [muted, setMuted] = useState(false);
  const [diff, setDiff] = useState<Diff>("normal");
  const [paintIdx, setPaintIdx] = useState(0);

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  // ---------- loop principal ----------
  const frame = useCallback(
    (ts: number) => {
      raf.current = requestAnimationFrame(frame);
      const g = gameRef.current;
      const canvas = canvasRef.current;
      if (!g || !canvas) return;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;

      let dt = (ts - last.current) / 16.67;
      last.current = ts;
      if (dt > 2.5) dt = 2.5;
      if (dt < 0) dt = 0;

      if (phaseRef.current === "playing") {
        simulate(g, dt, keys.current, audio);
        if (g.phase === "won") setPhase("won");
        else if (g.phase === "over") setPhase("over");
      }

      draw(ctx, g, canvas);

      hudAcc.current += dt * 16.67;
      if (hudAcc.current >= 80) {
        hudAcc.current = 0;
        setHud(snapshot(g));
      }
    },
    [setPhase]
  );

  const startGame = useCallback(
    (d: Diff) => {
      audio.init();
      audio.resume();
      const saved = JSON.parse(localStorage.getItem("escape_achievements") || "[]");
      gameRef.current = createGame(d, PAINTS[paintIdx], saved);
      audio.startDrive();
      audio.setPaused(false);
      last.current = performance.now();
      hudAcc.current = 0;
      setHud(snapshot(gameRef.current));
      setPhase("playing");
      if (raf.current == null) raf.current = requestAnimationFrame(frame);
    },
    [paintIdx, frame, setPhase]
  );

  const goMenu = useCallback(() => {
    audio.stopAll();
    gameRef.current = null;
    if (raf.current != null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    setPhase("menu");
  }, [setPhase]);

  const togglePause = useCallback(() => {
    if (phaseRef.current === "playing") {
      setPhase("paused");
      audio.setPaused(true);
    } else if (phaseRef.current === "paused") {
      last.current = performance.now();
      audio.setPaused(false);
      setPhase("playing");
    }
  }, [setPhase]);

  // ---------- teclado ----------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current.add(k);
      if (k === "p") togglePause();
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [togglePause]);

  // limpieza al desmontar
  useEffect(() => {
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      audio.stopAll();
    };
  }, []);

  const fmt = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  };

  // ===================== MENÚ =====================
  if (phase === "menu") {
    const hs = parseInt(localStorage.getItem("escape_hs") || "0");
    const achs = JSON.parse(localStorage.getItem("escape_achievements") || "[]") as string[];
    const paint = PAINTS[paintIdx];
    return (
      <div className="min-h-screen bg-[#0a0a12] flex flex-col items-center justify-center p-4">
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00f5ff] to-[#ff00ff] mb-1">
          🚗 ESCAPE DRIVER
        </h1>
        <p className="text-[#64748b] text-sm mb-3 tracking-widest">CIUDAD 2026 · ESCAPA · DESTRUYE · SOBREVIVE</p>
        {hs > 0 && <p className="text-[#00ff88] text-lg mb-3">🏆 Récord: {hs.toLocaleString()}</p>}

        {/* selector de auto */}
        <div className="mb-3 text-center">
          <p className="text-[#64748b] text-xs mb-2">TU MÁQUINA</p>
          <div className="flex gap-2">
            {PAINTS.map((pp, i) => (
              <button
                key={pp.id}
                onClick={() => setPaintIdx(i)}
                className={`px-3 py-2 rounded-lg border-2 transition-all ${
                  paintIdx === i ? "scale-110" : "opacity-60"
                }`}
                style={{ borderColor: pp.body, boxShadow: paintIdx === i ? `0 0 14px ${pp.glow}` : "none" }}
              >
                <span className="block w-8 h-4 rounded" style={{ background: `linear-gradient(90deg, ${pp.body2}, ${pp.body})` }} />
              </button>
            ))}
          </div>
          <p className="mt-1 text-sm font-bold" style={{ color: paint.body }}>{paint.name}</p>
        </div>

        {/* dificultad */}
        <div className="flex flex-col gap-2 w-64 mb-4">
          {(["normal", "hard", "impossible"] as Diff[]).map((d) => (
            <button
              key={d}
              onClick={() => setDiff(d)}
              className={`p-3 rounded-lg border-2 transition-all ${
                diff === d ? "border-[#ecc94b] bg-[#ecc94b]/20 scale-105" : "border-[#4a5568] bg-[#161622]"
              }`}
            >
              <span className={`font-bold ${d === "normal" ? "text-green-400" : d === "hard" ? "text-yellow-400" : "text-red-400"}`}>
                {d === "normal" ? "⭐ NORMAL · 4 patrullas" : d === "hard" ? "⭐⭐ DIFÍCIL · 6 patrullas" : "⭐⭐⭐ IMPOSIBLE · 8 patrullas"}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => startGame(diff)}
          className="px-12 py-4 bg-gradient-to-r from-[#ecc94b] to-[#f59e0b] text-[#1a1a2e] font-black rounded-lg hover:scale-110 transition-transform text-xl mb-4 shadow-lg shadow-[#ecc94b]/30"
        >
          ▶ JUGAR
        </button>

        <div className="flex gap-2 mb-4 flex-wrap justify-center max-w-md">
          {ACHIEVEMENTS.map((a) => (
            <div
              key={a.id}
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${
                achs.includes(a.id) ? "bg-[#ecc94b]/30" : "bg-[#12121a] opacity-30"
              }`}
              title={`${a.name}: ${a.desc}`}
            >
              {a.icon}
            </div>
          ))}
        </div>

        <button onClick={() => setLocation("/")} className="text-[#64748b] hover:text-white text-sm">← Volver</button>

        <div className="mt-4 text-[#475569] text-xs space-y-1 text-center">
          <p>
            <span className="text-[#ecc94b]">↑↓←→ / WASD</span> Conducir · <span className="text-[#00ffff]">ESPACIO</span> Derrape ·{" "}
            <span className="text-[#ecc94b]">P</span> Pausa
          </p>
          <p>💰 Monedas · ⚡ Turbo · 🛡️ Escudo · 🧲 Imán · 💣 Bomba</p>
          <p className="text-[#e53e3e]">¡Esquiva edificios y haz chocar a las patrullas!</p>
        </div>
      </div>
    );
  }

  // ===================== JUEGO =====================
  return (
    <div className="min-h-screen bg-[#0a0a12] flex flex-col items-center justify-center p-2">
      {/* HUD */}
      <div className="flex items-center justify-between w-full max-w-[960px] mb-2 px-2 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="bg-black/70 px-3 py-1 rounded-lg">
            <span className="text-xl">{"❤️".repeat(Math.max(0, hud.lives))}{"🖤".repeat(Math.max(0, 3 - hud.lives))}</span>
          </div>
          <div className="bg-black/70 px-3 py-1 rounded-lg border border-[#00ff88]">
            <p className="text-[#64748b] text-[9px]">PUNTOS</p>
            <p className="text-[#00ff88] font-bold">{hud.score.toLocaleString()}</p>
          </div>
          <div className="bg-black/70 px-3 py-1 rounded-lg">
            <span className="text-[#ffd700]">💰 {hud.coins}</span>
          </div>
        </div>

        <div className={`bg-black/70 px-4 py-1 rounded-lg border ${hud.stars >= 3 ? "border-[#e53e3e] animate-pulse" : "border-[#e53e3e]/50"}`}>
          <span className="text-xl">{"⭐".repeat(hud.stars)}{"☆".repeat(5 - hud.stars)}</span>
        </div>

        <div className="bg-black/70 px-4 py-1 rounded-lg border border-[#00ffff]">
          <p className="text-[#64748b] text-[9px]">VELOCIDAD</p>
          <p className="text-[#00ffff] font-bold text-center">{hud.kmh} <span className="text-[9px]">km/h</span></p>
        </div>

        <div className="bg-black/70 px-5 py-1 rounded-lg border border-[#ecc94b]">
          <p className="text-[#64748b] text-xs">TIEMPO</p>
          <p className={`text-xl font-bold ${hud.time < 15000 ? "text-[#e53e3e] animate-pulse" : "text-[#ecc94b]"}`}>{fmt(hud.time)}</p>
        </div>

        <div className="flex items-center gap-2">
          {hud.shield && <div className="bg-[#00ff88]/30 px-2 py-1 rounded">🛡️</div>}
          {hud.turbo && <div className="bg-[#00ffff]/30 px-2 py-1 rounded">⚡</div>}
          {hud.magnet && <div className="bg-[#ff00ff]/30 px-2 py-1 rounded">🧲</div>}
          <div className="bg-black/70 px-2 py-1 rounded-lg"><span className="text-[#e53e3e]">🚔 {hud.cops}</span></div>
          <div className="bg-black/70 px-2 py-1 rounded-lg"><span className="text-[#ff6600]">💥 {hud.destroyed}</span></div>
          <button onClick={() => setMuted(audio.toggleMute())} className="bg-black/70 px-2 py-1 rounded-lg">
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>

      <div className="relative border-4 border-[#1f2937] rounded-lg overflow-hidden shadow-2xl shadow-[#00f5ff]/10">
        <canvas ref={canvasRef} width={960} height={600} className="block" />

        {phase === "paused" && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center">
            <h2 className="text-3xl text-[#ecc94b] mb-6">⏸ PAUSADO</h2>
            <button onClick={togglePause} className="px-8 py-3 bg-[#ecc94b] text-[#1a1a2e] font-bold rounded-lg mb-3">CONTINUAR</button>
            <button onClick={goMenu} className="px-8 py-3 border-2 border-[#e53e3e] text-[#e53e3e] rounded-lg">SALIR</button>
          </div>
        )}

        {phase === "won" && gameRef.current && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center">
            <h2 className="text-4xl text-[#00ff88] mb-2">🏆 ¡VICTORIA!</h2>
            <p className="text-[#ecc94b] text-5xl font-bold mb-2">{hud.score.toLocaleString()}</p>
            <p className="text-[#64748b] mb-4">💰 {hud.coins} · 💥 {hud.destroyed} destruidos</p>
            <button onClick={() => startGame(diff)} className="px-8 py-3 bg-[#00ff88] text-[#1a1a2e] font-bold rounded-lg mb-3">JUGAR DE NUEVO</button>
            <button onClick={goMenu} className="px-8 py-3 border-2 border-[#ecc94b] text-[#ecc94b] rounded-lg">MENÚ</button>
          </div>
        )}

        {phase === "over" && (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center">
            <h2 className="text-4xl text-[#e53e3e] mb-2">💀 GAME OVER</h2>
            <p className="text-[#ecc94b] text-5xl font-bold mb-2">{hud.score.toLocaleString()}</p>
            <p className="text-[#64748b] mb-4">💰 {hud.coins} · 💥 {hud.destroyed} · ⏱ {fmt(hud.time)}</p>
            <button onClick={() => startGame(diff)} className="px-8 py-3 bg-[#ecc94b] text-[#1a1a2e] font-bold rounded-lg mb-3">REINTENTAR</button>
            <button onClick={goMenu} className="px-8 py-3 border-2 border-[#ecc94b] text-[#ecc94b] rounded-lg">MENÚ</button>
          </div>
        )}

        {/* multiplicador */}
        {hud.mult > 1 && phase === "playing" && (
          <div className="absolute top-2 right-3 pointer-events-none">
            <span className={`font-black text-3xl ${hud.mult >= 5 ? "text-[#ff00ff]" : "text-[#00ff88]"}`} style={{ textShadow: "0 0 10px currentColor" }}>
              x{hud.mult.toFixed(1)}
            </span>
          </div>
        )}

        {/* logro */}
        {hud.newAch && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/85 border-2 border-[#ecc94b] rounded-lg px-5 py-2 text-center pointer-events-none">
            <p className="text-white text-xs font-bold">🏆 LOGRO DESBLOQUEADO</p>
            <p className="text-[#ecc94b]">{hud.newAch.icon} {hud.newAch.name}</p>
          </div>
        )}
      </div>

      {/* minimapa */}
      {(phase === "playing" || phase === "paused") && (
        <div className="fixed bottom-3 right-3 w-32 h-32 bg-black/80 border-2 border-[#4a5568] rounded-lg overflow-hidden">
          <canvas
            width={128}
            height={128}
            ref={(mini) => {
              const g = gameRef.current;
              if (!mini || !g) return;
              const ctx = mini.getContext("2d");
              if (!ctx) return;
              const sc = 128 / MAP;
              ctx.fillStyle = "#0a0a12";
              ctx.fillRect(0, 0, 128, 128);
              // manzanas
              for (const lot of g.city.lots) {
                ctx.fillStyle = lot.ground === "grass" ? "#16361f" : lot.ground === "water" ? "#0e2a4a" : "#23232f";
                ctx.fillRect(lot.x * sc, lot.y * sc, lot.w * sc, lot.h * sc);
              }
              ctx.strokeStyle = "#e53e3e";
              ctx.lineWidth = 1;
              ctx.strokeRect(0, 0, 128, 128);
              // power-ups
              ctx.fillStyle = "#00ffff";
              for (const pu of g.powerUps) { ctx.beginPath(); ctx.arc(pu.x * sc, pu.y * sc, 2, 0, Math.PI * 2); ctx.fill(); }
              // patrullas
              ctx.fillStyle = "#ff3b3b";
              for (const c of g.cops) { ctx.beginPath(); ctx.arc(c.x * sc, c.y * sc, 2.4, 0, Math.PI * 2); ctx.fill(); }
              // jugador
              ctx.fillStyle = g.paint.body;
              ctx.beginPath();
              ctx.arc(g.player.x * sc, g.player.y * sc, 3.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = g.paint.body;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(g.player.x * sc, g.player.y * sc);
              ctx.lineTo(g.player.x * sc + Math.cos(g.player.angle) * 8, g.player.y * sc + Math.sin(g.player.angle) * 8);
              ctx.stroke();
            }}
          />
        </div>
      )}

      <div className="mt-1 text-[#475569] text-xs">
        <span className="text-[#ecc94b]">↑↓←→</span> conducir · <span className="text-[#00ffff]">ESPACIO</span> derrape ·{" "}
        <span className="text-[#ecc94b]">P</span> pausa · <span className="text-[#e53e3e]">¡Haz chocar a las patrullas!</span>
      </div>
    </div>
  );
}
