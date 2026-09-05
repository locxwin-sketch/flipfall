import { describe, it, expect } from 'vitest'
import { FIXED_DT, HITBOX_INSET, PLAYER_H } from '@/constants/physics'
import { CEIL_Y, FLOOR_Y, PLAYER_X } from '@/constants/layout'
import { ENDLESS_CURVE, GAUNTLET_CURVE, MODES, type Mode } from '@/constants/modes'
import { overlap } from '@/lib/engine/aabb'
import { generateChunk } from './generator'
import { COIN_STRIDE } from './level'
import { World } from './world'
import { initRun, stepRun, type RunState } from './sim'

const CURVES = [
  ['endless', ENDLESS_CURVE],
  ['gauntlet', GAUNTLET_CURVE],
] as const

describe('coin placement', () => {
  it('is deterministic — same (index, seed, curve) gives the same coins', () => {
    for (const [, curve] of CURVES) {
      for (const i of [2, 9, 51, 300]) {
        expect(generateChunk(i, 4242, curve).coins).toEqual(generateChunk(i, 4242, curve).coins)
      }
    }
  })

  it('never puts a coin inside a hazard', () => {
    // The one placement bug that would actively lie to the player: gold is the
    // "go here" signal in every game that has ever used it, so a coin sitting in a
    // spike is not a hard coin, it is a trap. Coins are derived from the hazards,
    // which is exactly the code path that could get this wrong.
    for (const [name, curve] of CURVES) {
      for (let seed = 1; seed <= 30; seed++) {
        for (let i = 0; i < 60; i++) {
          const c = generateChunk(i, seed, curve)
          for (const coin of c.coins) {
            for (const h of c.hazards) {
              expect(overlap(coin, h), `${name} seed ${seed} chunk ${i} coin ${coin.id}`).toBe(false)
            }
          }
        }
      }
    }
  })

  it('keeps every coin inside the corridor and reachable', () => {
    for (const [name, curve] of CURVES) {
      for (let seed = 1; seed <= 20; seed++) {
        for (let i = 0; i < 60; i++) {
          for (const coin of generateChunk(i, seed, curve).coins) {
            expect(coin.y, `${name} seed ${seed}`).toBeGreaterThanOrEqual(CEIL_Y)
            expect(coin.y + coin.h, `${name} seed ${seed}`).toBeLessThanOrEqual(FLOOR_Y)
          }
        }
      }
    }
  })

  it('gives every coin in the world a unique id', () => {
    // Ids are (chunk * COIN_STRIDE + slot). A collision would make one coin
    // uncollectable forever, because taking either marks both.
    for (const [name, curve] of CURVES) {
      const seen = new Set<number>()
      for (let i = 0; i < 400; i++) {
        for (const coin of generateChunk(i, 77, curve).coins) {
          expect(seen.has(coin.id), `${name} duplicate id ${coin.id} in chunk ${i}`).toBe(false)
          seen.add(coin.id)
        }
      }
      expect(seen.size).toBeGreaterThan(100)
    }
  })

  it('never emits more coins per chunk than the id stride allows', () => {
    for (const [name, curve] of CURVES) {
      for (let seed = 1; seed <= 20; seed++) {
        for (let i = 0; i < 80; i++) {
          expect(generateChunk(i, seed, curve).coins.length, name).toBeLessThan(COIN_STRIDE)
        }
      }
    }
  })
})

/** Fly straight down the middle by flipping on a fixed cadence, and see what sticks. */
function driftRun(mode: Mode, seed: number, ticks: number): RunState {
  const world = new World(seed, mode)
  let s = initRun(world)
  s = { ...s, player: { ...s.player, y: (CEIL_Y + FLOOR_Y) / 2 - PLAYER_H / 2, grounded: false } }
  for (let t = 0; t < ticks && !s.dead; t++) {
    world.advance(s.distance)
    s = stepRun(s, t % 14 === 0, FIXED_DT, world)
  }
  return s
}

describe('coin collection', () => {
  it('counts a coin once, not once per tick of contact', () => {
    // A 16px coin overlaps the 16px hitbox for several consecutive ticks at scroll
    // speed. Placing the player directly on a known coin tests the dedup itself,
    // rather than testing whether a dumb flight path happens to survive far enough
    // to find one — which is a fact about the level, not about collection.
    const world = new World(8, 'endless')
    world.advance(0)
    let target: { x: number; y: number; id: number } | null = null
    for (let i = 2; i < 40 && !target; i++) {
      const c = world.chunk(i)
      if (c.hazards.length === 0 && c.coins.length > 0) target = c.coins[0]!
    }
    expect(target, 'no coin found in any hazard-free chunk').not.toBeNull()

    let s: RunState = initRun(world)
    s = {
      ...s,
      distance: target!.x - PLAYER_X - HITBOX_INSET,
      player: { ...s.player, y: target!.y - HITBOX_INSET, vy: 0, grounded: false },
    }

    let contactTicks = 0
    for (let t = 0; t < 10; t++) {
      const before = s.coins
      world.advance(s.distance)
      s = stepRun(s, false, FIXED_DT, world)
      if (s.takenCoins.includes(target!.id)) contactTicks++
      if (s.coins > before) expect(s.coins - before, 'more than one coin per tick').toBe(1)
    }

    expect(s.coins, 'the coin was never collected').toBe(1)
    expect(contactTicks, 'coin was not in contact long enough to prove dedup').toBeGreaterThan(1)
  })

  it('prunes the taken-list instead of growing it for the whole run', () => {
    // takenCoins is copied into a fresh RunState every tick. Unbounded, that is a
    // leak that gets slower the better the player is doing.
    for (const mode of MODES) {
      const s = driftRun(mode, 9, 6000)
      expect(s.takenCoins.length, `${mode}: taken-list unpruned`).toBeLessThan(40)
    }
  })

  it('is replay-stable: the same schedule collects the same coins', () => {
    for (const mode of MODES) {
      const a = driftRun(mode, 31, 1800)
      const b = driftRun(mode, 31, 1800)
      expect(a.coins, mode).toBe(b.coins)
      expect(a.takenCoins, mode).toEqual(b.takenCoins)
    }
  })

  it('stops collecting once dead', () => {
    const world = new World(3, 'endless')
    let s = initRun(world)
    s = { ...s, dead: true, coins: 5 }
    const after = stepRun(s, false, FIXED_DT, world)
    expect(after.coins).toBe(5)
  })
})
