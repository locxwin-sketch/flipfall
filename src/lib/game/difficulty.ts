import type { DifficultyParams } from '@/constants/difficulty'
import type { Curve } from '@/constants/modes'

/**
 * Normalised difficulty in [0,1] for a world distance on a given curve. Pure,
 * monotonic.
 *
 * The curve is an explicit argument with no default on purpose. A default would
 * silently compute Endless's difficulty inside a Gauntlet run — the kind of bug
 * that produces a mode which looks right, generates the wrong content, and passes
 * every test that forgot to pass a curve.
 */
export function difficultyAt(distancePx: number, curve: Curve): number {
  if (distancePx <= curve.startPx) return 0
  if (distancePx >= curve.endPx) return 1
  const t = (distancePx - curve.startPx) / (curve.endPx - curve.startPx)
  // Ease-OUT, and this is a reversal. The original smoothstep eased *in* on the
  // theory that a flat first stretch reads as a gentle opening. Playtest said the
  // opposite: because maxTier is quantised, a flat toe means the player sees
  // literally identical content for half a minute, and "gentle" became "nothing is
  // happening". Climbing early and flattening at the top puts the variety where
  // attention is, and still takes ~67s to reach maximum on the Endless curve.
  return 1 - Math.pow(1 - t, 1.6)
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export function paramsAt(d: number, curve: Curve): DifficultyParams {
  const { easiest, hardest } = curve
  return {
    scrollSpeed: lerp(easiest.scrollSpeed, hardest.scrollSpeed, d),
    hazardCount: Math.round(lerp(easiest.hazardCount, hardest.hazardCount, d)),
    pinchGap: lerp(easiest.pinchGap, hardest.pinchGap, d),
    pinchOffset: lerp(easiest.pinchOffset, hardest.pinchOffset, d),
    maxTier: Math.floor(lerp(easiest.maxTier, hardest.maxTier + 0.999, d)),
    minSlackTicks: Math.round(lerp(easiest.minSlackTicks, hardest.minSlackTicks, d)),
  }
}

/** Convenience for the sim: scroll speed is a pure function of distance. */
export function scrollSpeedAt(distancePx: number, curve: Curve): number {
  return paramsAt(difficultyAt(distancePx, curve), curve).scrollSpeed
}
