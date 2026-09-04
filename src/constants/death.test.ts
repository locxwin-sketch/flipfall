import { describe, it, expect } from 'vitest'
import { PALETTE } from './palette'
import { PIG_COLORS } from '@/lib/render/sprites'
import { DEATH_LOOKS, DEATH_STYLE, type DeathLook, type DeathStyle } from './death'

const STYLES = Object.keys(DEATH_LOOKS) as DeathStyle[]

const hex = (c: string): boolean => /^#[0-9a-f]{6}$/i.test(c)
const paintable = (c: string): boolean => hex(c) || /^rgba?\(/.test(c)

describe('death styles', () => {
  it('ships a style that exists', () => {
    expect(DEATH_LOOKS[DEATH_STYLE]).toBeDefined()
  })

  it('offers both a splatter and a splatter-free option', () => {
    // The whole reason this file exists: one of these must be submittable to a
    // portal that restricts gore. Losing the 'coins' style silently would put the
    // portal fork back in the art's hands.
    expect(STYLES).toContain('slime')
    expect(STYLES).toContain('coins')
  })

  it.each(STYLES)('%s is fully specified', (style) => {
    const look: DeathLook = DEATH_LOOKS[style]
    expect(hex(look.chunkA.color)).toBe(true)
    expect(hex(look.chunkB.color)).toBe(true)
    expect(look.chunkA.size).toBeGreaterThan(0)
    expect(look.chunkB.size).toBeGreaterThan(0)
    // Debris must fall, or it reads as floating rather than as thrown.
    expect(look.chunkA.gravity).toBeGreaterThan(0)
    expect(look.chunkB.gravity).toBeGreaterThan(0)
    expect(look.rings).toHaveLength(3)
    for (const r of look.rings) expect(hex(r)).toBe(true)
    expect(hex(look.spark)).toBe(true)
    expect(hex(look.drift)).toBe(true)
    expect(look.lens.colors.length).toBeGreaterThan(0)
    for (const c of look.lens.colors) expect(hex(c)).toBe(true)
    expect(paintable(look.wash)).toBe(true)
    expect(paintable(look.vignette)).toBe(true)
  })

  it.each(STYLES)('%s keeps a dark ring wake for contrast', (style) => {
    // Third ring is the wake. A bright wake behind a bright leading edge loses the
    // edge entirely — the ring stops reading as pressure and becomes a blob.
    expect(DEATH_LOOKS[style].rings[2]).toBe('#1a1a24')
  })

  // Debris has to contrast with the thing it came out of, or it stops reading as
  // debris: pink debris off a pink pig merges with the sprite shatter and turns the
  // blast to mush. This is the trap that ruled pink blood out (docs/JOURNAL.md), and
  // it applies to any style added later.
  //
  // Measured, not guessed. Against the pig's palette the shipped styles sit 64.7
  // apart at their closest (coins' #ff4d6d vs the trotter #c85f8a); pink candidates
  // score 0-25. 45 sits in that gap with headroom on both sides.
  const MIN_CONTRAST = 45

  const rgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]

  /** Straight RGB distance. Crude next to a perceptual metric, but this only has to
   *  separate "obviously the pig's colour" from "obviously not". */
  function contrast(a: string, b: string): number {
    const [r1, g1, b1] = rgb(a)
    const [r2, g2, b2] = rgb(b)
    return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
  }

  it.each(STYLES)('%s debris is distinguishable from the pig itself', (style) => {
    const look = DEATH_LOOKS[style]
    const debris = [look.chunkA.color, look.chunkB.color, ...look.lens.colors]
    for (const d of debris) {
      for (const [key, pig] of Object.entries(PIG_COLORS)) {
        // White is the eye glint, one pixel of it, and white is load-bearing
        // elsewhere (smoke, sparks). Excluding it is deliberate.
        if (pig.toLowerCase() === '#ffffff') continue
        const gap = contrast(d, pig)
        expect(
          gap,
          `${style} debris ${d} is only ${gap.toFixed(1)} from pig colour '${key}' ${pig}`,
        ).toBeGreaterThan(MIN_CONTRAST)
      }
    }
  })

  // The same rule, pointed at the world instead of the pig. This trap has now been
  // sprung twice by hand — banknote green #7dbf6a vanished over the hills, and the
  // coins' dark gold measured 40 from the brick floor, so coins that landed on the
  // ground half-disappeared. Both were caught by staring at a screenshot. This is
  // that check, automated.
  //
  // It is also what forces the slime to be an acid yellow-green: the backdrop is
  // full of greens, and every natural one fails here (emerald measures 32 against
  // hillFar, forest green 40 against bushDark).
  const BACKDROP: Record<string, string> = {
    skyTop: PALETTE.skyTop,
    skyBottom: PALETTE.skyBottom,
    hillFar: PALETTE.hillFar,
    hillFarDark: PALETTE.hillFarDark,
    hillNear: PALETTE.hillNear,
    hillNearDark: PALETTE.hillNearDark,
    bush: PALETTE.bush,
    bushDark: PALETTE.bushDark,
    brick: PALETTE.brick,
    brickDark: PALETTE.brickDark,
    brickTop: PALETTE.brickTop,
    soil: PALETTE.soil,
  }

  it.each(STYLES)('%s debris stays visible against the backdrop', (style) => {
    const look = DEATH_LOOKS[style]
    // Lens debris sits in screen space over anything, and world chunks fall onto the
    // floor, so both have to clear every surface they can end up in front of.
    const debris = [look.chunkA.color, look.chunkB.color, ...look.lens.colors]
    for (const d of debris) {
      for (const [key, bg] of Object.entries(BACKDROP)) {
        const gap = contrast(d, bg)
        expect(
          gap,
          `${style} debris ${d} is only ${gap.toFixed(1)} from backdrop '${key}' ${bg}`,
        ).toBeGreaterThan(MIN_CONTRAST)
      }
    }
  })

  it('would reject a pig-pink style', () => {
    // The guard is only worth having if it actually fires. This is the exact idea
    // that was floated and rejected: recolour the splatter to match the pig.
    const pigPink = PIG_COLORS.p!
    expect(contrast(pigPink, PIG_COLORS.p!)).toBeLessThan(MIN_CONTRAST)
    // And a near-miss, not just an exact match — string equality would let this by.
    expect(contrast('#ffb3d1', PIG_COLORS.p!)).toBeLessThan(MIN_CONTRAST)
  })
})
