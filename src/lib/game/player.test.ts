import { describe, it, expect } from 'vitest'
import { stepPlayer, spawnState, type Corridor, type PlayerState } from './player'
import { FIXED_DT, GRAVITY, TERMINAL_V, FLIP_DAMP, TICK_HZ, PLAYER_H } from '@/constants/physics'

const CORRIDOR: Corridor = { floorY: 500, ceilY: 40 }

/** Free-flight corridor, so surface clamping never masks the physics under test. */
const OPEN: Corridor = { floorY: 1e9, ceilY: -1e9 }

function run(s: PlayerState, ticks: number, flipAt: ReadonlySet<number> = new Set()): PlayerState {
  let cur = s
  for (let t = 0; t < ticks; t++) cur = stepPlayer(cur, flipAt.has(t), FIXED_DT, OPEN)
  return cur
}

describe('stepPlayer', () => {
  it('is pure — does not mutate its input', () => {
    const s = spawnState(CORRIDOR)
    const before = { ...s }
    stepPlayer(s, true, FIXED_DT, CORRIDOR)
    expect(s).toEqual(before)
  })

  it('free-falls at GRAVITY and clamps at TERMINAL_V', () => {
    const start: PlayerState = { y: 0, vy: 0, gravitySign: 1, grounded: false }
    const after10 = run(start, 10)
    expect(after10.vy).toBeCloseTo(GRAVITY * 10 * FIXED_DT, 6)

    // TERMINAL_V is reached in 900/2400 = 0.375s = 45 ticks.
    const after200 = run(start, 200)
    expect(after200.vy).toBe(TERMINAL_V)
  })

  it('damps rather than zeroes velocity on flip', () => {
    const moving: PlayerState = { y: 0, vy: 600, gravitySign: 1, grounded: false }
    const flipped = stepPlayer(moving, true, FIXED_DT, OPEN)
    // Damped, then one tick of the new (upward) gravity.
    expect(flipped.vy).toBeCloseTo(600 * FLIP_DAMP - GRAVITY * FIXED_DT, 6)
    expect(flipped.vy).not.toBe(0)
    expect(flipped.gravitySign).toBe(-1)
  })

  // Pins the design intent so a future "simplification" to `vy = 0` is caught.
  // Overshoot past the flip point is (FLIP_DAMP*v)^2 / (2*GRAVITY): 3.80px flipping
  // at terminal velocity, 0.19px flipping at 200px/s. Flipping late costs altitude.
  it('punishes late flips: flipping fast overshoots further than flipping slow', () => {
    const overshootFrom = (v: number): number => {
      let s: PlayerState = { y: 0, vy: v, gravitySign: 1, grounded: false }
      let lowest = 0
      for (let t = 0; t < 200; t++) {
        s = stepPlayer(s, t === 0, FIXED_DT, OPEN)
        if (s.y > lowest) lowest = s.y
        if (s.vy < 0 && s.y < lowest) break
      }
      return lowest
    }
    const fast = overshootFrom(TERMINAL_V)
    const slow = overshootFrom(200)

    // The ordering IS the design intent, and it is what must never regress.
    expect(fast).toBeGreaterThan(slow)

    // The continuous closed form is 3.80px. Discrete Euler at 120Hz lands ~14%
    // under it (3.25px) because the first tick's gravity is applied alongside the
    // flip. Bracket it rather than pinning a decimal — a tight assertion here would
    // fail on any legitimate change to TICK_HZ and teach nothing.
    const continuousForm = (FLIP_DAMP * TERMINAL_V) ** 2 / (2 * GRAVITY)
    expect(fast).toBeGreaterThan(continuousForm * 0.75)
    expect(fast).toBeLessThan(continuousForm * 1.25)
  })

  // The emergent technique the difficulty cliff depends on: two flips in quick
  // succession nearly cancel vertical speed, so the player holds altitude through a
  // slot no single flip can thread.
  it('two flips within 100ms hold altitude (the hover exists)', () => {
    const gap = Math.round(0.1 * TICK_HZ) // 12 ticks
    const start: PlayerState = { y: 0, vy: 0, gravitySign: 1, grounded: false }
    const end = run(start, gap * 2, new Set([0, gap]))
    expect(Math.abs(end.y - start.y)).toBeLessThan(30)
  })

  // Same property seen from the other side — this is why the e.repeat guard in
  // engine/input.ts is load-bearing, not cosmetic. Evenly spaced flips are level
  // flight, which is a technique at human tap rates and an exploit at 30Hz.
  it('evenly spaced flips produce level flight', () => {
    const gap = 12
    const flips = new Set<number>()
    for (let t = 0; t < TICK_HZ; t += gap) flips.add(t)
    const start: PlayerState = { y: 0, vy: 0, gravitySign: 1, grounded: false }
    const end = run(start, TICK_HZ, flips)
    expect(Math.abs(end.y - start.y)).toBeLessThan(40)
  })

  it('lands on the floor and reports grounded only when gravity points into it', () => {
    // 2px above the floor at 400px/s: one tick moves 3.5px, so it lands this tick.
    // (A 5px gap would not — 400/120 = 3.33px — which is the kind of arithmetic the
    // fixed timestep makes checkable in the first place.)
    const nearFloor: PlayerState = {
      y: CORRIDOR.floorY - PLAYER_H - 2,
      vy: 400,
      gravitySign: 1,
      grounded: false,
    }
    const landed = stepPlayer(nearFloor, false, FIXED_DT, CORRIDOR)
    expect(landed.y).toBe(CORRIDOR.floorY - PLAYER_H)
    expect(landed.vy).toBe(0)
    expect(landed.grounded).toBe(true)
  })

  it('FLIP_DAMP is inert for a grounded flip, since vy is already 0', () => {
    const grounded = spawnState(CORRIDOR)
    expect(grounded.vy).toBe(0)
    const flipped = stepPlayer(grounded, true, FIXED_DT, CORRIDOR)
    // Pure upward acceleration, no damped residue — which is why the mechanic's
    // depth is invisible during the easy opening.
    expect(flipped.vy).toBeCloseTo(-GRAVITY * FIXED_DT, 6)
  })
})
