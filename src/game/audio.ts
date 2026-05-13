'use client';

// Procedural audio for Warriors of the Clans.
// We can't ship music asset files, so every layer here is generated live with
// the Web Audio API: cricket chirps at night, a calm day pad, a tense hunt
// stinger when you crouch/pounce, and a dramatic battle bed when other cats
// are nearby. iOS Safari requires AudioContext to start from a user gesture,
// so we lazy-init on the first audible call.

type Mode = 'silent' | 'day' | 'night' | 'hunt' | 'battle' | 'sleep';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private currentMode: Mode = 'silent';
  private nodes: { stop: () => void }[] = [];
  private muted = false;
  private volume = 0.6;

  setMuted(v: boolean) {
    this.muted = v;
    if (this.master) this.master.gain.value = v ? 0 : this.volume;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) this.master.gain.value = this.volume;
  }

  // Must be called from a user gesture on iOS. Safe to call repeatedly.
  ensure() {
    if (this.ctx) return this.ctx;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      const ctx: AudioContext = new Ctx();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : this.volume;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  setMode(mode: Mode) {
    if (mode === this.currentMode) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Stop the previous mode's voices
    this.nodes.forEach((n) => { try { n.stop(); } catch {} });
    this.nodes = [];
    this.currentMode = mode;

    if (mode === 'silent') return;
    if (mode === 'day') this.playDay();
    if (mode === 'night') this.playNight();
    if (mode === 'hunt') this.playHunt();
    if (mode === 'battle') this.playBattle();
    if (mode === 'sleep') this.playSleep();
  }

  private playDay() {
    const ctx = this.ctx!, master = this.master!;
    // Soft warm pad — two slow sine voices a fifth apart, low in the mix
    const stops: (() => void)[] = [];
    [220, 330].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.04 - i * 0.01, ctx.currentTime + 1.2);
      osc.connect(g).connect(master);
      osc.start();
      stops.push(() => {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
        osc.stop(ctx.currentTime + 0.7);
      });
    });
    // Birdsong — high triangle blips at random intervals
    let cancelled = false;
    const bird = () => {
      if (cancelled) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      const base = 1800 + Math.random() * 900;
      o.frequency.setValueAtTime(base, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(base * 1.25, ctx.currentTime + 0.08);
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      o.connect(g).connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.2);
      setTimeout(bird, 1800 + Math.random() * 4500);
    };
    bird();
    stops.push(() => { cancelled = true; });
    this.nodes.push({ stop: () => stops.forEach((s) => s()) });
  }

  private playNight() {
    const ctx = this.ctx!, master = this.master!;
    const stops: (() => void)[] = [];

    // Crickets — short bursts of band-passed white noise at random
    // intervals. We deliberately avoid any rhythmic grouping (the old
    // "3 quick chirps then a long silence" pattern made the chorus
    // sound melodic — players were hearing a "twinkle twinkle" rhythm).
    // Each chirp has its own delay, pitch, length, and gain so it
    // reads as a few separate crickets calling at random.
    let cancelled = false;
    const cricket = () => {
      if (cancelled) return;
      const buf = ctx.createBuffer(1, 1024 + Math.floor(Math.random() * 1536), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      // Wider pitch spread so successive chirps don't lock onto a scale.
      bp.frequency.value = 3200 + Math.random() * 3000;
      bp.Q.value = 14 + Math.random() * 14;
      const g = ctx.createGain();
      const gain = 0.06 + Math.random() * 0.06;
      const dur = 0.04 + Math.random() * 0.05;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      src.connect(bp).connect(g).connect(master);
      src.start();
      src.stop(ctx.currentTime + dur + 0.01);
      // Single random delay, no grouping. Long-tailed distribution so
      // most chirps are close together but the occasional pause is much
      // longer — that breaks any sense of beat.
      const r = Math.random();
      const next = r < 0.7 ? 0.18 + Math.random() * 0.5
                  : r < 0.95 ? 0.6 + Math.random() * 1.4
                  : 2.0 + Math.random() * 2.5;
      setTimeout(cricket, next * 1000);
    };
    cricket();

    // Owl hoots — rare, breathier and pitch-stable so it doesn't drop
    // a "Twinkle Twinkle"-style melodic note over the cricket bed.
    const owl = () => {
      if (cancelled) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      // Fixed-ish low pitch with only a tiny detune jitter — no glide.
      const f = 165 + Math.random() * 25;
      o.frequency.setValueAtTime(f, ctx.currentTime);
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      o.connect(g).connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.65);
      setTimeout(owl, 22_000 + Math.random() * 25_000);
    };
    setTimeout(owl, 5000);

    // Low wind drone
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const wind = ctx.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const wg = ctx.createGain();
    wg.gain.value = 0.025;
    wind.connect(lp).connect(wg).connect(master);
    wind.start();

    stops.push(() => {
      cancelled = true;
      wg.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      wind.stop(ctx.currentTime + 0.5);
    });
    this.nodes.push({ stop: () => stops.forEach((s) => s()) });
  }

  private playHunt() {
    const ctx = this.ctx!, master = this.master!;
    const stops: (() => void)[] = [];

    // Tense low cello-ish drone, plus rhythmic woodblock pulses.
    // A slow LFO modulates the drone's pitch (~±4 Hz around 82) so the
    // tone breathes instead of sitting on a flat sawtooth.
    const drone = ctx.createOscillator();
    const dg = ctx.createGain();
    drone.type = 'sawtooth';
    drone.frequency.value = 82;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 240;
    dg.gain.value = 0;
    drone.connect(dlp).connect(dg).connect(master);
    drone.start();
    dg.gain.linearRampToValueAtTime(0.10, ctx.currentTime + 0.4);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.45;
    lfoGain.gain.value = 4;
    lfo.connect(lfoGain).connect(drone.frequency);
    lfo.start();

    // Heartbeat rhythm
    let cancelled = false;
    const beat = () => {
      if (cancelled) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(80, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.20, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      o.connect(g).connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.2);
      setTimeout(beat, 600);
    };
    beat();

    stops.push(() => {
      cancelled = true;
      dg.gain.cancelScheduledValues(ctx.currentTime);
      dg.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      drone.stop(ctx.currentTime + 0.5);
      try { lfo.stop(ctx.currentTime + 0.5); } catch {}
    });
    this.nodes.push({ stop: () => stops.forEach((s) => s()) });
  }

  private playBattle() {
    const ctx = this.ctx!, master = this.master!;
    const stops: (() => void)[] = [];

    // Power-chord style stab — root + fifth, sawtooth, with a slow LFO on the
    // filter cutoff for that "rising tension" feel.
    const root = 110, fifth = 165;
    [root, fifth, root * 2].forEach((f) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = f;
      g.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 600;
      // pulsing filter
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.4;
      lfoG.gain.value = 400;
      lfo.connect(lfoG).connect(lp.frequency);
      lfo.start();

      o.connect(lp).connect(g).connect(master);
      o.start();
      g.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 0.4);
      stops.push(() => {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
        o.stop(ctx.currentTime + 0.5);
        lfo.stop(ctx.currentTime + 0.5);
      });
    });

    // Tribal kick on the offbeat
    let cancelled = false;
    const kick = () => {
      if (cancelled) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(120, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(36, ctx.currentTime + 0.18);
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      o.connect(g).connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.25);
      setTimeout(kick, 420);
    };
    kick();
    stops.push(() => { cancelled = true; });
    this.nodes.push({ stop: () => stops.forEach((s) => s()) });
  }

  private playSleep() {
    // Slow, reassuring pad — fades in, used by the sleep cutscene
    const ctx = this.ctx!, master = this.master!;
    const stops: (() => void)[] = [];
    [110, 165, 220].forEach((f) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1.5);
      o.connect(g).connect(master);
      o.start();
      stops.push(() => {
        g.gain.cancelScheduledValues(ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
        o.stop(ctx.currentTime + 1.1);
      });
    });
    this.nodes.push({ stop: () => stops.forEach((s) => s()) });
  }

  // One-shot UI sound — does not interrupt the current background mode.
  // Used today only by the "Missed!" pounce feedback.
  playStinger(kind: 'miss') {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const master = this.master;
    if (kind === 'miss') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(360, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.18);
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      o.connect(g).connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.25);
    }
  }
}

let _engine: AudioEngine | null = null;
export function getAudioEngine(): AudioEngine {
  if (!_engine) _engine = new AudioEngine();
  return _engine!;
}

export type { Mode as AudioMode };
