@AGENTS.md

# CLAUDE.md

## What this is

Flipfall — a one-button precision browser game. Tap flips gravity; the player falls
toward the new surface under real acceleration. Deliberately brutal after an easy
opening. Monetised through a game portal (Poki *or* CrazyGames — never both, see
Portals below), not by collecting payments.

## Commands

```bash
npm run dev      # vite dev server
npm run build    # tsc --noEmit && vite build
npm test         # vitest run
npm run lint     # eslint .
```

## Environment

Node 26 (`.nvmrc`). npm with a committed lockfile. No secrets, no `.env`, no backend —
the game is fully static and makes zero external network requests at runtime.

## Architecture

- `src/constants/` — physics, palette, difficulty. All px-per-second.
- `src/lib/engine/` — fixed-timestep loop, input, seeded RNG, AABB, audio, storage.
- `src/lib/game/` — pure simulation. **`Math.random()` banned here** (eslint-enforced);
  must be reproducible from a seed alone.
- `src/lib/fx/` — particles, screenshake, hitstop. Render-only, `Math.random()` fine.
- `src/lib/render/` — canvas drawing. Replaces the usual `src/components/`; there is
  no React here, so React-shaped directories would be cargo-cult.
- `src/lib/portal/` — the SDK adapter seam. Only one portal adapter is ever written.

Two deliberate duplications, so nobody "fixes" them: the palette exists in both
`src/style.css` (page chrome) and `src/constants/palette.ts` (canvas), because
`getComputedStyle` per frame costs real time; and the dark theme is defined twice in
CSS so an explicit toggle wins in both directions.

`TICK_HZ = 120` is load-bearing, not taste — at 60Hz the per-tick diagonal exceeds
`MIN_HAZARD_THICKNESS` and the player tunnels through hazards. `physics.test.ts`
asserts this.

`base: './'` in `vite.config.ts` is load-bearing — Pages and portals both serve from
a sub-path, and an absolute-path build renders blank.

## Current state

**Endless mode.** A seeded generator assembles chunks from a 12-pattern vocabulary
across 4 difficulty tiers; the world is regenerated from a single seed, so a replay
stores `{seed, pressTicks}` and nothing else. Score is distance in metres.

The difficulty ramp is data in `src/constants/difficulty.ts`, easy until ~2600px
(~10s) then easing up to 26000px.

`generator.test.ts` runs a bounded beam search over generated windows at three
difficulty points and asserts a *forgiving* line exists — tightest flip must tolerate
6 ticks (50ms). Clearability alone is NOT the assertion: a machine will happily find a
line no human can fly, and this game already shipped a 17ms level once.

T01's hand-authored level is deleted. It was a fixture; its primitives are the
generator's vocabulary.

Hosting: local only (`npm run dev`). Repo is private, so Pages is unavailable on a
free plan; `.github/workflows/deploy.yml` is correct and disabled, not deleted.

Next: playtest the ramp. See `docs/STATE.md`.
