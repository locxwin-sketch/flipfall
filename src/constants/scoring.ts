// Scoring, and the one number that turns flying carefully into flying close.
//
// Endless scores distance and nothing else, deliberately: its bests predate all of
// this and must stay comparable. Gauntlet adds coins and grazes on top, which is
// affordable precisely because bests are stored per mode.

/**
 * How near a hazard the hitbox must pass to count as a graze, in px.
 *
 * 12 is a little under the 16px hitbox, which is the point: a graze is not "you
 * were roughly nearby", it is "another hitbox-width to the side and you were dead".
 * Wider and it fires constantly in a pinch and stops meaning anything; narrower and
 * it is indistinguishable from the death it is rewarding you for avoiding.
 */
export const GRAZE_BAND = 12

/**
 * A graze is worth more than a coin because it cannot be farmed. Coins sit on the
 * line whether or not you were in danger; a graze is only ever paid out for having
 * been one hitbox from dying, which is the behaviour this whole game is about.
 */
export const GRAZE_POINTS = 25
export const COIN_POINTS = 10

/**
 * Flow: a streak of consecutive near-misses since the last landing, multiplying
 * every coin and graze earned while it's live. Landing is the reset — not a timer
 * — because it's a signal the sim already computes every tick, and because a
 * fixed window doesn't couple to how far apart the generator happens to place
 * things at a given difficulty. The trade a player is actually offered: there's
 * a landable stretch coming up, take the safe reset or hover through it to carry
 * the multiplier into whatever's next.
 *
 * The multiplier only ever applies going forward. A graze always banks its own
 * GRAZE_POINTS the instant it happens — dying the next tick ends future earning,
 * it never undoes what already scored. See docs/JOURNAL.md for why: the earlier
 * design paid a graze out only on a LATER coin, and died in review because it
 * retroactively erased an already-earned skill moment.
 */
export const FLOW_MULT_STEP = 0.5
export const FLOW_MULT_CAP = 4
