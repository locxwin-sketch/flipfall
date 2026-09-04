import { describe, it, expect } from 'vitest'
import { FIXED_DT, PLAYER_H, TICK_HZ } from '@/constants/physics'
import { CEIL_Y, FLOOR_Y } from '@/constants/layout'
import { CHUNK_W } from '@/constants/difficulty'
import { generateChunk } from './generator'
import { difficultyAt, paramsAt } from './difficulty'
import { World } from './world'
import { hitbox, initRun, stepRun, type RunState } from './sim'

const CORRIDOR_MID = (CEIL_Y + FLOOR_Y) / 2

// --- survivability probe -----------------------------------------------------
// A bounded beam search over a WINDOW of generated chunks, ranking by clearance so
// it finds a forgiving line rather than a knife-edge one. Whole-run search over an
// endless world is unbounded; windows keep it affordable on every push.

interface Node {
  run: RunState
  presses: number[]
  clearance: number
}

function clearanceAt(s: RunState, world: World): number {
  const b = hitbox(s.player, s.distance)
  let min = Infinity
  for (const h of world.hazardsInRange(b.x, b.x + b.w)) {
    const gap = h.y > b.y ? h.y - (b.y + b.h) : b.y - (h.y + h.h)
    if (gap < min) min = gap
  }
  return min
}

function startAt(world: World, distance: number): RunState {
  const s = initRun(world)
  return {
    ...s,
    distance,
    player: { ...s.player, y: CORRIDOR_MID - PLAYER_H / 2, grounded: false },
  }
}

interface Probe {
  survived: boolean
  presses: number[]
  reached: number
}

function probeWindow(
  world: World,
  startDistance: number,
  spanPx: number,
  decisionEvery = 6,
  beamWidth = 150,
): Probe {
  world.advance(startDistance)
  const target = startDistance + spanPx
  let beam: Node[] = [{ run: startAt(world, startDistance), presses: [], clearance: Infinity }]
  let bestPresses: number[] | null = null
  let bestClear = -Infinity
  let reached = startDistance

  for (let round = 0; round < 4000 && beam.length; round++) {
    const next: Node[] = []
    for (const node of beam) {
      for (const flip of [false, true]) {
        let s = node.run
        let clear = node.clearance
        const pressTick = s.tick
        for (let t = 0; t < decisionEvery; t++) {
          world.advance(s.distance)
          s = stepRun(s, flip && t === 0, FIXED_DT, world)
          if (s.dead) break
          clear = Math.min(clear, clearanceAt(s, world))
        }
        if (s.dead) continue
        if (s.distance > reached) reached = s.distance
        const presses = flip ? [...node.presses, pressTick] : node.presses
        const n: Node = { run: s, presses, clearance: clear }
        if (s.distance >= target) {
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

  return { survived: bestPresses !== null, presses: bestPresses ?? [], reached }
}

function survives(world: World, startDistance: number, spanPx: number, presses: readonly number[]): boolean {
  const set = new Set(presses)
  let s = startAt(world, startDistance)
  const target = startDistance + spanPx
  while (!s.dead && s.distance < target && s.tick < 60_000) {
    world.advance(s.distance)
    s = stepRun(s, set.has(s.tick), FIXED_DT, world)
  }
  return !s.dead
}

function minSlackTicks(
  world: World,
  startDistance: number,
  spanPx: number,
  presses: readonly number[],
): number {
  let worst = Infinity
  for (let i = 0; i < presses.length; i++) {
    let early = 0
    let late = 0
    for (let d = 1; d <= 20; d++) {
      const sh = [...presses]
      sh[i] = presses[i]! - d
      if (sh[i]! >= 0 && survives(world, startDistance, spanPx, sh)) early = d
      else break
    }
    for (let d = 1; d <= 20; d++) {
      const sh = [...presses]
      sh[i] = presses[i]! + d
      if (survives(world, startDistance, spanPx, sh)) late = d
      else break
    }
    worst = Math.min(worst, early + late + 1)
  }
  return worst === Infinity ? 99 : worst
}

// --- tests -------------------------------------------------------------------

describe('generateChunk', () => {
  it('is deterministic — same (index, seed) gives a deep-equal chunk', () => {
    for (const seed of [1, 99, 123456]) {
      for (const i of [2, 7, 40, 400]) {
        expect(generateChunk(i, seed)).toEqual(generateChunk(i, seed))
      }
    }
  })

  it('does not depend on neighbours having been generated first', () => {
    const forward = generateChunk(30, 7)
    for (let i = 0; i < 30; i++) generateChunk(i, 7)
    expect(generateChunk(30, 7)).toEqual(forward)
  })

  it('gives different seeds different worlds', () => {
    const a = Array.from({ length: 30 }, (_, i) => generateChunk(i + 2, 1).patternId).join()
    const b = Array.from({ length: 30 }, (_, i) => generateChunk(i + 2, 2).patternId).join()
    expect(a).not.toBe(b)
  })

  it('opens with two empty chunks, so nobody dies before understanding the button', () => {
    expect(generateChunk(0, 5).hazards).toHaveLength(0)
    expect(generateChunk(1, 5).hazards).toHaveLength(0)
  })

  it('keeps every hazard inside the corridor and inside its own chunk', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (let i = 0; i < 60; i++) {
        const c = generateChunk(i, seed)
        for (const h of c.hazards) {
          expect(h.y).toBeGreaterThanOrEqual(CEIL_Y)
          expect(h.y + h.h).toBeLessThanOrEqual(FLOOR_Y)
          expect(h.x).toBeGreaterThanOrEqual(c.worldX)
          expect(h.x + h.w).toBeLessThanOrEqual(c.worldX + CHUNK_W)
        }
      }
    }
  })

  it('leaves every pinch gap taller than the player box', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (let i = 0; i < 80; i++) {
        const byX = new Map<number, { top: number; bottom: number }>()
        for (const h of generateChunk(i, seed).hazards) {
          const cur = byX.get(h.x) ?? { top: CEIL_Y, bottom: FLOOR_Y }
          if (h.y <= CEIL_Y) cur.top = Math.max(cur.top, h.y + h.h)
          else cur.bottom = Math.min(cur.bottom, h.y)
          byX.set(h.x, cur)
        }
        for (const [x, g] of byX) {
          expect(g.bottom - g.top, `seed ${seed} chunk ${i} gap at ${x}`).toBeGreaterThan(PLAYER_H * 2)
        }
      }
    }
  })

  it('does not repeat a pattern within a bag of consecutive chunks', () => {
    // The shuffle-bag exists because plain random picks produce visible runs of the
    // same shape, which reads as cheap much faster than any single pattern does.
    for (let seed = 1; seed <= 10; seed++) {
      let maxRun = 1
      let run = 1
      for (let i = 3; i < 120; i++) {
        const a = generateChunk(i - 1, seed).patternId
        const b = generateChunk(i, seed).patternId
        run = a === b ? run + 1 : 1
        maxRun = Math.max(maxRun, run)
      }
      expect(maxRun, `seed ${seed} repeated a pattern ${maxRun}x in a row`).toBeLessThanOrEqual(2)
    }
  })
})

