// Juice constants. Milliseconds, because these are render-time effects and must
// never feed back into the simulation — everything here is cosmetic by construction.

/**
 * Sim frozen, render continues — the cheapest "expensive game" signal there is.
 * Death gets a long one because the beat before the bang is what sells the bang.
 */
export const HITSTOP_DEATH_MS = 150

export const SHAKE_DEATH_PX = 16
export const SHAKE_DEATH_MS = 520
export const SHAKE_FLIP_PX = 2
export const SHAKE_FLIP_MS = 80
export const SHAKE_LAND_PX = 1.5
export const SHAKE_LAND_MS = 60

/** White frame on death, then out. */
export const FLASH_MS = 180

export const TRAIL_INTERVAL_MS = 26
export const TRAIL_LIFE_MS = 320

export const FLIP_BURST = 9
export const LAND_BURST = 6
export const DEATH_BURST = 26

// --- death explosion ---------------------------------------------------------
/** Outward speed of the pig's own scattered pixels. */
export const SHATTER_SPEED = 340
export const SHATTER_LIFE_MS = 900
export const SHATTER_GRAVITY = 1100
/** Shockwave ring: the particles say "pieces", the ring says "pressure". */
export const RING_RADIUS = 130
export const RING_MS = 420
export const SMOKE_PUFFS = 14

/** Squash on flip: the player compresses along the axis it was moving. */
export const SQUASH_MS = 140
export const SQUASH_AMOUNT = 0.35

/** Parallax scroll rates, as a fraction of world scroll. */
export const PARALLAX_FAR = 0.12
export const PARALLAX_MID = 0.26
export const PARALLAX_NEAR = 0.48
