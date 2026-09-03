import { CEIL_Y, FLOOR_Y, SPIKE_H, SPIKE_W } from '@/constants/layout'
import type { Corridor } from './player'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Level {
  lengthPx: number
  corridor: Corridor
  hazards: Rect[]
}

// --- pattern primitives ------------------------------------------------------
// This is the vocabulary T05's generator assembles. The T01 level is hand-authored
// from these same calls on purpose, so the kill gate exercises what ships.

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
  const total = FLOOR_Y - CEIL_Y
  const each = (total - gapH) / 2
  return [
    { x, y: CEIL_Y, w, h: each },
    { x, y: FLOOR_Y - each, w, h: each },
  ]
}

// --- the T01 level -----------------------------------------------------------
// ~30 seconds at SCROLL_START (260 px/s) = ~7800px. Structure follows the plan's
// difficulty table: an easy floor-only opening, then ceiling hazards, then pinches
// that cannot be solved without the mid-air flip.

function buildT01Level(): Level {
  const hazards: Rect[] = [
    // 0-15s: floor only, sparse. Tap-when-you-see-it survives this whole stretch.
    floorSpike(900),
    floorSpike(1500),
    floorSpike(2100),
    ...spikeRun(2800, 2, 260, 'floor'),
    floorSpike(3500),

    // 15-22s: the ceiling turns hostile, so flipping up is no longer free.
    ceilSpike(4100),
    floorSpike(4500),
    ceilSpike(4900),
    ...spikeRun(5300, 2, 240, 'floor'),
    ceilSpike(5900),

    // 22-30s: pinches. Neither surface is landable — this is where the mid-air
    // flip, and then the double-flip hover, become mandatory.
    //
    // Gaps and spacing are set by the slack floor in level.test.ts, NOT by taste.
    // The first pass here used 150/130/120px gaps at 400px spacing and produced a
    // level whose tightest required flip had 17ms of tolerance — below the human
    // floor, and below one frame on a 60Hz display. Clearable, but not fair.
    ...pinch(6300, 210),
    floorSpike(6900),
    ...pinch(7300, 200),
  ]

  return {
    lengthPx: 7800,
    corridor: { floorY: FLOOR_Y, ceilY: CEIL_Y },
    hazards,
  }
}

export const T01_LEVEL: Level = buildT01Level()
