import { HITBOX_INSET, PLAYER_H, PLAYER_W, SCROLL_START } from '@/constants/physics'
import { PLAYER_X } from '@/constants/layout'
import { overlap, sweep, type Box } from '@/lib/engine/aabb'
import { spawnState, stepPlayer, type PlayerState } from './player'
import type { Level } from './level'

/**
 * PURE. The whole run is a function of (level, press schedule) — no clock, no RNG,
 * no globals. That is what makes replay.test.ts able to pin determinism.
 */
export interface RunState {
  tick: number
  distance: number
  player: PlayerState
  dead: boolean
  deathTick: number | null
  finished: boolean
}

export function initRun(level: Level): RunState {
  return {
    tick: 0,
    distance: 0,
    player: spawnState(level.corridor),
    dead: false,
    deathTick: null,
    finished: false,
  }
}

/** T01 scrolls at a constant rate. The ramp arrives with the difficulty table (T03b). */
export function scrollSpeed(): number {
  return SCROLL_START
}

export function hitbox(player: PlayerState, distance: number): Box {
  return {
    x: distance + PLAYER_X + HITBOX_INSET,
    y: player.y + HITBOX_INSET,
    w: PLAYER_W - 2 * HITBOX_INSET,
    h: PLAYER_H - 2 * HITBOX_INSET,
  }
}

export function stepRun(s: Readonly<RunState>, flip: boolean, dt: number, level: Level): RunState {
  if (s.dead || s.finished) return s as RunState

  const player = stepPlayer(s.player, flip, dt, level.corridor)
  const distance = s.distance + scrollSpeed() * dt
  const tick = s.tick + 1

  // Swept box: at 120Hz the per-tick diagonal is ~5px against a 16px minimum hazard,
  // so a point test would already be safe — but the sweep keeps it safe if anyone
  // later raises TERMINAL_V or lowers TICK_HZ before physics.test.ts stops them.
  const before = hitbox(s.player, s.distance)
  const after = hitbox(player, distance)
  const swept = sweep(before, after.x - before.x, after.y - before.y)

  let dead = false
  for (const h of level.hazards) {
    // Cheap x-reject first; the hazard list is sorted by x in practice.
    if (h.x + h.w < swept.x) continue
    if (h.x > swept.x + swept.w) continue
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
    finished: !dead && distance >= level.lengthPx,
  }
}

/** Seconds survived, for the HUD. Derived from ticks so it stays deterministic. */
export function elapsedSeconds(s: RunState, dt: number): number {
  return s.tick * dt
}
