// FROSTLINE — synthesised WebAudio sound.
// One clear job: every sound effect and the soft music loop, made from
// oscillators and filtered noise. No audio files, no network, no assets.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      ctx = new AudioCtx();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + (delay || 0);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, delay) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const t0 = ac.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(vol || 0.1, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(t0);
  }

  // A slow, cold music loop: low root notes with a warm fifth above them.
  const MUSIC_NOTES = [110, 130.81, 98, 146.83, 110, 164.81, 98, 130.81];
  function startMusic() {
    if (musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const root = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
      tone(root, 1.9, 'triangle', 0.045);
      tone(root * 1.5, 1.6, 'sine', 0.03, null, 0.1);
      tone(root * 2, 1.2, 'sine', 0.018, null, 0.25);
      musicStep += 1;
    }, 950);
  }

  return {
    unlock() {
      ensure();
      startMusic();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    shoot() {
      tone(740, 0.09, 'square', 0.05, 420);
    },
    brazierShot() {
      tone(520, 0.07, 'triangle', 0.045, 900);
    },
    kill() {
      tone(880, 0.12, 'sine', 0.09, 1320);
      noise(0.12, 0.05, 2400);
    },
    hit() {
      tone(180, 0.08, 'sawtooth', 0.06, 120);
    },
    place() {
      tone(220, 0.14, 'triangle', 0.12, 330);
      noise(0.1, 0.07, 900);
    },
    denied() {
      tone(140, 0.16, 'square', 0.07, 90);
    },
    stoke() {
      noise(0.25, 0.06, 700);
    },
    freeze() {
      tone(1200, 0.3, 'sine', 0.05, 500);
    },
    burst() {
      noise(0.4, 0.14, 1600);
      tone(330, 0.35, 'sawtooth', 0.08, 90);
    },
    ward() {
      tone(660, 0.4, 'sine', 0.07, 990);
      tone(990, 0.3, 'sine', 0.05, 1320, 0.08);
    },
    draft() {
      tone(523, 0.12, 'triangle', 0.09);
      tone(659, 0.12, 'triangle', 0.09, null, 0.09);
      tone(784, 0.2, 'triangle', 0.09, null, 0.18);
    },
    coin() {
      tone(1046, 0.09, 'sine', 0.08);
      tone(1318, 0.14, 'sine', 0.08, null, 0.07);
    },
    nightClear() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.09, null, i * 0.11));
    },
    boss() {
      tone(65, 0.9, 'sawtooth', 0.14, 40);
      noise(0.7, 0.1, 400);
    },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.4, 'triangle', 0.1, null, i * 0.14));
    },
    lose() {
      tone(220, 1.4, 'sawtooth', 0.1, 55);
      tone(110, 1.6, 'triangle', 0.09, 55, 0.2);
    },
  };
}
