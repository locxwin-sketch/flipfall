import { describe, it, expect } from 'vitest'
import { FIXED_DT, PLAYER_H } from '@/constants/physics'
import { CEIL_Y, FLOOR_Y } from '@/constants/layout'
import { COIN_POINTS, FLOW_MULT_CAP, FLOW_MULT_STEP, GRAZE_POINTS } from '@/constants/scoring'
import { MODES, type Mode } from '@/constants/modes'
import { World } from './world'
import { bonusScore, flowMultiplier, initRun, score, stepRun, type RunState } from './sim'

function fly(mode: Mode, seed: number, ticks: number, cadence = 14) {
  const world = new World(seed, mode)
  let s = initRun(world)
  s = { ...s, player: { ...s.player, y: (CEIL_Y + FLOOR_Y) / 2 - PLAYER_H / 2, grounded: false } }
  let grazingTicks = 0
  for (let t = 0; t < ticks && !s.dead; t++) {
    world.advance(s.distance)
    s = stepRun(s, t % cadence === 0, FIXED_DT, world)
    if (s.grazing) grazingTicks++
  }
  return { s, grazingTicks }
}

describe('grazing', () => {
  it('counts one graze per close pass, not one per tick inside the band', () => {
    // The whole point of the edge trigger. At scroll speed the hitbox sits inside
    // the band for many consecutive ticks; a per-tick counter would turn a single
    // near-miss into a jackpot and make the metric meaningless.
    let sawSustainedGraze = false
    for (let seed = 1; seed <= 20; seed++) {
      const { s, grazingTicks } = fly('gauntlet', seed, 3000)
      expect(s.grazes, `seed ${seed}`).toBeLessThanOrEqual(grazingTicks)
      if (grazingTicks >= s.grazes * 2 && grazingTicks > 8) sawSustainedGraze = true
    }
    expect(sawSustainedGraze, 'no run ever held a graze for multiple ticks').toBe(true)
  })

  it('scores nothing for flying through open air', () => {
    // The world opens with two guaranteed-empty chunks. Crossing them touching
    // nothing must not pay out, or "close call" means "call".
    const world = new World(5, 'endless')
    let s: RunState = initRun(world)
    s = { ...s, player: { ...s.player, y: (CEIL_Y + FLOOR_Y) / 2 - PLAYER_H / 2, grounded: false } }
    for (let t = 0; t < 90; t++) {
      world.advance(s.distance)
      s = stepRun(s, t % 12 === 0, FIXED_DT, world)
    }
    expect(s.dead).toBe(false)
    expect(s.grazes).toBe(0)
    expect(s.grazing).toBe(false)
  })

  it('never registers a graze on the tick the run dies', () => {
    // Dying is not a near miss. If the band were checked before the kill, every
    // death would also pay a graze bonus.
    for (let seed = 1; seed <= 40; seed++) {
      const { s } = fly('gauntlet', seed, 5000, 37)
      if (s.dead) expect(s.grazing, `seed ${seed}`).toBe(false)
    }
  })

  it('is deterministic across identical runs', () => {
    for (const mode of MODES) {
      const a = fly(mode, 21, 2000).s
      const b = fly(mode, 21, 2000).s
      expect(a.grazes, mode).toBe(b.grazes)
      expect(a.grazing, mode).toBe(b.grazing)
    }
  })
})

describe('bonus scoring', () => {
  it('prices a graze above a coin', () => {
    // A coin sits on the line whether or not you were in danger. A graze is only
    // ever paid out for having been one hitbox from dead.
    expect(GRAZE_POINTS).toBeGreaterThan(COIN_POINTS)
  })

  it('reads the accumulated bonus, in the same units as distance', () => {
    // bonusScore is a passthrough to `bonus`, not `coins*rate + grazes*rate` — the
    // rate isn't constant across a run once Flow is multiplying it. See the 'Flow'
    // describe block below for how `bonus` actually gets built up.
    const base = initRun(new World(1, 'gauntlet'))
    expect(bonusScore(base)).toBe(0)
    expect(bonusScore({ ...base, bonus: 137 })).toBe(137)
  })

  it('leaves the distance score untouched, so Endless bests stay comparable', () => {
    // Endless bests were set before coins and grazing existed. `score` is what
    // they were set against and it must keep meaning exactly what it meant.
    const base = initRun(new World(1, 'endless'))
    const withBonus = { ...base, distance: 5000, coins: 40, grazes: 40, bonus: 9999 }
    expect(score(withBonus)).toBe(500)
  })
})

describe('flowMultiplier', () => {
  it('is 1x with no streak, and climbs in FLOW_MULT_STEP per near-miss', () => {
    expect(flowMultiplier(0)).toBe(1)
    expect(flowMultiplier(1)).toBe(1 + FLOW_MULT_STEP)
    expect(flowMultiplier(2)).toBe(1 + FLOW_MULT_STEP * 2)
  })

  it('caps rather than climbing forever', () => {
    const flowAtCap = (FLOW_MULT_CAP - 1) / FLOW_MULT_STEP
    expect(flowMultiplier(flowAtCap)).toBe(FLOW_MULT_CAP)
    expect(flowMultiplier(flowAtCap + 10)).toBe(FLOW_MULT_CAP)
  })
})

