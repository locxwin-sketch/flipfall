// All units are px and seconds. Never px-per-frame.
//
// Gaming/contra/game.js — this project's direct ancestor — stores velocities
// per-frame (`e.x += e.vx`), so it runs ~2.4x fast on a 144Hz display. None of its
// numbers port over; only its structure does.

/** Simulation rate. LOAD-BEARING, not taste — see the anti-tunnel invariant below. */
export const TICK_HZ = 120
export const FIXED_DT = 1 / TICK_HZ

/** Never simulate more than this much catch-up after a stall. */
export const MAX_FRAME_DELTA_MS = 100

/** Derived, not a second magic number: 100ms at 120Hz *is* 12 ticks. */
export const MAX_TICKS_PER_FRAME = Math.ceil((MAX_FRAME_DELTA_MS / 1000) * TICK_HZ)

// --- player -----------------------------------------------------------------

export const GRAVITY = 2400
export const TERMINAL_V = 900

/**
 * A flip kills 85% of vertical speed rather than zeroing it. This single number
 * creates the skill ceiling: two flips in quick succession nearly stop you, which
 * is the emergent "hover" the difficulty cliff requires.
 *
 * Do NOT raise this. Post-flip overshoot is (k*v)^2 / (2g): 3.8px at 0.15, but
 * 42px at 0.5 — 2.6 hitbox heights of sink after the only input the game has.
 */
export const FLIP_DAMP = 0.15

export const PLAYER_W = 22
export const PLAYER_H = 22

/** Forgiving hitbox: 22 - 2*3 = 16px collision box inside a 22px sprite. */
export const HITBOX_INSET = 3

// --- world ------------------------------------------------------------------

export const SCROLL_START = 260
export const SCROLL_MAX = 520

/**
 * Anti-tunnel invariant, asserted in collide.test.ts:
 *   hypot(SCROLL_MAX/TICK_HZ, TERMINAL_V/TICK_HZ) < (PLAYER_W - 2*HITBOX_INSET) + MIN_HAZARD_THICKNESS
 * At 120Hz the per-tick diagonal is 5.0px. At 60Hz it would be 17.3px, which exceeds
 * this — which is why TICK_HZ cannot be "optimised" down to 60.
 */
export const MIN_HAZARD_THICKNESS = 16

export const VIEW_W = 960
export const VIEW_H = 540
