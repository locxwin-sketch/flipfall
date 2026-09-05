import { describe, it, expect } from 'vitest'
import { EASIEST, HARDEST } from './difficulty'
import { SCROLL_MAX, SCROLL_START } from './physics'
import { curveFor, ENDLESS_CURVE, GAUNTLET_CURVE, isMode, MODES, seedSalt, type Curve } from './modes'
import { difficultyAt, paramsAt } from '@/lib/game/difficulty'

const CURVES: ReadonlyArray<[string, Curve]> = [
  ['endless', ENDLESS_CURVE],
  ['gauntlet', GAUNTLET_CURVE],
]

describe('mode curves', () => {
  it('joins the two modes: Gauntlet opens exactly where Endless tops out', () => {
    // The whole design of the second mode is this identity. If someone retunes
    // HARDEST and not GAUNTLET_CURVE, Gauntlet silently stops being a continuation
    // of Endless and becomes an unrelated difficulty that happens to be nearby.
    expect(GAUNTLET_CURVE.easiest).toBe(HARDEST)
    expect(ENDLESS_CURVE.hardest).toBe(HARDEST)

    const endlessTerminal = paramsAt(difficultyAt(1e9, ENDLESS_CURVE), ENDLESS_CURVE)
    const gauntletOpening = paramsAt(difficultyAt(0, GAUNTLET_CURVE), GAUNTLET_CURVE)
    expect(gauntletOpening).toEqual(endlessTerminal)
  })

  it('keeps every curve inside the physics speed envelope', () => {
    // SCROLL_START/SCROLL_MAX are the envelope the anti-tunnel invariant is proved
    // against. A curve that outruns them makes physics.test.ts a proof about a
    // speed the game never reaches.
    for (const [name, c] of CURVES) {
      expect(c.easiest.scrollSpeed, name).toBeGreaterThanOrEqual(SCROLL_START)
      expect(c.hardest.scrollSpeed, name).toBeLessThanOrEqual(SCROLL_MAX)
      expect(c.hardest.scrollSpeed, name).toBeGreaterThan(c.easiest.scrollSpeed)
    }
  })

  it('never asks for timing below the measured human floor, in any mode', () => {
    // 6 ticks (50ms) is a property of human reaction, not a difficulty dial. A
    // harder mode may ask for more decisions per second; it may not ask for
    // reactions nobody can make. This is the one number Gauntlet must not move.
    for (const [name, c] of CURVES) {
      expect(c.easiest.minSlackTicks, name).toBeGreaterThanOrEqual(6)
      expect(c.hardest.minSlackTicks, name).toBeGreaterThanOrEqual(6)
    }
  })

  it('ramps monotonically from 0 to 1 on every curve', () => {
    for (const [name, c] of CURVES) {
      expect(difficultyAt(c.startPx, c), name).toBe(0)
      expect(difficultyAt(c.endPx, c), name).toBe(1)
      let prev = -1
      for (let x = 0; x <= c.endPx * 1.2; x += c.endPx / 200) {
        const d = difficultyAt(x, c)
        expect(d, `${name} @${x}`).toBeGreaterThanOrEqual(prev)
        expect(d, `${name} @${x}`).toBeLessThanOrEqual(1)
        prev = d
      }
    }
  })

  it('makes Gauntlet strictly harder than Endless at equal distance', () => {
    for (let x = 0; x <= 30_000; x += 500) {
      const e = paramsAt(difficultyAt(x, ENDLESS_CURVE), ENDLESS_CURVE)
      const g = paramsAt(difficultyAt(x, GAUNTLET_CURVE), GAUNTLET_CURVE)
      expect(g.scrollSpeed, `@${x}`).toBeGreaterThanOrEqual(e.scrollSpeed)
      expect(g.pinchGap, `@${x}`).toBeLessThanOrEqual(e.pinchGap)
    }
  })

  it('gives each mode its own seed stream, and leaves Endless the one it had', () => {
    // Endless must salt to 0 forever: its seed→world mapping predates the second
    // mode, and every screenshot and bug report taken so far assumes it.
    expect(seedSalt('endless')).toBe(0)
    expect(seedSalt('gauntlet')).not.toBe(0)
  })

  it('resolves and validates mode names', () => {
    expect(MODES).toEqual(['endless', 'gauntlet'])
    expect(curveFor('endless')).toBe(ENDLESS_CURVE)
    expect(curveFor('gauntlet')).toBe(GAUNTLET_CURVE)
    expect(isMode('gauntlet')).toBe(true)
    expect(isMode('nonsense')).toBe(false)
    expect(isMode(undefined)).toBe(false)
  })

  it('still opens Endless at the gentlest settings there are', () => {
    expect(ENDLESS_CURVE.easiest).toBe(EASIEST)
    expect(difficultyAt(0, ENDLESS_CURVE)).toBe(0)
  })
})