describe('Flow', () => {
  /**
   * Records (prev, next) for every live tick of a drift run, so the tests below
   * can check the bonus formula against real generated content rather than a
   * hand-built fixture — the same standard `coins.test.ts` and the fairness probe
   * hold generation to elsewhere in this codebase.
   */
  function driftTicks(mode: Mode, seed: number, ticks: number, cadence = 14) {
    const world = new World(seed, mode)
    let s: RunState = initRun(world)
    s = { ...s, player: { ...s.player, y: (CEIL_Y + FLOOR_Y) / 2 - PLAYER_H / 2, grounded: false } }
    const pairs: Array<{ prev: RunState; next: RunState }> = []
    for (let t = 0; t < ticks && !s.dead; t++) {
      const prev = s
      world.advance(s.distance)
      s = stepRun(s, t % cadence === 0, FIXED_DT, world)
      pairs.push({ prev, next: s })
    }
    return pairs
  }

  it('pays every coin and graze at the multiplier live the instant BEFORE that tick — verified against real generated runs, not the implementation', () => {
    // Black-box: `flowBefore` comes from `prev.flow` (a field already pinned by
    // the 'resets to zero on landing' and determinism tests below), adjusted only
    // for a same-tick landing — never a shadow counter this test increments
    // itself, which could silently drift out of sync with sim.ts over thousands
    // of ticks and validate nothing.
    let checkedAnyEvent = false
    for (const mode of MODES) {
      for (let seed = 1; seed <= 15; seed++) {
        for (const { prev, next } of driftTicks(mode, seed, 2500)) {
          const landed = !prev.player.grounded && next.player.grounded
          const flowBefore = landed ? 0 : prev.flow

          const coinsGained = next.coins - prev.coins
          const gotGraze = next.grazes > prev.grazes
          const expectedDelta = (coinsGained * COIN_POINTS + (gotGraze ? GRAZE_POINTS : 0)) * flowMultiplier(flowBefore)

          if (coinsGained > 0 || gotGraze) {
            expect(next.bonus - prev.bonus, `${mode} seed ${seed} tick ${next.tick}`).toBeCloseTo(expectedDelta, 9)
            checkedAnyEvent = true
          } else {
            expect(next.bonus, `${mode} seed ${seed} tick ${next.tick}`).toBe(prev.bonus)
          }
        }
      }
    }
    expect(checkedAnyEvent, 'no run ever earned a coin or graze to check').toBe(true)
  })

  it('scores a second near-miss higher than the first, provided the streak survives', () => {
    // The semantic point of Flow, checked independently of the exact formula
    // above: stringing grazes together is worth MORE than the same grazes spread
    // across separate landings.
    let sawEscalation = false
    for (let seed = 1; seed <= 30; seed++) {
      for (const { prev, next } of driftTicks('gauntlet', seed, 4000, 11)) {
        const landed = !prev.player.grounded && next.player.grounded
        const flowBefore = landed ? 0 : prev.flow
        if (next.grazes > prev.grazes && next.coins === prev.coins) {
          const paid = next.bonus - prev.bonus
          if (flowBefore > 0 && paid > GRAZE_POINTS) sawEscalation = true
        }
      }
    }
    expect(sawEscalation, 'no streak of 2+ grazes without a landing ever occurred').toBe(true)
  })

  it('resets to zero on landing, not on death', () => {
    // Gauntlet opens at Endless's HARDEST settings, so a naive non-reactive drift
    // bot rarely lands at all once airborne — mining real runs for a "streak, then
    // a landing" coincidence turned out to be unreliable. Precise placement instead:
    // parked exactly at resting height with a landing already guaranteed next tick
    // (mirrors player.ts's own clamp — see stepPlayer), in the guaranteed-empty
    // intro chunk so no hazard can interfere, with a streak injected directly.
    const world = new World(1, 'gauntlet')
    let s: RunState = initRun(world)
    s = {
      ...s,
      distance: 0,
      player: { ...s.player, y: FLOOR_Y - PLAYER_H, vy: 10, gravitySign: 1, grounded: false },
      flow: 3,
      bonus: 250,
    }
    world.advance(s.distance)
    const next = stepRun(s, false, FIXED_DT, world)

    expect(next.player.grounded, 'setup failed to land as intended').toBe(true)
    expect(next.flow).toBe(0)
    // Landing must never touch bonus — only future earning power is reset.
    expect(next.bonus).toBe(250)
  })

  it('never takes bonus away — dying preserves exactly what was already banked', () => {
    for (const mode of MODES) {
      for (let seed = 1; seed <= 20; seed++) {
        let prevBonus = 0
        let final: RunState | null = null
        for (const { next } of driftTicks(mode, seed, 6000)) {
          expect(next.bonus, `${mode} seed ${seed} tick ${next.tick}`).toBeGreaterThanOrEqual(prevBonus)
          prevBonus = next.bonus
          final = next
        }
        if (final?.dead) expect(final.bonus).toBe(prevBonus)
      }
    }
  })

  it('is deterministic across identical runs', () => {
    for (const mode of MODES) {
      const a = driftTicks(mode, 44, 2000)
      const b = driftTicks(mode, 44, 2000)
      const lastA = a[a.length - 1]!.next
      const lastB = b[b.length - 1]!.next
      expect(lastA.bonus, mode).toBe(lastB.bonus)
      expect(lastA.flow, mode).toBe(lastB.flow)
    }
  })
})
