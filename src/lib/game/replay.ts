import { FIXED_DT } from '@/constants/physics'
import { initRun, stepRun, type RunState } from './sim'
import type { Level } from './level'

/**
 * Bump when any constant or rule in player.ts / sim.ts changes. A replay recorded
 * under a different version is not comparable, and silently replaying it would
 * produce a wrong ghost or a wrong leaderboard entry.
 */
export const PHYSICS_VERSION = 1

export interface Replay {
  physicsVersion: number
  /** Sim ticks on which a flip was consumed. Strictly ascending. */
  pressTicks: number[]
}

export interface ReplayResult {
  deathTick: number | null
  distance: number
  finalY: number
  ticks: number
  finished: boolean
}

/** Records presses as they are consumed by the live sim. */
export class ReplayRecorder {
  private readonly ticks: number[] = []

  record(tick: number): void {
    this.ticks.push(tick)
  }

  reset(): void {
    this.ticks.length = 0
  }

  build(): Replay {
    return { physicsVersion: PHYSICS_VERSION, pressTicks: [...this.ticks] }
  }
}

/**
 * Re-runs a press schedule through the same pure sim the game uses. Same input,
 * same output, always — this is the determinism regression test, and it
 * transitively guards player.ts, sim.ts, and every physics constant.
 */
export function replayRun(replay: Replay, level: Level, maxTicks = 60_000): ReplayResult {
  if (replay.physicsVersion !== PHYSICS_VERSION) {
    throw new Error(
      `Replay physicsVersion ${replay.physicsVersion} != current ${PHYSICS_VERSION}; not comparable.`,
    )
  }

  let s: RunState = initRun(level)
  let next = 0

  while (!s.dead && !s.finished && s.tick < maxTicks) {
    const flip = next < replay.pressTicks.length && replay.pressTicks[next] === s.tick
    if (flip) next++
    s = stepRun(s, flip, FIXED_DT, level)
  }

  return {
    deathTick: s.deathTick,
    distance: s.distance,
    finalY: s.player.y,
    ticks: s.tick,
    finished: s.finished,
  }
}
