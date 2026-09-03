import { describe, it, expect } from 'vitest'
import {
  TICK_HZ,
  FIXED_DT,
  MAX_FRAME_DELTA_MS,
  MAX_TICKS_PER_FRAME,
  TERMINAL_V,
  SCROLL_MAX,
  PLAYER_W,
  HITBOX_INSET,
  MIN_HAZARD_THICKNESS,
} from './physics'

describe('physics constants', () => {
  it('derives MAX_TICKS_PER_FRAME from the clamp rather than hard-coding it', () => {
    expect(MAX_TICKS_PER_FRAME).toBe(Math.ceil((MAX_FRAME_DELTA_MS / 1000) * TICK_HZ))
    expect(FIXED_DT).toBeCloseTo(1 / TICK_HZ, 12)
  })

  // The invariant that stops someone raising TERMINAL_V or SCROLL_MAX, widening
  // HITBOX_INSET, or lowering TICK_HZ and silently introducing pass-through deaths.
  // Two-axis on purpose: a one-axis form catches only the first of those four.
  it('cannot tunnel through the thinnest hazard in one tick', () => {
    const perTickDiagonal = Math.hypot(SCROLL_MAX / TICK_HZ, TERMINAL_V / TICK_HZ)
    const hitbox = PLAYER_W - 2 * HITBOX_INSET
    expect(perTickDiagonal).toBeLessThan(hitbox + MIN_HAZARD_THICKNESS)
  })

  it('would violate the anti-tunnel invariant at 60Hz, which is why 120 is load-bearing', () => {
    const at60 = Math.hypot(SCROLL_MAX / 60, TERMINAL_V / 60)
    expect(at60).toBeGreaterThan(MIN_HAZARD_THICKNESS)
  })
})
