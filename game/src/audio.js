// All sound is synthesised with WebAudio — no audio files, no network.
// A tiny sequenced music loop (a soft pad arpeggio) runs under the game; every
// action has its own short blip. Nothing is created until the first user gesture.
const NOTES = [220.0, 261.63, 329.63, 392.0, 440.0, 523.25];

/** Builds the sound board. Call unlock() from the first gesture, then play(). */
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!context || muted) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function startMusic() {
    if (musicTimer !== null || !context) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const note = NOTES[musicStep % NOTES.length];
      tone(note, 0.9, 'sine', 0.05);
      if (musicStep % 4 === 2) tone(note / 2, 1.2, 'triangle', 0.04);
      musicStep += 1;
    }, 340);
  }

  return {
    /** Call from a key/click handler: browsers only allow audio after a gesture. */
    unlock() {
      if (!ensure()) return;
      if (context.state === 'suspended') context.resume().catch(() => {});
      startMusic();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted: () => muted,
    shoot() { tone(880, 0.09, 'square', 0.06, 440); },
    hit() { tone(160, 0.25, 'sawtooth', 0.12, 60); },
    kill() { tone(520, 0.14, 'triangle', 0.1, 980); },
    mote() { tone(1046, 0.12, 'sine', 0.09, 1568); },
    dash() { tone(300, 0.12, 'sine', 0.08, 720); },
    wave() { tone(392, 0.2, 'triangle', 0.1, 784); tone(523.25, 0.3, 'triangle', 0.08, 784); },
    win() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => window.setTimeout(() => tone(f, 0.4, 'triangle', 0.1), i * 130)); },
    lose() { [392, 329.63, 261.63, 196].forEach((f, i) => window.setTimeout(() => tone(f, 0.4, 'sawtooth', 0.07), i * 160)); },
  };
}
