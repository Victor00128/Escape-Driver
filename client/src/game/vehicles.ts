// ============================================================================
// VEHÍCULOS 2026 — render top-down detallado: carrocería con degradado,
// cabina, faros/luces LED, llantas, alerón. Patrullas con barra de luces.
// ============================================================================

export interface CarPaint {
  id: string;
  name: string;
  body: string;
  body2: string;
  accent: string;
  glow: string;
}

// modelos seleccionables del jugador (hiperdeportivos 2026)
export const PAINTS: CarPaint[] = [
  { id: "velocity", name: "VELOCITY X", body: "#1ec8ff", body2: "#0a6cff", accent: "#e6faff", glow: "#00e5ff" },
  { id: "inferno", name: "INFERNO GT", body: "#ff5a2c", body2: "#c0220c", accent: "#ffd9a0", glow: "#ff6a00" },
  { id: "toxic", name: "TOXIC EV", body: "#9dff3c", body2: "#2fae20", accent: "#eaffd0", glow: "#7dff00" },
  { id: "phantom", name: "PHANTOM", body: "#c46bff", body2: "#7a1fd6", accent: "#f3e0ff", glow: "#c34bff" },
];

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ---- carro del jugador (hiperdeportivo) ----
export function drawPlayerCar(
  ctx: CanvasRenderingContext2D,
  paint: CarPaint,
  len: number,
  opts: { braking: boolean; turbo: boolean; shield: number; magnet: number; t: number }
) {
  const w = len * 0.52;
  const hl = len / 2;
  const hw = w / 2;

  // sombra
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(2, 3, hl * 0.95, hw * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();

  // resplandor inferior (underglow)
  ctx.save();
  ctx.shadowColor = paint.glow;
  ctx.shadowBlur = 16;
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(-hl, -hw, len, w);
  ctx.restore();

  // llantas
  ctx.fillStyle = "#0a0a0a";
  const wheel = (wx: number, wy: number) => {
    roundRectPath(ctx, wx - 5, wy - 3.5, 10, 7, 2);
    ctx.fill();
  };
  wheel(-hl * 0.55, -hw - 1.5);
  wheel(-hl * 0.55, hw + 1.5);
  wheel(hl * 0.5, -hw - 1.5);
  wheel(hl * 0.5, hw + 1.5);

  // carrocería con degradado longitudinal
  const grad = ctx.createLinearGradient(-hl, 0, hl, 0);
  grad.addColorStop(0, paint.body2);
  grad.addColorStop(0.5, paint.body);
  grad.addColorStop(1, paint.body2);
  ctx.fillStyle = grad;
  ctx.beginPath();
  // forma de cuña: morro afilado al frente (+x)
  ctx.moveTo(hl, 0);
  ctx.lineTo(hl - 6, -hw + 1);
  ctx.lineTo(-hl + 5, -hw);
  ctx.quadraticCurveTo(-hl, -hw, -hl, -hw + 4);
  ctx.lineTo(-hl, hw - 4);
  ctx.quadraticCurveTo(-hl, hw, -hl + 5, hw);
  ctx.lineTo(hl - 6, hw - 1);
  ctx.closePath();
  ctx.fill();

  // brillo superior (reflejo)
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.moveTo(hl - 8, -hw + 2);
  ctx.lineTo(-hl + 6, -hw + 2);
  ctx.lineTo(-hl + 6, -1);
  ctx.lineTo(hl - 8, -2);
  ctx.closePath();
  ctx.fill();

  // franjas de carrera
  ctx.fillStyle = paint.accent;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(-hl + 4, -2.5, len - 10, 1.6);
  ctx.fillRect(-hl + 4, 1, len - 10, 1.6);
  ctx.globalAlpha = 1;

  // cabina / parabrisas (vidrio oscuro)
  const gg = ctx.createLinearGradient(0, -hw, 0, hw);
  gg.addColorStop(0, "#0b1626");
  gg.addColorStop(0.5, "#1f3a5c");
  gg.addColorStop(1, "#0b1626");
  ctx.fillStyle = gg;
  roundRectPath(ctx, -len * 0.06, -hw * 0.66, len * 0.3, w * 0.66, 3);
  ctx.fill();

  // alerón trasero
  ctx.fillStyle = paint.body2;
  ctx.fillRect(-hl - 1, -hw + 2, 4, w - 4);

  // faros LED delanteros (resplandor)
  ctx.save();
  ctx.shadowColor = "#cdefff";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#eaffff";
  ctx.fillRect(hl - 4, -hw + 2.5, 3, 3);
  ctx.fillRect(hl - 4, hw - 5.5, 3, 3);
  ctx.restore();

  // luces traseras (más brillantes al frenar)
  ctx.save();
  const brake = opts.braking;
  ctx.shadowColor = "#ff2a2a";
  ctx.shadowBlur = brake ? 14 : 5;
  ctx.fillStyle = brake ? "#ff5555" : "#aa1515";
  ctx.fillRect(-hl, -hw + 2.5, 2.5, 3.5);
  ctx.fillRect(-hl, hw - 6, 2.5, 3.5);
  ctx.restore();

  // llama del turbo
  if (opts.turbo) {
    const f = 0.6 + Math.random() * 0.4;
    const fg = ctx.createLinearGradient(-hl, 0, -hl - 22 * f, 0);
    fg.addColorStop(0, "#fff");
    fg.addColorStop(0.4, paint.glow);
    fg.addColorStop(1, "rgba(255,80,0,0)");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-hl, -4);
    ctx.lineTo(-hl - 22 * f, 0);
    ctx.lineTo(-hl, 4);
    ctx.closePath();
    ctx.fill();
  }

  // escudo
  if (opts.shield > 0) {
    ctx.strokeStyle = `rgba(0,255,170,${0.5 + Math.sin(opts.t * 0.2) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, hl * 1.25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(0,255,170,0.08)";
    ctx.beginPath();
    ctx.arc(0, 0, hl * 1.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // anillo del imán
  if (opts.magnet > 0) {
    ctx.strokeStyle = "rgba(255,0,255,0.3)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, hl * 2.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ---- patrulla de policía (interceptor / SUV / SWAT según tier) ----
export function drawPoliceCar(
  ctx: CanvasRenderingContext2D,
  len: number,
  tier: number,
  t: number
) {
  // tier 0 = sedán, 1 = interceptor, 2 = SWAT (más grande)
  const scale = tier >= 2 ? 1.18 : tier === 1 ? 1.06 : 1;
  const L = len * scale;
  const w = L * 0.54;
  const hl = L / 2;
  const hw = w / 2;

  // sombra
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(2, 3, hl * 0.95, hw * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();

  // llantas
  ctx.fillStyle = "#0a0a0a";
  const wheel = (wx: number, wy: number) => {
    roundRectPath(ctx, wx - 5, wy - 3.5, 10, 7, 2);
    ctx.fill();
  };
  wheel(-hl * 0.55, -hw - 1.5);
  wheel(-hl * 0.55, hw + 1.5);
  wheel(hl * 0.5, -hw - 1.5);
  wheel(hl * 0.5, hw + 1.5);

  // carrocería (negro con degradado)
  const grad = ctx.createLinearGradient(0, -hw, 0, hw);
  grad.addColorStop(0, "#2b2f36");
  grad.addColorStop(0.5, "#0e1013");
  grad.addColorStop(1, "#2b2f36");
  ctx.fillStyle = grad;
  roundRectPath(ctx, -hl, -hw, L, w, 5);
  ctx.fill();

  // panel blanco (librea) en los costados / puertas
  ctx.fillStyle = "#e9edf2";
  ctx.fillRect(-hl * 0.2, -hw, L * 0.42, 4);
  ctx.fillRect(-hl * 0.2, hw - 4, L * 0.42, 4);

  // barra de empuje (push bar) delantera
  ctx.strokeStyle = "#c9d2dd";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hl, -hw + 3);
  ctx.lineTo(hl + 3, -hw + 3);
  ctx.lineTo(hl + 3, hw - 3);
  ctx.lineTo(hl, hw - 3);
  ctx.stroke();

  // parabrisas
  ctx.fillStyle = "#0a1420";
  roundRectPath(ctx, hl * 0.05, -hw * 0.62, L * 0.22, w * 0.62, 2);
  ctx.fill();

  // faros
  ctx.fillStyle = "#fffbe0";
  ctx.fillRect(hl - 3, -hw + 2.5, 2.5, 3);
  ctx.fillRect(hl - 3, hw - 5.5, 2.5, 3);

  // barra de luces (roja/azul alternando con resplandor)
  const phase = Math.floor(t * 0.012) % 2 === 0;
  ctx.save();
  ctx.shadowBlur = 12;
  // rojo (izquierda)
  ctx.shadowColor = "#ff2a2a";
  ctx.fillStyle = phase ? "#ff3030" : "#5a0d0d";
  ctx.fillRect(-2.5, -hw * 0.7, 2.5, w * 0.7);
  // azul (derecha)
  ctx.shadowColor = "#2a6bff";
  ctx.fillStyle = phase ? "#3a0d0d" : "#3b6bff";
  ctx.fillRect(0.5, -hw * 0.7, 2.5, w * 0.7);
  ctx.restore();

  // distintivo SWAT
  if (tier >= 2) {
    ctx.fillStyle = "#3a4250";
    roundRectPath(ctx, -hl + 2, -hw + 2, 5, w - 4, 1);
    ctx.fill();
  }
}

// ---- carro civil de tráfico ----
export function drawTrafficCar(ctx: CanvasRenderingContext2D, len: number, color: string) {
  const w = len * 0.5;
  const hl = len / 2;
  const hw = w / 2;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(1, 2, hl * 0.9, hw, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(-hl * 0.5 - 4, -hw - 1.5, 8, 3);
  ctx.fillRect(-hl * 0.5 - 4, hw - 1.5, 8, 3);
  ctx.fillRect(hl * 0.5 - 4, -hw - 1.5, 8, 3);
  ctx.fillRect(hl * 0.5 - 4, hw - 1.5, 8, 3);
  ctx.fillStyle = color;
  roundRectPath(ctx, -hl, -hw, len, w, 4);
  ctx.fill();
  ctx.fillStyle = "#11161f";
  roundRectPath(ctx, -len * 0.05, -hw * 0.6, len * 0.28, w * 0.6, 2);
  ctx.fill();
  ctx.fillStyle = "#fffbe0";
  ctx.fillRect(hl - 2.5, -hw + 2, 2, 2.5);
  ctx.fillRect(hl - 2.5, hw - 4, 2, 2.5);
}
