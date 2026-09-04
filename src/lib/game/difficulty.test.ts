import { describe, it, expect } from 'vitest'
import { FIXED_DT } from '@/constants/physics'
import { RAMP_END_PX, RAMP_START_PX } from '@/constants/difficulty'
import { difficultyAt, paramsAt, scrollSpeedAt } from './difficulty'

/**
 * Distance is not time: scroll speed is itself a function of difficulty, so "what
 * does the player see 20 seconds in" can only be answered by integrating. Every
 * assertion about the *ramp as experienced* has to go through this.
 */
function walk(seconds: number): { distance: number; difficulty: number } {
  let distance = 0
  const steps = Math.round(seconds / FIXED_DT)
  for (let i = 0; i < steps; i++) distance += scrollSpeedAt(distance) * FIXED_DT
  return { distance, difficulty: difficultyAt(distance) }
}

/** First moment, in seconds, at which a predicate over the params holds. */
function firstTimeWhen(pred: (p: ReturnType<typeof paramsAt>) => boolean, limit = 240): number {
  let distance = 0
  const steps = Math.round(limit / FIXED_DT)
  for (let i = 0; i < steps; i++) {
    if (pred(paramsAt(difficultyAt(distance)))) return i * FIXED_DT
    distance += scrollSpeedAt(distance) * FIXED_DT
  }
  return Number.POSITIVE_INFINITY
}

describe('difficultyAt', () => {
  it('is 0 through the opening and 1 past the end', () => {
    expect(difficultyAt(0)).toBe(0)
    expect(difficultyAt(RAMP_START_PX)).toBe(0)
    expect(difficultyAt(RAMP_END_PX)).toBe(1)
    expect(difficultyAt(RAMP_END_PX * 10)).toBe(1)
  })

  it('is monotonic', () => {
    let prev = -1
    for (let d = 0; d <= RAMP_END_PX + 2000; d += 250) {
      const cur = difficultyAt(d)
      expect(cur).toBeGreaterThanOrEqual(prev)
      prev = cur
    }
  })

  it('stays in [0,1]', () => {
    for (let d = 0; d <= RAMP_END_PX + 2000; d += 137) {
      const v = difficultyAt(d)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})

// These are the playtest's findings, written down as assertions. The opening used
// to be flat for 37 seconds — one hazard per chunk, all tier 0 — and it was judged
// a drag. Restoring an ease-IN curve, or pushing RAMP_START_PX back out, brings
// that back; these tests are what should stop it silently.
describe('the ramp as actually experienced (playtested 2026-09-04)', () => {
  it('gives the player a few seconds of nothing, but only a few', () => {
    // Long enough to learn that tapping flips gravity; short enough to be over.
    const flatFor = firstTimeWhen((p) => p.scrollSpeed > 260)
    expect(flatFor).toBeGreaterThan(3)
    expect(flatFor).toBeLessThan(8)
  })

  it('introduces a second hazard inside the first 20 seconds', () => {
    expect(firstTimeWhen((p) => p.hazardCount >= 2)).toBeLessThan(20)
  })

  it('introduces a harder pattern tier inside the first 25 seconds', () => {
    expect(firstTimeWhen((p) => p.maxTier >= 1)).toBeLessThan(25)
  })

  it('has visibly moved by 30 seconds', () => {
    // The old curve sat at 0.13 here, which is what "nothing is happening" was.
    expect(walk(30).difficulty).toBeGreaterThan(0.3)
  })

  it('still takes over a minute to max out', () => {
    // The complaint was a flat opening, not a slow ramp. Climbing early must not
    // turn into arriving early — that would trade one bad run for another.
    expect(firstTimeWhen((p) => p.minSlackTicks <= 6)).toBeGreaterThan(60)
  })
})

describe('paramsAt', () => {
  it('interpolates every field monotonically from easiest to hardest', () => {
    const a = paramsAt(0)
    const b = paramsAt(1)
    expect(a.scrollSpeed).toBeLessThan(b.scrollSpeed)
    expect(a.hazardCount).toBeLessThan(b.hazardCount)
    expect(a.pinchGap).toBeGreaterThan(b.pinchGap)
    expect(a.maxTier).toBeLessThan(b.maxTier)
    // The floor the whole fairness guarantee rests on.
    expect(b.minSlackTicks).toBe(6)
  })
})
