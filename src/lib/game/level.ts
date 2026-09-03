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

// --- the T01 level -----------------------------------------------------------
// ~25 seconds at SCROLL_START (260 px/s) = 6400px. Structure follows the plan's
// difficulty table: an easy floor-only opening, then ceiling hazards, then pinches
// that cannot be solved without the mid-air flip.
//
// The easy opening reaches the first ceiling spike at 10.4s, down from 15.8s — a
// third shorter, per playtest. Everything after it shifted back by the same 1400px,
// so the hard section's internal spacing (which the fairness floor depends on) is
// unchanged.

function buildT01Level(): Level {
  const hazards: Rect[] = [
    // 0-10s: floor only, sparse. Tap-when-you-see-it survives this whole stretch.
    // Shortened from ~16s by dropping two spikes rather than compressing spacing —
    // the goal is reaching the interesting part sooner, not a denser opening.
    floorSpike(900), // 3.5s
    floorSpike(1500), // 5.8s
    floorSpike(2100), // 8.1s

    // 10-17s: the ceiling turns hostile, so flipping up is no longer free.
    ceilSpike(2700), // 10.4s — the difficulty step
    floorSpike(3100),
    ceilSpike(3500),
    ...spikeRun(3900, 2, 240, 'floor'),
    ceilSpike(4500),

    // 17-25s: pinches. Neither surface is landable — this is where the mid-air
    // flip, and then the double-flip hover, become mandatory.
    //
    // Gaps and spacing are set by the slack floor in level.test.ts, NOT by taste.
    // The first pass here used 150/130/120px gaps at 400px spacing and produced a
    // level whose tightest required flip had 17ms of tolerance — below the human
    // floor, and below one frame on a 60Hz display. Clearable, but not fair.
    ...pinch(4900, 210),
    floorSpike(5500),
    ...pinch(5900, 200),

    // 24-30s: "Five Ledges" — five places to stand, each smaller than the last.
    // Landing zeroes vy and is the player's reset button, so this section rations
    // it: revoke the floor, then the ceiling, then narrow the gates.
    ...spikeRun(6340, 4, 92, 'floor'), // floor revoked for 300px
    ...spikeRun(6680, 3, 96, 'ceil'), // ceiling revoked; nowhere left to rest
    ...pinchAt(6980, 250, 290), // calibration gate — generous, teaches the line
    ...pinchAt(7190, 190, 290),
    ...pinchAt(7400, 130, 290), // the eye — tightest gap in the level
    ...pinchAt(7600, 170, 390), // off-centre and low: altitude must be deliberate
    floorSpike(7740), // punishes flopping onto the floor at the finish
  ]

  return {
    lengthPx: 7800,
    corridor: { floorY: FLOOR_Y, ceilY: CEIL_Y },
    hazards,
  }
}

export const T01_LEVEL: Level = buildT01Level()
