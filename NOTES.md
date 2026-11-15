# Lumenfall — build notes (best-game-01)

## Concept
Original top-down arena game. You are the keeper of the last lantern in a
violet night valley. Banish shadow wisps with bolts of light across 10 waves
and defeat the Gloom Herald boss on wave 10 to win (DAWN BREAKS screen).
3 hearts; lose them all and the light goes out (game-over screen).

- Enemies: wisps (drift at you), darters (fast zigzag triangles, wave 2+),
  brutes (slow, multi-hit, wave 4+), the Gloom Herald boss (wave 10, HP bar).
- Depth: combo multiplier (kills within 3s, up to x8), LIGHT energy that
  powers shots and refills from green sun motes (+score), dash with cooldown,
  wave-clear bonuses, escalating spawn rate/speed per wave, best score in
  localStorage.
- Feel: particles on every kill/hit, screen-space glow, hit invulnerability
  blink, dash ring, wave banners, pause, mute (M), synthesised WebAudio
  effects + a soft music loop (no audio files, no network).

## Controls
- Move: WASD / arrow keys. Aim: mouse. Fire: hold left-click or Space.
- Dash: Shift or right-click. Pause: P. Mute: M. Restart: R, or Space/click
  on the title / win / game-over screens.

## Layout (repo root ~/workspace/makefun-best-game-01/)
- `game/index.html` + `game/src/`: config, random (seeded), input, audio
  (WebAudio synth), world (rules, no DOM), render (canvas only), shots
  (deterministic `?shot=` scenes with an autopilot), main (loop + screens).
- `main.ts` (Node 22, stdlib only): copies game/ + screenshots/ to /output
  and writes dossier.json via `vendor/makefun-game.ts` (kit copy, unchanged).
- `serve.ts`: static server for local play (`node serve.ts` → :8080).
- `screenshots/`: 1-start, 2-play (wave 5 mid-fight), 3-win (victory panel),
  4-end (game-over panel) — 1280x720 JPEG, real renders, seed 7.
- `LICENSE` (MIT), `README.md` (requirements readme_template),
  `.makefun/owner.json`, `shots.json`. No kit files, no secrets in the repo.

## How to run / test
- Play: `node serve.ts --port 8080`, open http://127.0.0.1:8080 in Chrome.
- Shot scenes: `?shot=start|play|win|end&seed=7` (sets `window.__shotReady`).
- Build: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

## Test evidence (2026-11-16 ~01:30 WIB, this machine)
- `node --version`: v24.22.1 (≥ 22.18 required).
- Headless Chromium: Playwright Chromium 159
  (`~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`).
  NOTE: `/opt/meta-chromium/chrome` (Muse Browser) refuses to start here
  ("Hatch WebGL domain policy is required for browser startup"), so the
  Playwright Chromium was used instead. `npx playwright` was NOT needed.
- CDP playtest (`/tmp/lumen-test.mjs`, kept outside the repo):
  - All 4 shot scenes: `ready=true`, 1280x720, non-blank (117–150 distinct
    sampled colours), JPEG 20,938–44,126 bytes.
  - Plain load: title correct, canvas 1280x720. Space starts the game
    (status "Playing. Three hearts…"), W + mouse fire works, P pauses and
    resumes, a hit registered ("Hit. 2 hearts left.").
  - `CONSOLE ERRORS: []`. Network: 45 requests, ALL to 127.0.0.1:8080
    (page + 8 local modules); `EXTERNAL REQUESTS: []`.
  - Screenshots visually inspected: title panel fits, play shows wave 5
    with wisps/darters/mote/bolt/particles + HUD (score, wave, hearts,
    LIGHT bar, combo), win shows the DAWN BREAKS panel + restart, end
    shows the game-over panel + restart.
- Bugs found and fixed during testing:
  1. `render.js` star radius went negative (`(s >> 13)` is signed) →
     `IndexSizeError` every frame, blank shots. Fixed with `>>>`.
  2. Play shot first landed in a between-wave lull (empty field) → the
     play scene now stops mid-fight at wave 5+ with ≥5 shadows alive.
  3. Win shot first showed the boss fight still in progress → the win
     scene now clears the small fry and fights the Herald as a duel.
- `main.ts` run twice (`MAKEFUN_OUTPUT_DIR=out` / `out2`):
  dossier.json byte-identical across runs (245,750 bytes, < 1.5 MiB cap).
- Sizes: game/ 47,534 bytes, 11 entries (cap 993 / 48 MiB); index.html
  885 bytes (cap 1 MiB); /output 439,948 bytes, 18 entries (cap 1,000 /
  64 MiB); each screenshot ≤ 256 KiB, 1280x720.
- All 8 game .js files parse as ES modules (`node --check` on .mjs copies).
- No local grade exists for this harness: RULES.txt says "There is no
  local grade of this competition: the server grades every entry", so no
  `grade-local` run was possible.

## Known limitations
- The autopilot play scene is a real simulation, but a human player's
  screenshots would show different (richer) positioning; the staged scenes
  are deterministic by design (seed 7).
- Music starts only after the first gesture (browser autoplay policy);
  the M key toggles mute.
- Balance is tuned for fun in short sessions, not exhaustively playtested
  to wave 10 by a human — the win path is proven by the autopilot duel.
