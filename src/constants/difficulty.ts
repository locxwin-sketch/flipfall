// The difficulty curve, as data rather than a formula buried in code.
//
// Distance at which the ramp starts and ends. 2600px at the opening scroll speed
// is ~10 seconds, which is the "easy opening" the design calls for — long enough
// to learn that tapping flips gravity, short enough that the game starts.
export const RAMP_START_PX = 2600
export const RAMP_END_PX = 26_000

/** Chunk width. Half a screen, so ~2 chunks are on screen at once. */
export const CHUNK_W = 480

/** Generate this many chunks beyond the camera. */
export const GEN_AHEAD_CHUNKS = 4
/** Keep this many behind before recycling. */
export const KEEP_BEHIND_CHUNKS = 2

export interface DifficultyParams {
  /** px/s world scroll */
  scrollSpeed: number
  /** how many hazard placements this chunk may contain */
  hazardCount: number
  /** vertical gap left by a pinch, px */
  pinchGap: number
  /** how far a pinch gap may sit from the corridor centre, px */
  pinchOffset: number
  /** highest pattern tier permitted (0 = gentlest) */
  maxTier: number
  /** required timing tolerance on the tightest flip, in ticks */
  minSlackTicks: number
}

export const EASIEST: DifficultyParams = {
  scrollSpeed: 260,
  hazardCount: 1,
  pinchGap: 260,
  pinchOffset: 0,
  maxTier: 0,
  minSlackTicks: 14,
}

export const HARDEST: DifficultyParams = {
  scrollSpeed: 470,
  hazardCount: 4,
  pinchGap: 170,
  pinchOffset: 90,
  maxTier: 3,
  // The plan proposed 3 ticks (25ms) at maximum difficulty. Measurement rejected
  // that: 25ms is below trained human timing precision and below two frames on a
  // 60Hz display. 6 ticks (50ms) is the floor this game actually ships with, and
  // level.test.ts enforces it on generated output.
  minSlackTicks: 6,
}
