import {
  EASIEST,
  HARDEST,
  RAMP_END_PX,
  RAMP_START_PX,
  type DifficultyParams,
} from '@/constants/difficulty'

/** Normalised difficulty in [0,1] for a world distance. Pure, monotonic. */
export function difficultyAt(distancePx: number): number {
  if (distancePx <= RAMP_START_PX) return 0
  if (distancePx >= RAMP_END_PX) return 1
  const t = (distancePx - RAMP_START_PX) / (RAMP_END_PX - RAMP_START_PX)
  // Ease-OUT, and this is a reversal. The original smoothstep eased *in* on the
  // theory that a flat first stretch reads as a gentle opening. Playtest said the
  // opposite: because hazardCount and maxTier are rounded, a flat toe means the
  // player sees literally identical content for half a minute, and "gentle" became
  // "nothing is happening". Climbing early and flattening at the top puts the
  // variety where attention is, and still takes ~67s to reach maximum.
  return 1 - Math.pow(1 - t, 1.6)
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export function paramsAt(d: number): DifficultyParams {
  return {
    scrollSpeed: lerp(EASIEST.scrollSpeed, HARDEST.scrollSpeed, d),
    hazardCount: Math.round(lerp(EASIEST.hazardCount, HARDEST.hazardCount, d)),
    pinchGap: lerp(EASIEST.pinchGap, HARDEST.pinchGap, d),
    pinchOffset: lerp(EASIEST.pinchOffset, HARDEST.pinchOffset, d),
    maxTier: Math.floor(lerp(EASIEST.maxTier, HARDEST.maxTier + 0.999, d)),
    minSlackTicks: Math.round(lerp(EASIEST.minSlackTicks, HARDEST.minSlackTicks, d)),
  }
}

/** Convenience for the sim: scroll speed is a pure function of distance. */
export function scrollSpeedAt(distancePx: number): number {
  return paramsAt(difficultyAt(distancePx)).scrollSpeed
}
