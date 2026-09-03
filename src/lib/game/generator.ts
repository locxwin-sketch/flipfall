import { CHUNK_W } from '@/constants/difficulty'
import { CEIL_Y, FLOOR_Y } from '@/constants/layout'
import { Rng } from '@/lib/engine/rng'
import { difficultyAt, paramsAt } from './difficulty'
import { ceilSpike, floorSpike, pinchAt, spikeRun, type Rect } from './level'

export interface Chunk {
  index: number
  worldX: number
  hazards: Rect[]
  tier: number
  patternId: string
}

/** Keeps hazards off the chunk seams, so two chunks can never fuse into a wall. */
const MARGIN = 96
const CORRIDOR_MID = (CEIL_Y + FLOOR_Y) / 2

interface Pattern {
  id: string
  tier: number
  build(x0: number, rng: Rng, p: ReturnType<typeof paramsAt>): Rect[]
}

/**
 * The pattern vocabulary. Every entry is built from the same primitives the
 * hand-authored T01 level used — that level existed partly to prove these read
 * well before a generator started emitting them by the thousand.
 */
const PATTERNS: Pattern[] = [
  // Tier 0 — the breather and the single obstacle.
  { id: 'empty', tier: 0, build: () => [] },
  { id: 'floor-single', tier: 0, build: (x0) => [floorSpike(x0)] },
  { id: 'ceil-single', tier: 0, build: (x0) => [ceilSpike(x0)] },

  // Tier 1 — two obstacles, still one surface at a time.
  {
    id: 'floor-pair',
    tier: 1,
    build: (x0, rng) => spikeRun(x0, 2, rng.int(150, 220), 'floor'),
  },
  {
    id: 'ceil-pair',
    tier: 1,
    build: (x0, rng) => spikeRun(x0, 2, rng.int(150, 220), 'ceil'),
  },
  {
    id: 'alternating',
    tier: 1,
    build: (x0, rng) => {
      const gap = rng.int(160, 210)
      return [floorSpike(x0), ceilSpike(x0 + gap)]
    },
  },

  // Tier 2 — pinches. Neither surface is landable at the gate, so a mid-air flip
  // is required rather than optional.
  {
    id: 'pinch-centre',
    tier: 2,
    build: (x0, _rng, p) => pinchAt(x0, p.pinchGap, CORRIDOR_MID),
  },
  {
    id: 'pinch-then-spike',
    tier: 2,
    build: (x0, rng, p) => [
      ...pinchAt(x0, p.pinchGap, CORRIDOR_MID),
      ...(rng.bool() ? [floorSpike(x0 + 210)] : [ceilSpike(x0 + 210)]),
    ],
  },
  {
    id: 'spike-then-pinch',
    tier: 2,
    build: (x0, rng, p) => [
      ...(rng.bool() ? [floorSpike(x0)] : [ceilSpike(x0)]),
      ...pinchAt(x0 + 210, p.pinchGap, CORRIDOR_MID),
    ],
  },

  // Tier 3 — off-centre gaps and sealed surfaces. Altitude has to be deliberate.
  {
    id: 'pinch-offset',
    tier: 3,
    build: (x0, rng, p) =>
      pinchAt(x0, p.pinchGap, CORRIDOR_MID + rng.range(-p.pinchOffset, p.pinchOffset)),
  },
  {
    id: 'pinch-ladder',
    tier: 3,
    build: (x0, rng, p) => {
      // Two gates at different heights: the player must change altitude between
      // them, which is what the double-flip hover is for.
      const dir = rng.bool() ? 1 : -1
      return [
        ...pinchAt(x0, p.pinchGap + 20, CORRIDOR_MID - dir * p.pinchOffset * 0.7),
        ...pinchAt(x0 + 240, p.pinchGap + 20, CORRIDOR_MID + dir * p.pinchOffset * 0.7),
      ]
    },
  },
  {
    id: 'sealed-surface',
    tier: 3,
    build: (x0, rng) => {
      // Revokes one surface for a stretch: landing is the player's reset button,
      // and taking it away is the cheapest way to raise pressure without
      // tightening any single gap.
      const surface = rng.bool() ? 'floor' : 'ceil'
      return spikeRun(x0, 3, 84, surface)
    },
  },
]

const POOL_BY_TIER: Pattern[][] = [0, 1, 2, 3].map((t) => PATTERNS.filter((p) => p.tier <= t))

/**
 * Deterministic shuffle-bag pick, before adjacency fixing. Chunks are grouped into
 * bags of the pool size and each bag is permuted from its own seed, so no pattern
 * repeats inside a bag. A plain random pick produces visible runs of the same
 * shape, which reads as cheap far faster than the individual patterns do.
 */
function rawPick(index: number, seed: number, maxTier: number): Pattern {
  const pool = POOL_BY_TIER[Math.min(maxTier, POOL_BY_TIER.length - 1)]!
  const bag = Math.floor(index / pool.length)
  const slot = ((index % pool.length) + pool.length) % pool.length

  const order = pool.map((_, i) => i)
  const rng = new Rng(seed).fork(bag * 7919 + 13)
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    ;[order[i], order[j]] = [order[j]!, order[i]!]
  }
  return pool[order[slot]!]!
}

function tierAt(index: number): number {
  return paramsAt(difficultyAt(index * CHUNK_W)).maxTier
}

/**
 * Bags stop repeats INSIDE a bag but say nothing across a bag boundary, and the
 * pool also changes size as tiers unlock — both produce adjacent duplicates. So
 * resolve a short window in order, nudging any pick that matches its predecessor.
 * Bounded lookback keeps this a pure function of (index, seed).
 */
function pickPattern(index: number, seed: number, maxTier: number): Pattern {
  const LOOKBACK = 4
  const from = Math.max(2, index - LOOKBACK)
  let prevId = ''
  let chosen = rawPick(index, seed, maxTier)

  for (let i = from; i <= index; i++) {
    const tier = i === index ? maxTier : tierAt(i)
    const pool = POOL_BY_TIER[Math.min(tier, POOL_BY_TIER.length - 1)]!
    let p = rawPick(i, seed, tier)
    if (p.id === prevId) {
      const at = pool.findIndex((q) => q.id === p.id)
      p = pool[(at + 1) % pool.length]!
    }
    prevId = p.id
    chosen = p
  }
  return chosen
}

/**
 * PURE. Chunk N is identical whenever it is generated, from the seed alone —
 * no dependence on when it was asked for, or on its neighbours having been
 * generated first. That is what makes an endless world replayable.
 */
export function generateChunk(index: number, seed: number): Chunk {
  const worldX = index * CHUNK_W

  // The first two chunks are always empty. A run that kills you before you have
  // discovered what the button does is not difficulty, it is a bad first second.
  if (index < 2) {
    return { index, worldX, hazards: [], tier: 0, patternId: 'intro' }
  }

  const d = difficultyAt(worldX)
  const p = paramsAt(d)
  const pattern = pickPattern(index, seed, p.maxTier)
  const rng = new Rng(seed).fork(index)

  const usable = CHUNK_W - MARGIN * 2
  const x0 = worldX + MARGIN + rng.range(0, Math.max(0, usable * 0.25))
  const hazards = pattern.build(x0, rng, p)

  // Clamp anything that overshot the chunk's usable span rather than silently
  // letting it bleed into the next chunk's lead-in.
  const limit = worldX + CHUNK_W - 24
  return {
    index,
    worldX,
    hazards: hazards.filter((h) => h.x + h.w <= limit),
    tier: pattern.tier,
    patternId: pattern.id,
  }
}
