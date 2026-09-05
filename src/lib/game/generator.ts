import { CHUNK_W } from '@/constants/difficulty'
import type { Curve } from '@/constants/modes'
import { CEIL_Y, FLOOR_Y } from '@/constants/layout'
import { Rng } from '@/lib/engine/rng'
import { difficultyAt, paramsAt } from './difficulty'
import {
  ceilSpike,
  coin,
  COIN_STRIDE,
  floorSpike,
  pinchAt,
  spikeRun,
  type Coin,
  type Rect,
} from './level'

export interface Chunk {
  index: number
  worldX: number
  hazards: Rect[]
  coins: Coin[]
  tier: number
  patternId: string
}

/** Keeps hazards off the chunk seams, so two chunks can never fuse into a wall. */
const MARGIN = 96
const CORRIDOR_MID = (CEIL_Y + FLOOR_Y) / 2

interface Pattern {
  id: string
  tier: number
  /**
   * A breather is exempt from density filler. Without this, `hazardCount` turns a
   * ceiling into a quota and the one pattern whose entire job is to be empty stops
   * being empty — which is how a game loses its rhythm and reads as relentless
   * rather than hard.
   */
  breather?: true
  build(x0: number, rng: Rng, p: ReturnType<typeof paramsAt>): Rect[]
}

/**
 * The pattern vocabulary. Every entry is built from the same primitives the
 * hand-authored T01 level used — that level existed partly to prove these read
 * well before a generator started emitting them by the thousand.
 */
const PATTERNS: Pattern[] = [
  // Tier 0 — the breather and the single obstacle.
  { id: 'empty', tier: 0, breather: true, build: () => [] },
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

/** Keeps a coin from sitting flush against a spike edge, where it is uncatchable. */
const COIN_CLEARANCE = 14

/**
 * Minimum x-distance between a filler spike and anything already placed. 130px is
 * ~0.28s at Gauntlet's top speed — enough to see it and act. Below that, filler
 * stops being density and starts being an ambush attached to someone else's gate.
 */
const FILLER_SPACING = 130

/**
 * Tops a chunk up to `hazardCount` PLACEMENTS, where a pinch counts as one because
 * that is what the player reads it as.
 *
 * Until now `hazardCount` was interpolated, asserted in two test files, and read by
 * nothing — density was whatever the chosen pattern happened to emit. This is what
 * makes the knob real. Filler is only ever a lone spike on one surface, never a new
 * gate: it raises pressure without inventing geometry the pattern vocabulary has
 * not already been proved to read well.
 */
function addFiller(
  hazards: Rect[],
  worldX: number,
  want: number,
  rng: Rng,
): Rect[] {
  const columns = new Set(hazards.map((h) => h.x))
  const need = want - columns.size
  if (need <= 0) return hazards

  const out = [...hazards]
  const taken = [...columns]
  const usable = CHUNK_W - MARGIN * 2

  for (let i = 0; i < need; i++) {
    // Sample a few candidate positions and keep the first that clears everything
    // already placed. Bounded tries, so a crowded chunk simply stays as it is
    // rather than looping — a slightly sparse chunk is a non-event, a hang is not.
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = worldX + MARGIN + rng.range(0, usable)
      if (taken.some((t) => Math.abs(t - x) < FILLER_SPACING)) continue
      out.push(rng.bool() ? floorSpike(x) : ceilSpike(x))
      taken.push(x)
      break
    }
  }
  return out
}

/**
 * Coins are DERIVED FROM THE HAZARDS rather than authored per pattern. Every
 * pattern therefore gets sensible coins for free, including any added later, and
 * the placement rule states the design in one line: a coin marks the line you
 * already have to fly. In a pinch that is the gap; past a lone spike it is the far
 * surface; in an empty chunk it is a gentle arc that rewards leaving the floor.
 *
 * That is why coins cannot make a chunk unfair — they are never anywhere the player
 * was not already going to be, and touching one does nothing but score.
 */
