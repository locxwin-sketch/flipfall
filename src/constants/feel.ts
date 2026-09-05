// Juice constants. Milliseconds, because these are render-time effects and must
// never feed back into the simulation — everything here is cosmetic by construction.

/**
 * Sim frozen, render continues — the cheapest "expensive game" signal there is.
 * Death gets a long one because the beat before the bang is what sells the bang.
 */
/**
 * How long the button must be held on the title screen to start Gauntlet instead of
 * Endless. 400ms is long enough that a normal impatient tap never trips it, short
 * enough that holding does not feel like it has failed. The title draws a filling
 * bar over this window — a hidden gesture nobody discovers is the same as no
 * second mode at all.
 */
export const HOLD_SELECT_MS = 400

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

// --- splat and wash ----------------------------------------------------------
// The splat is screen-space: thrown at the lens, not into the world. Playtest asked
// for the death to be more in-your-face; the timing above was already judged right,
// so none of the *durations* of the blast have ever moved. Colours live in
// constants/death.ts, which is what makes the style swappable.
/** Blobs thrown at the camera. Thinned automatically under reduced motion. */
export const SPLAT_COUNT = 30
/** How far across the frame the spray reaches, px. Wider than the view on purpose. */
export const SPLAT_SPREAD = 430
/** Long: this is the effect the player stares at on the AGAIN screen. */
export const SPLAT_LIFE_MS = 2600
export const SPLAT_MAX_R = 34
/** Full-screen colour film over the death. This is the "in your face" half: the
 *  splat is on the lens, the wash is the frame itself taking it. Outlives the 180ms
 *  white flash on purpose — the flash is the impact, the wash is the aftermath.
 *  The colour comes from the active death style, not from here. */
export const DEATH_WASH_MS = 900

/** Heavy chunks flung with the pig's own pixels — the wet half of the shrapnel. */
export const GORE_BURST = 34
export const GORE_SPEED = 430
export const GORE_LIFE_MS = 1000

/** Squash on flip: the player compresses along the axis it was moving. */
export const SQUASH_MS = 140
export const SQUASH_AMOUNT = 0.35

/** Parallax scroll rates, as a fraction of world scroll. */
export const PARALLAX_FAR = 0.12
export const PARALLAX_MID = 0.26
export const PARALLAX_NEAR = 0.48
