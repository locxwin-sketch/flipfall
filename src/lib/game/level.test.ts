import { describe, it, expect } from 'vitest'
import { FIXED_DT, PLAYER_H, TICK_HZ } from '@/constants/physics'
import { CEIL_Y, FLOOR_Y } from '@/constants/layout'
import { T01_LEVEL } from './level'
import { hitbox, initRun, stepRun, type RunState } from './sim'

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
  /** Smallest vertical clearance to any hazard seen so far on this line. */
  clearance: number
}

// Bucket hazards by x so the per-tick clearance check scans ~2 instead of ~40.
// This test runs on every push; the unindexed version took 6.7s on a CI runner and
// blew Vitest's 5s default timeout while passing locally in 1s.
const BUCKET = 256
const HAZARD_BUCKETS = new Map<number, typeof T01_LEVEL.hazards>()
for (const h of T01_LEVEL.hazards) {
  for (let b = Math.floor(h.x / BUCKET); b <= Math.floor((h.x + h.w) / BUCKET); b++) {
    const list = HAZARD_BUCKETS.get(b) ?? []
    list.push(h)
    HAZARD_BUCKETS.set(b, list)
  }
}

/** Vertical margin from the hitbox to any hazard whose x-range it currently overlaps. */
function clearanceAt(s: RunState): number {
  const b = hitbox(s.player, s.distance)
  let min = Infinity
  for (let k = Math.floor(b.x / BUCKET); k <= Math.floor((b.x + b.w) / BUCKET); k++) {
    const bucket = HAZARD_BUCKETS.get(k)
    if (!bucket) continue
    for (const h of bucket) {
      if (h.x + h.w < b.x || h.x > b.x + b.w) continue
      const gap = h.y > b.y ? h.y - (b.y + b.h) : b.y - (h.y + h.h)
      if (gap < min) min = gap
    }
  }
  return min
}

/**
 * Bounded beam search returning the press schedule, not just a verdict. A crude
 * stand-in for the T04 reachability solver — but crucially it integrates through
 * the game's own stepRun, so it cannot certify something the game would kill.
 *
 * It ranks by CLEARANCE as well as progress. An earlier version returned the first
 * clearing schedule found, which measured an arbitrary knife-edge line: widening a
 * gap scored WORSE, because the extra room let the search discover a more marginal
 * route. The question is whether a forgiving solution exists, not whether some
 * solution does.
 */
function findClearingSchedule(decisionEvery = 4, beamWidth = 700): number[] | null {
  let beam: Node[] = [{ run: initRun(T01_LEVEL), presses: [], clearance: Infinity }]
  let bestPresses: number[] | null = null
  let bestClear = -Infinity

  for (let round = 0; round < 2400 && beam.length; round++) {
    const next: Node[] = []
    for (const node of beam) {
      for (const flip of [false, true]) {
        let s = node.run
        let clear = node.clearance
        const pressTick = s.tick
        for (let t = 0; t < decisionEvery; t++) {
          s = stepRun(s, flip && t === 0, FIXED_DT, T01_LEVEL)
          if (s.dead || s.finished) break
          clear = Math.min(clear, clearanceAt(s))
        }
        if (s.dead) continue
        const presses = flip ? [...node.presses, pressTick] : node.presses
        const n: Node = { run: s, presses, clearance: clear }
        if (s.finished) {
          if (clear > bestClear) {
            bestClear = clear
            bestPresses = presses
          }
          continue
        }
        next.push(n)
      }
    }
    if (bestPresses && next.length === 0) break
    const seen = new Map<string, Node>()
    for (const n of next) {
      const k = `${Math.round(n.run.player.y / 4)}:${Math.round(n.run.player.vy / 25)}:${n.run.player.gravitySign}`
      const prior = seen.get(k)
      if (!prior || n.clearance > prior.clearance) seen.set(k, n)
    }
    beam = [...seen.values()]
      .sort((a, b) => b.run.distance - a.run.distance || b.clearance - a.clearance)
      .slice(0, beamWidth)
  }
  return bestPresses
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
  }, 120_000)

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
