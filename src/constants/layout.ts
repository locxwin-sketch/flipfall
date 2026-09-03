import { VIEW_H } from './physics'

/** Player x is fixed on screen; the world scrolls past it. */
export const PLAYER_X = 160

/** Corridor for the T01 hand-authored level: 380px, the plan's d=0 value. */
export const FLOOR_Y = 500
export const CEIL_Y = 120

export const FLOOR_H = VIEW_H - FLOOR_Y
export const CEIL_TOP = 80

/** Hazards are never thinner than MIN_HAZARD_THICKNESS — see the anti-tunnel test. */
export const SPIKE_W = 22
export const SPIKE_H = 30
