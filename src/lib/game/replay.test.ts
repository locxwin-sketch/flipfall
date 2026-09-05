import { describe, it, expect } from 'vitest'
import { FIXED_DT } from '@/constants/physics'
import { PHYSICS_VERSION, ReplayRecorder, replayRun, type Replay } from './replay'
import { initRun, stepRun, type RunState } from './sim'
import { World } from './world'

// Deterministic schedule generator. Math.random() is banned in this subtree (eslint),
// and a flaky determinism test would be worse than no determinism test.
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function makeSchedule(seed: number, worldSeed = seed * 31 + 7): Replay {
  const rnd = lcg(seed)
  const pressTicks: number[] = []
  let t = Math.floor(rnd() * 30)
  // Gaps of 6-60 ticks (50-500ms) — spans real human tap rates, including the
  // sub-100ms double-flip that produces the hover.
  while (t < 4000) {
    pressTicks.push(t)
    t += 6 + Math.floor(rnd() * 54)
  }
  return { physicsVersion: PHYSICS_VERSION, seed: worldSeed, mode: 'endless', pressTicks }
}

describe('replay determinism', () => {
  it('reproduces the identical death tick and distance over 50 varied runs', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const replay = makeSchedule(seed)
      const a = replayRun(replay)
      const b = replayRun(replay)
      expect(b).toEqual(a)
    }
  })

  it('produces genuinely different outcomes across schedules (the test has teeth)', () => {
    const outcomes = new Set<string>()
    for (let seed = 1; seed <= 50; seed++) {
      const r = replayRun(makeSchedule(seed))
      outcomes.add(`${r.deathTick}:${Math.round(r.distance)}`)
    }
    expect(outcomes.size).toBeGreaterThan(10)
  })

  it('round-trips a recording made by the live sim', () => {
    const recorder = new ReplayRecorder()
    const worldSeed = 4242
    recorder.start(worldSeed)
    const pressSet = new Set(makeSchedule(7, worldSeed).pressTicks)

    // Drive the sim exactly as main.ts does, recording each consumed press.
    const world = new World(worldSeed)
    let s: RunState = initRun(world)
    while (!s.dead && s.tick < 60_000) {
      const flip = pressSet.has(s.tick)
      if (flip) recorder.record(s.tick)
      world.advance(s.distance)
      s = stepRun(s, flip, FIXED_DT, world)
    }

    const replayed = replayRun(recorder.build())
    expect(replayed.deathTick).toBe(s.deathTick)
    expect(replayed.distance).toBeCloseTo(s.distance, 9)
    expect(replayed.finalY).toBeCloseTo(s.player.y, 9)
    expect(replayed.ticks).toBe(s.tick)
  })

  it('refuses a replay recorded under a different physics version', () => {
    const stale: Replay = {
      physicsVersion: PHYSICS_VERSION + 1,
      seed: 1,
      mode: 'endless',
      pressTicks: [10, 20],
    }
    expect(() => replayRun(stale)).toThrow(/not comparable/)
  })

  it('a no-input run eventually dies rather than surviving forever', () => {
    const idle: Replay = { physicsVersion: PHYSICS_VERSION, seed: 1234, mode: 'endless', pressTicks: [] }
    const r = replayRun(idle)
    expect(r.deathTick).not.toBeNull()
  })

  it('the same press schedule on a DIFFERENT seed gives a different run', () => {
    const a = replayRun(makeSchedule(3, 111))
    const b = replayRun(makeSchedule(3, 222))
    expect(a.deathTick === b.deathTick && a.distance === b.distance).toBe(false)
  })
})
