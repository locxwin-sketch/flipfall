@AGENTS.md

# CLAUDE.md

## What this is

Flipfall — a one-button precision game. Tap flips gravity; the player falls toward
the new surface under real acceleration rather than snapping. Endless, seeded,
deliberately brutal after an easy opening. Aimed at a game portal (Poki *or*
CrazyGames — never both), not at collecting payments.

## Commands

```bash
npm run dev      # http://localhost:5173 — the only way to play it
npm run build    # tsc --noEmit && vite build
npm test         # vitest run
npm run lint     # eslint .
```

Dev-only URL params: `?seed=<n>` pins the world, `?skip=<px>` starts partway in.

## Environment

Node 26 (`.nvmrc`). npm, committed lockfile. No secrets, no backend, zero runtime
dependencies. Hosting is local only; see `docs/JOURNAL.md`.

## Architecture

- `src/constants/` — physics, difficulty, feel, palette, layout. All px-per-second.
- `src/lib/engine/` — fixed-timestep loop, input, seeded RNG, AABB, audio.
- `src/lib/game/` — pure simulation. **`Math.random()` banned** (eslint-enforced);
  reproducible from a seed alone.
- `src/lib/fx/` — particles, shockwave, screenshake, hitstop. Render-only, so
  `Math.random()` is fine and cannot affect determinism.
- `src/lib/render/` — canvas drawing and sprites. Replaces `src/components/`;
  no React here, so React-shaped directories would be cargo-cult.
- `src/lib/portal/` — SDK adapter seam. Empty; only one adapter is ever written.

Deliberate duplication, so nobody "fixes" it: the palette lives in both
`src/style.css` (page chrome) and `src/constants/palette.ts` (canvas), because
`getComputedStyle` per frame costs real time.

## Load-bearing details

`TICK_HZ = 120` is not taste — at 60Hz the per-tick diagonal exceeds
`MIN_HAZARD_THICKNESS` and the player tunnels through hazards. `physics.test.ts`
asserts both directions.

`base: './'` in `vite.config.ts` — Pages and portals serve from a sub-path; an
absolute-path build renders blank.

**Clearable is NOT the fairness assertion.** `generator.test.ts` searches for a
*forgiving* line and requires the tightest flip to tolerate 6 ticks (50ms). A
machine will find lines no human can fly; this game shipped a 17ms level once.

**Drawn shape equals collision box** — spike teeth are highlights inside the rect.

## Current state

Endless mode playable, 30 tests green. Blocked on a human playtest of the
difficulty ramp, not on code. See `docs/STATE.md`, then `docs/JOURNAL.md`.
