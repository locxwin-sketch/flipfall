// The two game modes, as data rather than branches scattered through the sim.
//
// Endless is the game as shipped: an easy opening that climbs for ~67s and then
// saturates. That saturation is the reason Gauntlet exists — past RAMP_END_PX
// `difficultyAt` returns 1 forever, so the world becomes statistically frozen and a
// long run stops producing anything new to look at. Gauntlet's curve therefore
// OPENS on Endless's terminal state and ramps on from there.
//
// Everything difficulty-shaped takes a Curve, so neither mode is the special case
// and adding a third costs one object.

import {
  EASIEST,
  GAUNTLET_END_PX,
  GAUNTLET_HARDEST,
  GAUNTLET_START_PX,
  HARDEST,
  RAMP_END_PX,
  RAMP_START_PX,
  type DifficultyParams,
} from './difficulty'

export type Mode = 'endless' | 'gauntlet'

export const MODES = ['endless', 'gauntlet'] as const satisfies readonly Mode[]

export function isMode(v: unknown): v is Mode {
  return v === 'endless' || v === 'gauntlet'
}

export interface Curve {
  /** Below this distance the mode sits at `easiest`. */
  startPx: number
  /** At and above this distance the mode sits at `hardest`. */
  endPx: number
  easiest: DifficultyParams
  hardest: DifficultyParams
}

export const ENDLESS_CURVE: Curve = {
  startPx: RAMP_START_PX,
  endPx: RAMP_END_PX,
  easiest: EASIEST,
  hardest: HARDEST,
}

/**
 * `easiest: HARDEST` is the design, not a shortcut. Gauntlet's floor is Endless's
 * ceiling, so the two curves are continuous: whatever Endless tops out at is
 * exactly what Gauntlet asks for on its first screen. `modes.test.ts` pins that
 * join, because the moment someone retunes HARDEST and not this, the second mode
 * silently stops being a continuation and becomes an unrelated difficulty.
 */
export const GAUNTLET_CURVE: Curve = {
  startPx: GAUNTLET_START_PX,
  endPx: GAUNTLET_END_PX,
  easiest: HARDEST,
  hardest: GAUNTLET_HARDEST,
}

export function curveFor(mode: Mode): Curve {
  return mode === 'gauntlet' ? GAUNTLET_CURVE : ENDLESS_CURVE
}

/**
 * Per-mode seed salt, so `?seed=777` is a different world in each mode rather than
 * the same layout at a different speed. Endless is salt 0 — its seed→world mapping
 * is unchanged by the arrival of a second mode, which keeps every existing replay
 * and screenshot meaningful.
 */
export function seedSalt(mode: Mode): number {
  return mode === 'gauntlet' ? 0x6a11 : 0
}