describe('difficulty curve', () => {
  it('is monotonic and bounded', () => {
    let last = -1
    for (let x = 0; x <= 40_000; x += 250) {
      const d = difficultyAt(x)
      expect(d).toBeGreaterThanOrEqual(last)
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(1)
      last = d
    }
  })

  it('keeps the first ten seconds genuinely easy', () => {
    // 10s at the opening scroll speed. The product promise, as an assertion.
    //
    // This used to read `difficultyAt(at10s) < 0.05`. That threshold was a proxy
    // for the promise, calibrated against the old ease-IN curve, and when playtest
    // replaced that curve with an ease-out the proxy failed while the promise it
    // stood for did not: at 10s the player still meets one hazard, tier 0, and
    // over 100ms of slack. So the promise is now asserted as the content the
    // player actually faces, which no future reshaping of the curve can drift away
    // from silently.
    const at10s = paramsAt(0).scrollSpeed * 10
    const p = paramsAt(difficultyAt(at10s))
    expect(p.hazardCount).toBe(1)
    expect(p.maxTier).toBe(0)
    // 12 ticks = 100ms, comfortably above the 6-tick (50ms) human floor.
    expect(p.minSlackTicks).toBeGreaterThanOrEqual(12)
    expect(p.pinchGap).toBeGreaterThan(240)
  })

  it('never asks for timing tighter than the human floor', () => {
    for (let d = 0; d <= 1.0001; d += 0.05) {
      expect(paramsAt(Math.min(1, d)).minSlackTicks).toBeGreaterThanOrEqual(6)
    }
  })
})

describe('generated worlds are survivable with human timing', () => {
  // Three windows: the easy opening, the mid ramp, and deep into the hard end.
  const WINDOWS = [
    { name: 'opening', start: 0, span: CHUNK_W * 6 },
    { name: 'mid-ramp', start: 9_000, span: CHUNK_W * 6 },
    { name: 'hard', start: 26_000, span: CHUNK_W * 6 },
  ]

  for (const w of WINDOWS) {
    it(`${w.name}: a forgiving line exists across 4 seeds`, () => {
      for (let seed = 1; seed <= 4; seed++) {
        const world = new World(seed * 7919 + 3)
        const probe = probeWindow(world, w.start, w.span)
        expect(
          probe.survived,
          `seed ${world.seed} ${w.name}: no line survives; stalled at ${Math.round(probe.reached - w.start)}/${w.span}px`,
        ).toBe(true)

        const slack = minSlackTicks(world, w.start, w.span, probe.presses)
        const ms = Math.round((slack / TICK_HZ) * 1000)
        expect(
          slack,
          `seed ${world.seed} ${w.name}: tightest flip allows ${slack} ticks (${ms}ms), below the 6-tick floor`,
        ).toBeGreaterThanOrEqual(6)
      }
    }, 120_000)
  }
})
