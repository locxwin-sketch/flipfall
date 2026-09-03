import { FIXED_DT } from '@/constants/physics'
import { initRun, stepRun, type RunState } from './sim'
import { World } from './world'

/**
 * Bump when any constant or rule in player.ts / sim.ts / generator.ts changes. A
 * replay recorded under a different version is not comparable, and silently
 * replaying it produces a wrong ghost or a wrong leaderboard entry.
 */
export const PHYSICS_VERSION = 2

export interface Replay {
  physicsVersion: number
  /** The world seed. The entire level is regenerated from this — none is stored. */
  seed: number
  /** Sim ticks on which a flip was consumed. Strictly ascending. */
  pressTicks: number[]
}

export interface ReplayResult {
  deathTick: number | null
  distance: number
  finalY: number
  ticks: number
}

export class ReplayRecorder {
  private readonly ticks: number[] = []
  private seed = 0

  start(seed: number): void {
    this.seed = seed >>> 0
    this.ticks.length = 0
  }

  record(tick: number): void {
    this.ticks.push(tick)
  }

  build(): Replay {
    return { physicsVersion: PHYSICS_VERSION, seed: this.seed, pressTicks: [...this.ticks] }
  }
}

/**
 * Re-runs a press schedule through the same pure sim the game uses, against a
 * world regenerated from the seed. Same input, same output, always — this is the
 * determinism regression test, and it transitively guards player.ts, sim.ts,
 * generator.ts and every physics constant.
 */
export function replayRun(replay: Replay, maxTicks = 120_000): ReplayResult {
  if (replay.physicsVersion !== PHYSICS_VERSION) {
    throw new Error(
      `Replay physicsVersion ${replay.physicsVersion} != current ${PHYSICS_VERSION}; not comparable.`,
    )
  }

  const world = new World(replay.seed)
  let s: RunState = initRun(world)
  let next = 0

  while (!s.dead && s.tick < maxTicks) {
    const flip = next < replay.pressTicks.length && replay.pressTicks[next] === s.tick
    if (flip) next++
    world.advance(s.distance)
    s = stepRun(s, flip, FIXED_DT, world)
  }

  return {
    deathTick: s.deathTick,
    distance: s.distance,
    finalY: s.player.y,
    ticks: s.tick,
  }
}