function placeCoins(index: number, hazards: readonly Rect[], worldX: number, rng: Rng): Coin[] {
  const base = index * COIN_STRIDE
  const out: Coin[] = []

  if (hazards.length === 0) {
    // An empty chunk is a breather; the coins are the reason to spend it flying
    // rather than sitting on the floor.
    const mid = CORRIDOR_MID + rng.range(-70, 70)
    const step = 46
    const x = worldX + CHUNK_W / 2 - step
    for (let i = 0; i < 3; i++) out.push(coin(base + i, x + i * step, mid))
    return out
  }

  // Group by x: two rects sharing an x are a pinch, one is a lone spike.
  const columns = new Map<number, Rect[]>()
  for (const h of hazards) {
    const at = columns.get(h.x)
    if (at) at.push(h)
    else columns.set(h.x, [h])
  }

  let slot = 0
  for (const [x, rects] of [...columns].sort((a, b) => a[0] - b[0])) {
    const cx = x + (rects[0]?.w ?? 0) / 2
    if (rects.length >= 2) {
      const top = Math.max(...rects.map((r) => (r.y <= CEIL_Y + 1 ? r.y + r.h : CEIL_Y)))
      const bottom = Math.min(...rects.map((r) => (r.y > CEIL_Y + 1 ? r.y : FLOOR_Y)))
      if (bottom - top >= COIN_CLEARANCE * 2) out.push(coin(base + slot++, cx, (top + bottom) / 2))
    } else {
      const r = rects[0]!
      const fromCeiling = r.y <= CEIL_Y + 1
      // Sit against the surface the spike does NOT occupy, inset far enough that
      // the coin is not tucked into the corner the player cannot reach.
      const y = fromCeiling ? FLOOR_Y - COIN_CLEARANCE - 8 : CEIL_Y + COIN_CLEARANCE + 8
      out.push(coin(base + slot++, cx, y))
    }
  }
  return out
}

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

function tierAt(index: number, curve: Curve): number {
  return paramsAt(difficultyAt(index * CHUNK_W, curve), curve).maxTier
}

/**
 * Bags stop repeats INSIDE a bag but say nothing across a bag boundary, and the
 * pool also changes size as tiers unlock — both produce adjacent duplicates. So
 * resolve a short window in order, nudging any pick that matches its predecessor.
 * Bounded lookback keeps this a pure function of (index, seed).
 */
function pickPattern(index: number, seed: number, maxTier: number, curve: Curve): Pattern {
  const LOOKBACK = 4
  const from = Math.max(2, index - LOOKBACK)
  let prevId = ''
  let chosen = rawPick(index, seed, maxTier)

  for (let i = from; i <= index; i++) {
    const tier = i === index ? maxTier : tierAt(i, curve)
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
export function generateChunk(index: number, seed: number, curve: Curve): Chunk {
  const worldX = index * CHUNK_W

  // The first two chunks are always empty. A run that kills you before you have
  // discovered what the button does is not difficulty, it is a bad first second.
  if (index < 2) {
    return { index, worldX, hazards: [], coins: [], tier: 0, patternId: 'intro' }
  }

  const d = difficultyAt(worldX, curve)
  const p = paramsAt(d, curve)
  const pattern = pickPattern(index, seed, p.maxTier, curve)
  const rng = new Rng(seed).fork(index)

  const usable = CHUNK_W - MARGIN * 2
  const x0 = worldX + MARGIN + rng.range(0, Math.max(0, usable * 0.25))
  const built = pattern.build(x0, rng, p)
  const hazards = pattern.breather ? built : addFiller(built, worldX, p.hazardCount, rng)

  // DROPS anything that overshot the chunk's usable span, rather than letting it
  // bleed into the next chunk's lead-in. This said "clamp" for a while and did not:
  // the distinction matters because dropping half a pinch turns a gate into a lone
  // spike, which is a silently *easier* chunk, not a broken-looking one. Every
  // pattern currently fits (the widest ends at x0+220+22); a wider one must be
  // measured against this limit before it is added.
  const limit = worldX + CHUNK_W - 24
  const kept = hazards.filter((h) => h.x + h.w <= limit)
  return {
    index,
    worldX,
    hazards: kept,
    // Derived from the hazards that SURVIVED the limit, not the ones the pattern
    // asked for — a coin marking the gap of a dropped pinch would hang in open air.
    coins: placeCoins(index, kept, worldX, rng),
    tier: pattern.tier,
    patternId: pattern.id,
  }
}
