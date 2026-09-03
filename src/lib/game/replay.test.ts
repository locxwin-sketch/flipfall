import { describe, it, expect } from 'vitest'
import { FIXED_DT } from '@/constants/physics'
import { PHYSICS_VERSION, ReplayRecorder, replayRun, type Replay } from './replay'
import { initRun, stepRun, type RunState } from './sim'
import { T01_LEVEL } from './level'

// Deterministic schedule generator. Math.random() is banned in this subtree (eslint),
// and a flaky determinism test would be worse than no determinism test.
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function makeSchedule(seed: number): Replay {
  const rnd = lcg(seed)
  const pressTicks: number[] = []
  let t = Math.floor(rnd() * 30)
  // Gaps of 6-60 ticks (50-500ms) — spans real human tap rates, including the
  // sub-100ms double-flip that produces the hover.
  while (t < 4000) {
    pressTicks.push(t)
    t += 6 + Math.floor(rnd() * 54)
  }
  return { physicsVersion: PHYSICS_VERSION, pressTicks }
}

describe('replay determinism', () => {
  it('reproduces the identical death tick and distance over 50 varied runs', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const replay = makeSchedule(seed)
      const a = replayRun(replay, T01_LEVEL)
      const b = replayRun(replay, T01_LEVEL)
      expect(b).toEqual(a)
    }
  })

  it('produces genuinely different outcomes across schedules (the test has teeth)', () => {
    const outcomes = new Set<string>()
    for (let seed = 1; seed <= 50; seed++) {
      const r = replayRun(makeSchedule(seed), T01_LEVEL)
      outcomes.add(`${r.deathTick}:${Math.round(r.distance)}`)
    }
    expect(outcomes.size).toBeGreaterThan(10)
  })

  it('round-trips a recording made by the live sim', () => {
    const recorder = new ReplayRecorder()
    const schedule = makeSchedule(7)
    const pressSet = new Set(schedule.pressTicks)

    // Drive the sim exactly as main.ts does, recording each consumed press.
    let s: RunState = initRun(T01_LEVEL)
    while (!s.dead && !s.finished && s.tick < 60_000) {
      const flip = pressSet.has(s.tick)
      if (flip) recorder.record(s.tick)
      s = stepRun(s, flip, FIXED_DT, T01_LEVEL)
    }

    const replayed = replayRun(recorder.build(), T01_LEVEL)
    expect(replayed.deathTick).toBe(s.deathTick)
    expect(replayed.distance).toBeCloseTo(s.distance, 9)
    expect(replayed.finalY).toBeCloseTo(s.player.y, 9)
    expect(replayed.ticks).toBe(s.tick)
  })

  it('refuses a replay recorded under a different physics version', () => {
    const stale: Replay = { physicsVersion: PHYSICS_VERSION + 1, pressTicks: [10, 20] }
    expect(() => replayRun(stale, T01_LEVEL)).toThrow(/not comparable/)
  })

  it('a no-input run dies on the first floor spike rather than surviving', () => {
    const idle: Replay = { physicsVersion: PHYSICS_VERSION, pressTicks: [] }
    const r = replayRun(idle, T01_LEVEL)
    expect(r.deathTick).not.toBeNull()
    expect(r.finished).toBe(false)
  })
})
