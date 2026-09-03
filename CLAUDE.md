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

T01 code complete and playable: fixed-timestep loop, one-button input, pure
`stepPlayer`, a hand-authored 30s level, instant restart, replay determinism.
20 tests green.

**Blocked on a human verdict, not on code.** T01 is the kill gate: three people play
it and answer "after dying, do I want to tap again?" If no, the project stops — the
gate's no-branch is *stop*, not *switch mechanic*. See `docs/STATE.md`.
