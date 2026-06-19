import { useLocation } from "wouter";
import { useState, useEffect } from "react";

export default function Home() {
  const [, setLocation] = useLocation();
  const [showInstructions, setShowInstructions] = useState(false);
  const [highScore, setHighScore] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem("escape_hs");
    if (saved) setHighScore(parseInt(saved));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] grid-bg flex flex-col items-center justify-center relative overflow-hidden">
      {/* Animated Background Grid Lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-0 right-0 h-[60%]" style={{
          background: 'linear-gradient(to top, rgba(0,245,255,0.05) 0%, transparent 100%)',
          transform: 'perspective(500px) rotateX(60deg)',
          transformOrigin: 'bottom center'
        }}>
          <div className="w-full h-full" style={{
            backgroundImage: `
              linear-gradient(90deg, rgba(0,245,255,0.1) 1px, transparent 1px),
              linear-gradient(rgba(0,245,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            animation: 'gridMove 2s linear infinite'
          }} />
        </div>
      </div>

      {/* Scanlines Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-30" style={{
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 1px, transparent 1px, transparent 2px)'
      }} />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Title */}
        <div className="mb-8 text-center">
          <h1 
            className="text-4xl md:text-6xl font-black tracking-wider mb-2 neon-text-cyan neon-pulse"
            style={{ fontFamily: "'Press Start 2P', cursive", lineHeight: 1.4 }}
          >
            ESCAPE
          </h1>
          <h2 
            className="text-2xl md:text-4xl font-black tracking-wider neon-text-magenta"
            style={{ fontFamily: "'Press Start 2P', cursive", lineHeight: 1.4 }}
          >
            DRIVER
          </h2>
          <p className="text-[#00f5ff] mt-4 text-sm tracking-[0.3em] uppercase" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            Police Chase Game
          </p>
        </div>

        {/* Car ASCII Art */}
        <div className="mb-8 text-[#00f5ff] text-xs opacity-60" style={{ fontFamily: 'monospace' }}>
          <pre>{`
      ___
   __/___\\__
  |  _   _  |##
  |_| |_| |_|##
   (o)   (o)
          `}</pre>
        </div>

        {/* High Score */}
        {highScore > 0 && (
          <div className="mb-6 text-center">
            <p className="text-[#ffff00] text-xs tracking-widest" style={{ fontFamily: "'Press Start 2P', cursive" }}>
              HIGH SCORE
            </p>
            <p className="text-[#ffff00] text-2xl mt-1 neon-text-yellow" style={{ fontFamily: "'Press Start 2P', cursive" }}>
              {highScore.toLocaleString()}
            </p>
          </div>
        )}

        {/* Menu Buttons */}
        <div className="flex flex-col gap-4 w-72">
          <button
            onClick={() => setLocation("/game")}
            className="arcade-button w-full text-center flex items-center justify-center gap-3"
          >
            <span>▶</span>
            <span>JUGAR</span>
          </button>
          
          <button
            onClick={() => setShowInstructions(true)}
            className="arcade-button w-full text-center flex items-center justify-center gap-3"
            style={{ borderColor: '#ff00ff', color: '#ff00ff', boxShadow: '0 0 10px #ff00ff, 0 0 20px rgba(255,0,255,0.3), inset 0 0 10px rgba(255,0,255,0.1)' }}
          >
            <span>?</span>
            <span>INSTRUCCIONES</span>
          </button>
        </div>

        {/* Controls Preview */}
        <div className="mt-12 text-center opacity-70">
          <p className="text-[#888899] text-xs mb-3 tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            CONTROLES
          </p>
          <div className="flex gap-1 justify-center mb-2">
            <div className="w-10 h-10 border border-[#00f5ff]/50 rounded flex items-center justify-center text-[#00f5ff] text-lg">
              ↑
            </div>
          </div>
          <div className="flex gap-1 justify-center">
            <div className="w-10 h-10 border border-[#00f5ff]/50 rounded flex items-center justify-center text-[#00f5ff] text-lg">
              ←
            </div>
            <div className="w-10 h-10 border border-[#00f5ff]/50 rounded flex items-center justify-center text-[#00f5ff] text-lg">
              ↓
            </div>
            <div className="w-10 h-10 border border-[#00f5ff]/50 rounded flex items-center justify-center text-[#00f5ff] text-lg">
              →
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-12 text-[#444455] text-xs tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif" }}>
          © 2026 ESCAPE DRIVER
        </p>
      </div>

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a0a0f] neon-border-cyan rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h3 
              className="text-xl text-[#00f5ff] mb-4 text-center neon-text-cyan"
              style={{ fontFamily: "'Press Start 2P', cursive", fontSize: '14px' }}
            >
              INSTRUCCIONES
            </h3>
            
            <div className="space-y-4 text-[#e0e0e0] text-sm" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              <div>
                <h4 className="text-[#ff00ff] mb-2 font-bold">OBJETIVO</h4>
                <p className="text-[#aaaaaa] leading-relaxed">
                  Escapa de la policía el mayor tiempo posible. Recorre el mapa urbano evitando ser atrapado por las patrullas.
                </p>
              </div>

              <div>
                <h4 className="text-[#ff00ff] mb-2 font-bold">CONTROLES</h4>
                <ul className="space-y-1 text-[#aaaaaa]">
                  <li><span className="text-[#00f5ff]">↑ / W</span> - Acelerar</li>
                  <li><span className="text-[#00f5ff]">↓ / S</span> - Frenar / Reversa</li>
                  <li><span className="text-[#00f5ff]">← / A</span> - Girar izquierda</li>
                  <li><span className="text-[#00f5ff]">→ / D</span> - Girar derecha</li>
                  <li><span className="text-[#00f5ff]">ESPACIO</span> - Freno de mano</li>
                  <li><span className="text-[#00f5ff]">P</span> - Pausar</li>
                </ul>
              </div>

              <div>
                <h4 className="text-[#ff00ff] mb-2 font-bold">PUNTUACIÓN</h4>
                <ul className="space-y-1 text-[#aaaaaa]">
                  <li><span className="text-[#ffff00]">+10</span> puntos por segundo</li>
                  <li><span className="text-[#ffff00]">+50</span> evasión cercana</li>
                  <li><span className="text-[#ffff00]">+100</span> policía despistado</li>
                </ul>
              </div>

              <div>
                <h4 className="text-[#ff3366] mb-2 font-bold">VIDAS</h4>
                <p className="text-[#aaaaaa] leading-relaxed">
                  Tienes 3 vidas. Cada colisión con la policía te quita una vida. ¡Cuando pierdas todas, el juego termina!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowInstructions(false)}
              className="arcade-button w-full mt-6"
            >
              CERRAR
            </button>
          </div>
        </div>
      )}

      {/* CSS Animation */}
      <style>{`
        @keyframes gridMove {
          0% { transform: translateY(0); }
          100% { transform: translateY(60px); }
        }
      `}</style>
    </div>
  );
}
