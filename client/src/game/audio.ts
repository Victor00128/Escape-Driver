// ============================================================================
// MOTOR DE AUDIO — sonido de carro REAL sintetizado con Web Audio API
// Motor multi-armónico + ruido de combustión + turbo + sirenas de policía
// (todo procedural, sin archivos externos = cero latencia de carga)
// ============================================================================

function makeNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private noiseBuf: AudioBuffer | null = null;

  // --- motor ---
  private engBus: GainNode | null = null;
  private engFilter: BiquadFilterNode | null = null;
  private sub: OscillatorNode | null = null;
  private subG: GainNode | null = null;
  private oscs: OscillatorNode[] = [];
  private oscGains: GainNode[] = [];
  private jitter: OscillatorNode | null = null;
  private jitterG: GainNode | null = null;
  private engNoise: AudioBufferSourceNode | null = null;
  private engNoiseBP: BiquadFilterNode | null = null;
  private engNoiseG: GainNode | null = null;
  // --- turbo ---
  private turbo: OscillatorNode | null = null;
  private turboG: GainNode | null = null;
  private turboBP: BiquadFilterNode | null = null;
  private turboNoise: AudioBufferSourceNode | null = null;
  private turboNoiseG: GainNode | null = null;
  // --- sirena ---
  private sirenG: GainNode | null = null;
  private sirenOsc1: OscillatorNode | null = null;
  private sirenOsc2: OscillatorNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private sirenLfoG: GainNode | null = null;
  // --- derrape ---
  private skid: AudioBufferSourceNode | null = null;
  private skidBP: BiquadFilterNode | null = null;
  private skidG: GainNode | null = null;

  private driving = false;

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.noiseBuf = makeNoiseBuffer(this.ctx);
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    } catch (e) {
      /* audio no disponible */
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.6, this.ctx.currentTime, 0.02);
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  // -------- arranque del motor / conducción --------
  startDrive() {
    const ctx = this.ctx,
      master = this.master,
      noiseBuf = this.noiseBuf;
    if (!ctx || !master || !noiseBuf || this.driving) return;
    this.driving = true;
    const t = ctx.currentTime;

    // bus del motor con filtro pasa-bajos (se abre con el acelerador)
    this.engBus = ctx.createGain();
    this.engBus.gain.value = 0.0;
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = "lowpass";
    this.engFilter.frequency.value = 400;
    this.engFilter.Q.value = 0.7;
    this.engBus.connect(this.engFilter);
    this.engFilter.connect(master);

    // sub-grave (retumbe)
    this.sub = ctx.createOscillator();
    this.sub.type = "sine";
    this.sub.frequency.value = 30;
    this.subG = ctx.createGain();
    this.subG.gain.value = 0.5;
    this.sub.connect(this.subG);
    this.subG.connect(this.engBus);
    this.sub.start(t);

    // armónicos (el "ronroneo" del cilindro)
    const harmonics = [
      { mult: 1, type: "sawtooth" as OscillatorType, gain: 0.5 },
      { mult: 2, type: "sawtooth" as OscillatorType, gain: 0.32 },
      { mult: 3, type: "square" as OscillatorType, gain: 0.16 },
      { mult: 4.5, type: "sawtooth" as OscillatorType, gain: 0.1 },
    ];
    harmonics.forEach((h) => {
      const o = ctx.createOscillator();
      o.type = h.type;
      o.frequency.value = 60 * h.mult;
      o.detune.value = (Math.random() - 0.5) * 14;
      const g = ctx.createGain();
      g.gain.value = h.gain;
      o.connect(g);
      g.connect(this.engBus!);
      o.start(t);
      this.oscs.push(o);
      this.oscGains.push(g);
    });

    // jitter de ralentí (modula la frecuencia base para que "vibre")
    this.jitter = ctx.createOscillator();
    this.jitter.type = "sine";
    this.jitter.frequency.value = 11;
    this.jitterG = ctx.createGain();
    this.jitterG.gain.value = 3;
    this.jitter.connect(this.jitterG);
    this.oscs.forEach((o) => this.jitterG!.connect(o.frequency));
    this.jitter.start(t);

    // ruido de combustión (aire/escape) filtrado por banda
    this.engNoise = ctx.createBufferSource();
    this.engNoise.buffer = noiseBuf;
    this.engNoise.loop = true;
    this.engNoiseBP = ctx.createBiquadFilter();
    this.engNoiseBP.type = "bandpass";
    this.engNoiseBP.frequency.value = 220;
    this.engNoiseBP.Q.value = 1.2;
    this.engNoiseG = ctx.createGain();
    this.engNoiseG.gain.value = 0.04;
    this.engNoise.connect(this.engNoiseBP);
    this.engNoiseBP.connect(this.engNoiseG);
    this.engNoiseG.connect(this.engBus);
    this.engNoise.start(t);

    // --- turbo (silbido + soplido) ---
    this.turbo = ctx.createOscillator();
    this.turbo.type = "triangle";
    this.turbo.frequency.value = 600;
    this.turboBP = ctx.createBiquadFilter();
    this.turboBP.type = "bandpass";
    this.turboBP.frequency.value = 1800;
    this.turboBP.Q.value = 6;
    this.turboG = ctx.createGain();
    this.turboG.gain.value = 0;
    this.turbo.connect(this.turboBP);
    this.turboBP.connect(this.turboG);
    this.turboG.connect(master);
    this.turbo.start(t);

    this.turboNoise = ctx.createBufferSource();
    this.turboNoise.buffer = noiseBuf;
    this.turboNoise.loop = true;
    const tnbp = ctx.createBiquadFilter();
    tnbp.type = "highpass";
    tnbp.frequency.value = 3000;
    this.turboNoiseG = ctx.createGain();
    this.turboNoiseG.gain.value = 0;
    this.turboNoise.connect(tnbp);
    tnbp.connect(this.turboNoiseG);
    this.turboNoiseG.connect(master);
    this.turboNoise.start(t);

    // --- derrape (chirrido de neumáticos) ---
    this.skid = ctx.createBufferSource();
    this.skid.buffer = noiseBuf;
    this.skid.loop = true;
    this.skidBP = ctx.createBiquadFilter();
    this.skidBP.type = "bandpass";
    this.skidBP.frequency.value = 1400;
    this.skidBP.Q.value = 4;
    this.skidG = ctx.createGain();
    this.skidG.gain.value = 0;
    this.skid.connect(this.skidBP);
    this.skidBP.connect(this.skidG);
    this.skidG.connect(master);
    this.skid.start(t);

    // --- sirena (dos tonos con vaivén / "wail") ---
    this.sirenG = ctx.createGain();
    this.sirenG.gain.value = 0;
    this.sirenG.connect(master);
    this.sirenOsc1 = ctx.createOscillator();
    this.sirenOsc1.type = "sawtooth";
    this.sirenOsc1.frequency.value = 760;
    this.sirenOsc2 = ctx.createOscillator();
    this.sirenOsc2.type = "square";
    this.sirenOsc2.frequency.value = 920;
    const sf = ctx.createBiquadFilter();
    sf.type = "bandpass";
    sf.frequency.value = 1100;
    sf.Q.value = 2;
    this.sirenOsc1.connect(sf);
    this.sirenOsc2.connect(sf);
    const sg2 = ctx.createGain();
    sg2.gain.value = 0.22;
    sf.connect(sg2);
    sg2.connect(this.sirenG);
    // LFO que hace subir y bajar el tono
    this.sirenLfo = ctx.createOscillator();
    this.sirenLfo.type = "sine";
    this.sirenLfo.frequency.value = 0.9;
    this.sirenLfoG = ctx.createGain();
    this.sirenLfoG.gain.value = 260;
    this.sirenLfo.connect(this.sirenLfoG);
    this.sirenLfoG.connect(this.sirenOsc1.frequency);
    this.sirenLfoG.connect(this.sirenOsc2.frequency);
    this.sirenOsc1.start(t);
    this.sirenOsc2.start(t);
    this.sirenLfo.start(t);
  }

  // Llamar cada frame con el estado del jugador
  updateDrive(opts: {
    speed: number;
    maxSpeed: number;
    throttle: number; // 0..1 carga del motor
    turbo: boolean;
    drifting: boolean;
    wanted: number; // 0..1 nivel de búsqueda / cercanía policía
  }) {
    const ctx = this.ctx;
    if (!ctx || !this.driving || !this.engBus) return;
    const now = ctx.currentTime;
    const r = Math.min(Math.abs(opts.speed) / opts.maxSpeed, 1);
    // RPM: ralentí + revoluciones según velocidad y acelerador
    const rpm = 0.16 + r * 0.74 + opts.throttle * 0.1;
    const baseFreq = 46 + rpm * 150; // Hz de la fundamental
    this.oscs.forEach((o, i) => {
      const mult = [1, 2, 3, 4.5][i] ?? 1;
      o.frequency.setTargetAtTime(baseFreq * mult, now, 0.04);
    });
    if (this.sub) this.sub.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);
    // el filtro se abre con la carga -> más brillante al acelerar
    if (this.engFilter)
      this.engFilter.frequency.setTargetAtTime(
        350 + opts.throttle * 1900 + r * 1400,
        now,
        0.05
      );
    if (this.engBus)
      this.engBus.gain.setTargetAtTime(0.16 + opts.throttle * 0.14 + r * 0.08, now, 0.05);
    if (this.engNoiseBP)
      this.engNoiseBP.frequency.setTargetAtTime(baseFreq * 3 + 120, now, 0.05);
    if (this.engNoiseG)
      this.engNoiseG.gain.setTargetAtTime(0.03 + opts.throttle * 0.08, now, 0.05);

    // turbo
    if (this.turboG && this.turbo && this.turboNoiseG && this.turboBP) {
      const tv = opts.turbo ? 0.05 + r * 0.06 : 0;
      this.turboG.gain.setTargetAtTime(tv, now, 0.08);
      this.turbo.frequency.setTargetAtTime(700 + r * 1600, now, 0.06);
      this.turboBP.frequency.setTargetAtTime(1600 + r * 1800, now, 0.06);
      this.turboNoiseG.gain.setTargetAtTime(opts.turbo ? 0.02 + r * 0.03 : 0, now, 0.1);
    }

    // derrape
    if (this.skidG && this.skidBP) {
      const sv = opts.drifting && Math.abs(opts.speed) > 2 ? 0.06 + r * 0.05 : 0;
      this.skidG.gain.setTargetAtTime(sv, now, 0.03);
      this.skidBP.frequency.setTargetAtTime(1200 + Math.random() * 500, now, 0.02);
    }

    // sirena: gana volumen con el nivel de búsqueda
    if (this.sirenG && this.sirenLfo) {
      this.sirenG.gain.setTargetAtTime(opts.wanted * 0.5, now, 0.2);
      this.sirenLfo.frequency.setTargetAtTime(0.8 + opts.wanted * 1.6, now, 0.3);
    }
  }

  setPaused(p: boolean) {
    if (!this.ctx || !this.master) return;
    // baja todo el volumen al pausar (sin matar los osciladores)
    this.master.gain.setTargetAtTime(this.muted ? 0 : p ? 0.05 : 0.6, this.ctx.currentTime, 0.05);
  }

  stopDrive() {
    if (!this.ctx) return;
    this.driving = false;
    const kill = (n: AudioScheduledSourceNode | null) => {
      if (n) {
        try {
          n.stop();
        } catch (e) {
          /* ya detenido */
        }
      }
    };
    [
      this.sub,
      this.jitter,
      this.engNoise,
      this.turbo,
      this.turboNoise,
      this.skid,
      this.sirenOsc1,
      this.sirenOsc2,
      this.sirenLfo,
      ...this.oscs,
    ].forEach((n) => kill(n as any));
    this.oscs = [];
    this.oscGains = [];
    this.sub = this.jitter = this.engNoise = this.turbo = this.turboNoise = this.skid = null;
    this.sirenOsc1 = this.sirenOsc2 = this.sirenLfo = null;
    this.engBus = null;
  }

  // -------- efectos puntuales --------
  play(type: string) {
    const ctx = this.ctx,
      master = this.master,
      noiseBuf = this.noiseBuf;
    if (!ctx || !master) return;
    const t = ctx.currentTime;

    const tone = (
      wave: OscillatorType,
      from: number,
      to: number,
      dur: number,
      vol: number
    ) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = wave;
      o.frequency.setValueAtTime(from, t);
      if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.02);
    };

    const noise = (dur: number, vol: number, type: BiquadFilterType, freq: number, sweep = 0) => {
      if (!noiseBuf) return;
      const s = ctx.createBufferSource();
      s.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(freq, t);
      if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f);
      f.connect(g);
      g.connect(master);
      s.start(t);
      s.stop(t + dur + 0.02);
    };

    switch (type) {
      case "coin":
        tone("sine", 880, 1320, 0.1, 0.18);
        tone("sine", 1760, 2640, 0.08, 0.06);
        break;
      case "powerup":
        [330, 440, 660, 880].forEach((f, i) =>
          setTimeout(() => tone("triangle", f, f * 1.5, 0.12, 0.12), i * 45)
        );
        break;
      case "explode":
        noise(0.5, 0.5, "lowpass", 1200, -1100);
        tone("sawtooth", 160, 20, 0.5, 0.4);
        tone("square", 80, 30, 0.35, 0.25);
        break;
      case "hit":
        noise(0.18, 0.4, "highpass", 1500);
        tone("square", 140, 50, 0.16, 0.3);
        break;
      case "crash":
        noise(0.25, 0.35, "bandpass", 2200);
        tone("square", 200, 60, 0.12, 0.18);
        break;
      case "star":
        tone("square", 600, 600, 0.06, 0.12);
        setTimeout(() => tone("square", 900, 900, 0.08, 0.12), 70);
        break;
      case "achieve":
        [523, 659, 784, 1047].forEach((f, i) =>
          setTimeout(() => tone("sine", f, f, 0.18, 0.13), i * 90)
        );
        break;
      case "win":
        [523, 659, 784, 1047, 1319].forEach((f, i) =>
          setTimeout(() => tone("triangle", f, f, 0.3, 0.14), i * 130)
        );
        break;
      case "lose":
        tone("sawtooth", 400, 50, 0.8, 0.2);
        tone("sawtooth", 300, 40, 0.9, 0.15);
        break;
    }
  }

  stopAll() {
    this.stopDrive();
  }
}
