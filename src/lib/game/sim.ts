import { HITBOX_INSET, PLAYER_H, PLAYER_W } from '@/constants/physics'
import { PLAYER_X } from '@/constants/layout'
import { overlap, sweep, type Box } from '@/lib/engine/aabb'
import { scrollSpeedAt } from './difficulty'
import { spawnState, stepPlayer, type PlayerState } from './player'
import type { World } from './world'

/**
 * PURE with respect to the world: a run is a function of (seed, press schedule).
 * No clock, no Math.random, no globals. That is what replay.test.ts pins.
 */
export interface RunState {
  tick: number
  distance: number
  player: PlayerState
  dead: boolean
  deathTick: number | null
}

export function initRun(world: World): RunState {
  return {
    tick: 0,
    distance: 0,
    player: spawnState(world.corridor),
    dead: false,
    deathTick: null,
  }
}

/** Scroll speed ramps with distance. Pure function of distance, never of time. */
export function scrollSpeed(distancePx: number): number {
  return scrollSpeedAt(distancePx)
}

export function hitbox(player: PlayerState, distance: number): Box {
  return {
    x: distance + PLAYER_X + HITBOX_INSET,
    y: player.y + HITBOX_INSET,
    w: PLAYER_W - 2 * HITBOX_INSET,
    h: PLAYER_H - 2 * HITBOX_INSET,
  }
}

export function stepRun(s: Readonly<RunState>, flip: boolean, dt: number, world: World): RunState {
  if (s.dead) return s as RunState

  const player = stepPlayer(s.player, flip, dt, world.corridor)
  const distance = s.distance + scrollSpeed(s.distance) * dt
  const tick = s.tick + 1

  const before = hitbox(s.player, s.distance)
  const after = hitbox(player, distance)
  const swept = sweep(before, after.x - before.x, after.y - before.y)

  let dead = false
  for (const h of world.hazardsInRange(swept.x, swept.x + swept.w)) {
    if (overlap(swept, h)) {
      dead = true
      break
    }
  }

  return {
    tick,
    distance,
    player,
    dead,
    deathTick: dead ? tick : null,
  }
}

/** Score is distance in whole metres, where a metre is 10px. Reads better than raw px. */
export function score(s: RunState): number {
  return Math.floor(s.distance / 10)
}
