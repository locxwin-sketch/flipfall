import { describe, it, expect } from 'vitest'
import { FIXED_DT, PLAYER_H, TICK_HZ } from '@/constants/physics'
import { CEIL_Y, FLOOR_Y } from '@/constants/layout'
import { T01_LEVEL } from './level'
import { initRun, stepRun, type RunState } from './sim'

/**
 * Minimum timing tolerance, in ticks, on the tightest flip a clearing solution
 * requires. 6 ticks at 120Hz = 50ms.
 *
 * This is the line between "hard" and "unfair", and it is not a matter of taste:
 * trained human timing precision is ~30-50ms, and one frame on a 60Hz display is
 * 16.7ms. A level whose tightest flip is below this floor cannot be played, only
 * memorised and re-rolled.
 *
 * The first version of this level scored 2 ticks (17ms). It passed a clearability
 * check and was still effectively impossible — which is exactly why clearability
 * alone is not the assertion.
 */
const MIN_SLACK_TICKS = 6

interface Node {
  run: RunState
  presses: number[]
}

/**
 * Bounded beam search returning the press schedule, not just a verdict. A crude
 * stand-in for the T04 reachability solver — but crucially it integrates through
 * the game's own stepRun, so it cannot certify something the game would kill.
 */
function findClearingSchedule(decisionEvery = 4, beamWidth = 700): number[] | null {
  let beam: Node[] = [{ run: initRun(T01_LEVEL), presses: [] }]

  for (let round = 0; round < 2000 && beam.length; round++) {
    const next: Node[] = []
    for (const node of beam) {
      for (const flip of [false, true]) {
        let s = node.run
        const pressTick = s.tick
        for (let t = 0; t < decisionEvery; t++) {
          s = stepRun(s, flip && t === 0, FIXED_DT, T01_LEVEL)
          if (s.dead || s.finished) break
        }
        if (s.dead) continue
        const presses = flip ? [...node.presses, pressTick] : node.presses
        if (s.finished) return presses
        next.push({ run: s, presses })
      }
    }
    const seen = new Map<string, Node>()
    for (const n of next) {
      const k = `${Math.round(n.run.player.y / 4)}:${Math.round(n.run.player.vy / 25)}:${n.run.player.gravitySign}`
      const prior = seen.get(k)
      if (!prior || n.run.distance > prior.run.distance) seen.set(k, n)
    }
    beam = [...seen.values()].sort((a, b) => b.run.distance - a.run.distance).slice(0, beamWidth)
  }
  return null
}

function clears(presses: readonly number[]): boolean {
  const set = new Set(presses)
  let s = initRun(T01_LEVEL)
  while (!s.dead && !s.finished && s.tick < 60_000) {
    s = stepRun(s, set.has(s.tick), FIXED_DT, T01_LEVEL)
  }
  return s.finished
}

/** perturbAndReplay: how far each flip can shift and still clear. */
function minSlackTicks(presses: readonly number[]): number {
  let worst = Infinity
  for (let i = 0; i < presses.length; i++) {
    let early = 0
    let late = 0
    for (let d = 1; d <= 24; d++) {
      const shifted = [...presses]
      shifted[i] = presses[i] - d
      if (shifted[i] >= 0 && clears(shifted)) early = d
      else break
    }
    for (let d = 1; d <= 24; d++) {
      const shifted = [...presses]
      shifted[i] = presses[i] + d
      if (clears(shifted)) late = d
      else break
    }
    worst = Math.min(worst, early + late + 1)
  }
  return worst
}

describe('T01 level', () => {
  it('is clearable AND humanly timeable', () => {
    const presses = findClearingSchedule()
    expect(presses, 'no clearing schedule exists — the level is impossible').not.toBeNull()

    const slack = minSlackTicks(presses!)
    const ms = Math.round((slack / TICK_HZ) * 1000)
    expect(
      slack,
      `tightest flip allows only ${slack} ticks (${ms}ms). Below ${MIN_SLACK_TICKS} ticks ` +
        `(${Math.round((MIN_SLACK_TICKS / TICK_HZ) * 1000)}ms) the level is unfair, not hard.`,
    ).toBeGreaterThanOrEqual(MIN_SLACK_TICKS)
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
    const byX = new Map<number, { top: number; bottom: number }>()
    for (const h of T01_LEVEL.hazards) {
      const cur = byX.get(h.x) ?? { top: CEIL_Y, bottom: FLOOR_Y }
      if (h.y <= CEIL_Y) cur.top = Math.max(cur.top, h.y + h.h)
      else cur.bottom = Math.min(cur.bottom, h.y)
      byX.set(h.x, cur)
    }
    for (const [x, { top, bottom }] of byX) {
      expect(bottom - top, `gap at x=${x}`).toBeGreaterThan(PLAYER_H * 2)
    }
  })
})
