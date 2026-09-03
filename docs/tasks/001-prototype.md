# Task 001-prototype: Playable prototype — KILL GATE

## Goal

A player can tap (space / click / phone tap) to flip gravity and run a hand-authored
30-second level, dying on hazards and restarting instantly. This is the smallest
thing that answers "after dying, do I want to tap again?"

## Files to touch

- `src/lib/engine/loop.ts` — fixed-timestep accumulator, `pause()`/`resume()`
- `src/lib/engine/input.ts` — press queue with the three guards
- `src/lib/game/player.ts` — pure `stepPlayer()`, shared later by the solver
- `src/lib/game/level.ts` — hand-authored level, built from the primitives T05 reuses
- `src/lib/game/replay.ts` — `{ physicsVersion, pressTicks }` record/replay
- `src/lib/render/renderer.ts`, `src/lib/engine/audio.ts`, `src/main.ts` — wiring

## Context the builder needs

Physics constants already exist in `src/constants/physics.ts`. `stepPlayer` must stay
pure and free of `Math.random()` — the T04 solver will call this exact function, and
that shared call is what makes the fairness guarantee real.

## Acceptance criteria

1. Sim advances ~120 ticks/sec on both a 60Hz and a 144Hz display (tick counter shown
   on screen), proving the contra per-frame defect is gone.
2. Two presses inside one animation frame both register: `pressQueueDepth()` is
   observed > 1 and both are consumed on subsequent ticks.
3. Holding spacebar produces exactly ONE flip, not ~30/sec — OS auto-repeat suppressed.
4. A double-flip within 100ms visibly holds altitude (the hover exists).
5. Identical behaviour via spacebar, mouse click, and touch.
6. Death restarts with zero input lockout; a press during the death animation is
   buffered and applied on respawn.
7. `replay.test.ts`: replaying a recorded press schedule reproduces the identical death
   tick and distance, over 50 varied runs.

## Out of scope

Procedural generation, the solver, art, particles, screenshake, portals, ads, score
persistence. Sound is `sfx.flip` and `sfx.die` only.
