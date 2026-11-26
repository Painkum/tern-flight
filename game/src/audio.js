// Synthesised sound, no audio files: an engine drone that follows the throttle, wind that
// follows airspeed, a stall horn, a chime for each ring and beacon, and a crunch on a crash.

export function createAudio() {
  let ctx = null, engine, engineGain, wind, windGain, horn, hornGain;

  function start() {
    if (ctx) return;
    ctx = new AudioContext();
    engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engine.connect(lowpass).connect(engineGain).connect(ctx.destination);
    engine.start();

    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 1;
    for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = seed / 1073741823 - 1; }
    wind = ctx.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 700;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    wind.connect(band).connect(windGain).connect(ctx.destination);
    wind.start();

    horn = ctx.createOscillator();
    horn.type = 'square';
    horn.frequency.value = 880;
    hornGain = ctx.createGain();
    hornGain.gain.value = 0;
    horn.connect(hornGain).connect(ctx.destination);
    horn.start();
  }

  function update(a, paused) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const running = !paused && a.state !== 'crashed' && a.fuel > 0;
    engine.frequency.setTargetAtTime(46 + a.throttle * 70 + a.speed * 2, t, 0.1);
    engineGain.gain.setTargetAtTime(running ? 0.035 + a.throttle * 0.05 : 0, t, 0.15);
    windGain.gain.setTargetAtTime(paused ? 0 : Math.min(0.08, a.speed * 0.006), t, 0.2);
    hornGain.gain.setTargetAtTime(!paused && a.stalled ? 0.025 : 0, t, 0.05);
  }

  function chime() {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const [f, d] of [[880, 0], [1320, 0.09]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.12, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(t + d);
      o.stop(t + d + 0.45);
    }
  }

  function crunch() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.6);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.75);
  }

  return { start, update, chime, crunch };
}
