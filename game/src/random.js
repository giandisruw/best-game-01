// A tiny seeded generator (mulberry32) so a ?seed=N run always plays the same
// waves: screenshots and replays are reproducible, live play uses a random seed.
/** Returns a function that yields a pseudo-random number in [0, 1). */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
