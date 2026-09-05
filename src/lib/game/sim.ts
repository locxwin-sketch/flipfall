import { HITBOX_INSET, PLAYER_H, PLAYER_W } from '@/constants/physics'
import { PLAYER_X } from '@/constants/layout'
import { CHUNK_W } from '@/constants/difficulty'
import { COIN_POINTS, GRAZE_BAND, GRAZE_POINTS } from '@/constants/scoring'
import type { Curve } from '@/constants/modes'
import { overlap, sweep, type Box } from '@/lib/engine/aabb'
import { scrollSpeedAt } from './difficulty'
import { COIN_STRIDE } from './level'
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
  /** Coins collected this run. */
  coins: number
  /** Completed near-misses this run. */
  grazes: number
  /**
   * Whether the hitbox is inside the graze band RIGHT NOW. Edge-triggered rather
   * than counted per tick: one close pass is one graze, however many ticks it
   * takes to fly through, and no hazard ids are needed to say so.
   */
  grazing: boolean
  /**
   * Ids of coins already taken, pruned to a window around the player. A coin
   * overlaps the hitbox for several ticks at scroll speed, so without this it
   * would be collected once per tick of contact. Pruned because the player only
   * ever moves forward: an id far behind can never be touched again, and an
   * unbounded array in a value copied every tick is a leak with extra steps.
   */
  takenCoins: readonly number[]
}

export function initRun(world: World): RunState {
  return {
    tick: 0,
    distance: 0,
    player: spawnState(world.corridor),
    dead: false,
    deathTick: null,
    coins: 0,
    grazes: 0,
    grazing: false,
    takenCoins: [],
  }
}

/** Scroll speed ramps with distance. Pure function of distance, never of time. */
export function scrollSpeed(distancePx: number, curve: Curve): number {
  return scrollSpeedAt(distancePx, curve)
}

/**
 * Vertical gap from the box to the nearest hazard sharing its x-range, or Infinity
 * in open air. Negative would mean overlapping, which the caller has already ruled
 * out by killing the run.
 */
function nearestClearance(box: Box, world: World): number {
  let min = Infinity
  for (const h of world.hazardsInRange(box.x, box.x + box.w)) {
    if (h.x > box.x + box.w || h.x + h.w < box.x) continue
    const gap = h.y > box.y ? h.y - (box.y + box.h) : box.y - (h.y + h.h)
    if (gap < min) min = gap
  }
  return min
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
  const distance = s.distance + scrollSpeed(s.distance, world.curve) * dt
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

  // Coins are checked against the same swept box as the hazards, so a coin can
  // never be missed by moving fast enough to pass through it — the bug the swept
  // test exists to prevent for hazards would be just as wrong here, only quieter.
  let coins = s.coins
  let takenCoins = s.takenCoins
  if (!dead) {
    for (const c of world.coinsInRange(swept.x, swept.x + swept.w)) {
      if (takenCoins.includes(c.id)) continue
      if (!overlap(swept, c)) continue
      coins++
      takenCoins = [...takenCoins, c.id]
    }
    if (takenCoins !== s.takenCoins) {
      const cutoff = (Math.floor(distance / CHUNK_W) - 2) * COIN_STRIDE
      takenCoins = takenCoins.filter((id) => id >= cutoff)
    }
  }

  // Grazing. Edge-triggered on entering the band, so flying the length of a pinch
  // scores one near-miss rather than forty.
  const grazing = !dead && nearestClearance(after, world) <= GRAZE_BAND
  const grazes = s.grazes + (grazing && !s.grazing ? 1 : 0)

  return {
    tick,
    distance,
    player,
    dead,
    deathTick: dead ? tick : null,
    coins,
    grazes,
    grazing,
    takenCoins,
  }
}

/** Score is distance in whole metres, where a metre is 10px. Reads better than raw px. */
export function score(s: RunState): number {
  return Math.floor(s.distance / 10)
}

/**
 * Coins and grazes, in the same units as `score`. Kept separate from it because
 * Endless must keep scoring distance and only distance — its bests were set before
 * any of this existed, and quietly inflating them would make the number on the
 * title screen a lie. Only Gauntlet adds this in; see `main.ts`.
 */
export function bonusScore(s: RunState): number {
  return s.coins * COIN_POINTS + s.grazes * GRAZE_POINTS
}
