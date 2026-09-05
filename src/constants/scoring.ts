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
