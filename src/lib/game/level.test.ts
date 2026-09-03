import { describe, it, expect } from 'vitest'
import { FIXED_DT, PLAYER_H } from '@/constants/physics'
import { CEIL_Y, FLOOR_Y } from '@/constants/layout'
import { T01_LEVEL } from './level'
import { initRun, stepRun, type RunState } from './sim'

/**
 * Bounded beam search over flip decisions. This is a deliberately crude stand-in for
 * the T04 reachability solver, and it exists to answer one question the kill gate
 * depends on: is this level clearable at all? A prototype that cannot be beaten
 * measures the player's patience, not the mechanic.
 */
function beamSearchClears(decisionEvery = 8, beamWidth = 150): { cleared: boolean; best: number } {
  let beam: RunState[] = [initRun(T01_LEVEL)]
  let best = 0

  for (let round = 0; round < 600 && beam.length > 0; round++) {
    const next: RunState[] = []

    for (const start of beam) {
      // Two branches: flip on the first tick of this window, or don't.
      for (const flip of [false, true]) {
        let s = start
        for (let t = 0; t < decisionEvery; t++) {
          s = stepRun(s, flip && t === 0, FIXED_DT, T01_LEVEL)
          if (s.dead || s.finished) break
        }
        if (s.dead) continue
        if (s.distance > best) best = s.distance
        if (s.finished) return { cleared: true, best: s.distance }
        next.push(s)
      }
    }

    // Dedupe on a coarse state key, then keep the furthest-along survivors.
    const seen = new Map<string, RunState>()
    for (const s of next) {
      const key = `${Math.round(s.player.y / 6)}:${Math.round(s.player.vy / 40)}:${s.player.gravitySign}`
      const prior = seen.get(key)
      if (!prior || s.distance > prior.distance) seen.set(key, s)
    }
    beam = [...seen.values()].sort((a, b) => b.distance - a.distance).slice(0, beamWidth)
  }

  return { cleared: false, best }
}

describe('T01 level', () => {
  it('is clearable — a surviving flip schedule exists', () => {
    const { cleared, best } = beamSearchClears()
    expect(cleared, `beam search stalled at ${Math.round(best)} / ${T01_LEVEL.lengthPx}px`).toBe(
      true,
    )
  })

  it('keeps every hazard inside the corridor', () => {
    for (const h of T01_LEVEL.hazards) {
      expect(h.y).toBeGreaterThanOrEqual(CEIL_Y)
      expect(h.y + h.h).toBeLessThanOrEqual(FLOOR_Y)
      expect(h.w).toBeGreaterThan(0)
      expect(h.h).toBeGreaterThan(0)
    }
  })

  it('leaves the opening genuinely easy — no hazard in the first 800px', () => {
    const earliest = Math.min(...T01_LEVEL.hazards.map((h) => h.x))
    expect(earliest).toBeGreaterThanOrEqual(800)
  })

  it('leaves every pinch gap passable by a player box', () => {
    // Group hazards by x, then check facing pairs leave more than a player height.
    const byX = new Map<number, { top: number; bottom: number }>()
    for (const h of T01_LEVEL.hazards) {
      const cur = byX.get(h.x) ?? { top: CEIL_Y, bottom: FLOOR_Y }
      if (h.y <= CEIL_Y) cur.top = Math.max(cur.top, h.y + h.h)
      else cur.bottom = Math.min(cur.bottom, h.y)
      byX.set(h.x, cur)
    }
    for (const [x, { top, bottom }] of byX) {
      expect(bottom - top, `gap at x=${x}`).toBeGreaterThan(PLAYER_H)
    }
  })
})
