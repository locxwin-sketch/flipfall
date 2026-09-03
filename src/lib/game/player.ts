import { GRAVITY, TERMINAL_V, FLIP_DAMP, PLAYER_H } from '@/constants/physics'

/**
 * PURE. No I/O, no globals, no Math.random, no Date.
 *
 * The T04 reachability solver calls this exact function rather than modelling the
 * physics separately. That shared call is the whole fairness guarantee: a solver with
 * its own copy of the physics drifts from the game within two tuning sessions and
 * starts certifying impossible levels.
 */
export interface PlayerState {
  /** Top edge of the player box, world coords, y grows downward. */
  y: number
  /** px/s. Positive is downward. */
  vy: number
  /** +1 = gravity pulls down, -1 = pulls up. */
  gravitySign: 1 | -1
  /** Resting on the surface gravity pulls toward. */
  grounded: boolean
}

export interface Corridor {
  /** y of the walkable top surface of the floor. */
  floorY: number
  /** y of the walkable bottom surface of the ceiling. */
  ceilY: number
}

export function spawnState(corridor: Corridor): PlayerState {
  return {
    y: corridor.floorY - PLAYER_H,
    vy: 0,
    gravitySign: 1,
    grounded: true,
  }
}

export function stepPlayer(
  s: Readonly<PlayerState>,
  flip: boolean,
  dt: number,
  corridor: Corridor,
): PlayerState {
  let { y, vy, gravitySign } = s

  if (flip) {
    gravitySign = gravitySign === 1 ? -1 : 1
    // Kill 85% of vertical speed, do NOT zero it. This one line is the skill
    // ceiling: flipping late keeps more residual momentum and overshoots further
    // — overshoot is (FLIP_DAMP*v)^2 / (2*GRAVITY) — so panic-flipping costs you.
    vy *= FLIP_DAMP
  }

  vy += GRAVITY * gravitySign * dt
  if (vy > TERMINAL_V) vy = TERMINAL_V
  else if (vy < -TERMINAL_V) vy = -TERMINAL_V

  y += vy * dt

  let grounded = false
  const floorTop = corridor.floorY - PLAYER_H
  if (y >= floorTop) {
    y = floorTop
    vy = 0
    grounded = gravitySign === 1
  } else if (y <= corridor.ceilY) {
    y = corridor.ceilY
    vy = 0
    grounded = gravitySign === -1
  }

  return { y, vy, gravitySign, grounded }
}
