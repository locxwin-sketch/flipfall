import { describe, it, expect } from 'vitest'
import { FIXED_DT, PLAYER_H } from '@/constants/physics'
import { CEIL_Y, FLOOR_Y } from '@/constants/layout'
import { COIN_POINTS, GRAZE_POINTS } from '@/constants/scoring'
import { MODES, type Mode } from '@/constants/modes'
import { World } from './world'
import { bonusScore, initRun, score, stepRun, type RunState } from './sim'

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

  it('sums coins and grazes in the same units as distance', () => {
    const base = initRun(new World(1, 'gauntlet'))
    expect(bonusScore(base)).toBe(0)
    expect(bonusScore({ ...base, coins: 3, grazes: 2 })).toBe(3 * COIN_POINTS + 2 * GRAZE_POINTS)
  })

  it('leaves the distance score untouched, so Endless bests stay comparable', () => {
    // Endless bests were set before coins and grazing existed. `score` is what
    // they were set against and it must keep meaning exactly what it meant.
    const base = initRun(new World(1, 'endless'))
    const withBonus = { ...base, distance: 5000, coins: 40, grazes: 40 }
    expect(score(withBonus)).toBe(500)
  })
})
