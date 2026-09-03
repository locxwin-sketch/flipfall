import { CEIL_Y, FLOOR_Y, SPIKE_H, SPIKE_W } from '@/constants/layout'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// --- pattern primitives ------------------------------------------------------
// The vocabulary generator.ts assembles into an endless world. These were proven
// first in a hand-authored 30s level (T01) so their readability was established
// before anything started emitting them by the thousand. That level is gone; the
// primitives it validated are what remain.

/** Spike growing up from the floor. */
export function floorSpike(x: number, w = SPIKE_W, h = SPIKE_H): Rect {
  return { x, y: FLOOR_Y - h, w, h }
}

/** Spike hanging down from the ceiling. */
export function ceilSpike(x: number, w = SPIKE_W, h = SPIKE_H): Rect {
  return { x, y: CEIL_Y, w, h }
}

/** A run of evenly spaced spikes on one surface. */
export function spikeRun(
  x: number,
  count: number,
  spacing: number,
  surface: 'floor' | 'ceil',
): Rect[] {
  const make = surface === 'floor' ? floorSpike : ceilSpike
  return Array.from({ length: count }, (_, i) => make(x + i * spacing))
}

/**
 * Facing spikes with a gap between them — the primitive that forces a mid-air
 * flip, because neither surface is landable here.
 */
export function pinch(x: number, gapH: number, w = SPIKE_W): Rect[] {
  return pinchAt(x, gapH, (CEIL_Y + FLOOR_Y) / 2, w)
}

/**
 * Pinch whose gap is centred on an arbitrary y. An off-centre gap is what forces
 * real altitude control — a centred one can be cleared by drifting through the
 * middle, but a high or low gap has to be arrived at deliberately.
 */
export function pinchAt(x: number, gapH: number, gapCenterY: number, w = SPIKE_W): Rect[] {
  const half = gapH / 2
  const top = Math.max(CEIL_Y, gapCenterY - half)
  const bottom = Math.min(FLOOR_Y, gapCenterY + half)
  const out: Rect[] = []
  if (top > CEIL_Y) out.push({ x, y: CEIL_Y, w, h: top - CEIL_Y })
  if (bottom < FLOOR_Y) out.push({ x, y: bottom, w, h: FLOOR_Y - bottom })
  return out
}
