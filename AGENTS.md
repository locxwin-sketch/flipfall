# AGENTS.md

Zero-dependency browser game. Vite + TypeScript (strict) + Canvas 2D. No framework,
no game engine, no runtime dependencies — this is deliberate and is a portal
requirement, not a preference.

Two rules that are easy to break by accident:

1. **`Math.random()` is banned under `src/lib/game/`** and enforced by eslint. That
   subtree must be reproducible from a seed alone. Use the seeded `Rng`. `src/lib/fx/`
   is render-only and exempt.
2. **All physics constants are px-per-second, never px-per-frame**, and the sim runs
   on a fixed timestep. `Gaming/contra/game.js` is the structural ancestor but stores
   per-frame velocities; do not copy its numbers.

The full plan — including the fairness guarantee, the portal fork, and the gates —
is at `~/.claude/plans/remove-that-anthropic-api-zazzy-puppy.md`. It is the source of
truth for *why*, and it is not in this repo.
