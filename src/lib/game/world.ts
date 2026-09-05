import { CHUNK_W, GEN_AHEAD_CHUNKS, KEEP_BEHIND_CHUNKS } from '@/constants/difficulty'
import { curveFor, seedSalt, type Curve, type Mode } from '@/constants/modes'
import { CEIL_Y, FLOOR_Y } from '@/constants/layout'
import { Rng } from '@/lib/engine/rng'
import { generateChunk, type Chunk } from './generator'
import type { Coin, Rect } from './level'
import type { Corridor } from './player'

/**
 * An endless world as a memoised view over generateChunk.
 *
 * The cache is a pure memo — chunk N is a function of (index, seed) alone, so
 * evicting and regenerating it produces the identical result. That property is
 * what lets a run be replayed from its seed without storing any level data.
 */
export class World {
  /** The player-facing seed — what `?seed=` sets and what a replay stores. */
  readonly seed: number
  readonly mode: Mode
  readonly curve: Curve
  readonly corridor: Corridor = { floorY: FLOOR_Y, ceilY: CEIL_Y }
  /**
   * What chunks are actually generated from. Endless salts by 0, so its seed→world
   * mapping is exactly what it was before a second mode existed and every replay
   * and screenshot taken so far still means what it said. Gauntlet salts to a
   * different stream, so the same seed is a genuinely different world rather than
   * the same layout run faster.
   */
  private readonly genSeed: number
  private readonly cache = new Map<number, Chunk>()

  constructor(seed: number, mode: Mode = 'endless') {
    this.seed = seed >>> 0
    this.mode = mode
    this.curve = curveFor(mode)
    const salt = seedSalt(mode)
    this.genSeed = salt === 0 ? this.seed : new Rng(this.seed).fork(salt).seed
  }

  chunk(index: number): Chunk {
    let c = this.cache.get(index)
    if (!c) {
      c = generateChunk(index, this.genSeed, this.curve)
      this.cache.set(index, c)
    }
    return c
  }

  /** Every hazard whose x-range intersects [x0, x1]. */
  hazardsInRange(x0: number, x1: number): Rect[] {
    const first = Math.floor(x0 / CHUNK_W) - 1
    const last = Math.floor(x1 / CHUNK_W) + 1
    const out: Rect[] = []
    for (let i = first; i <= last; i++) {
      if (i < 0) continue
      for (const h of this.chunk(i).hazards) {
        if (h.x + h.w < x0 || h.x > x1) continue
        out.push(h)
      }
    }
    return out
  }

  /** Every coin whose x-range intersects [x0, x1]. Mirrors hazardsInRange. */
  coinsInRange(x0: number, x1: number): Coin[] {
    const first = Math.floor(x0 / CHUNK_W) - 1
    const last = Math.floor(x1 / CHUNK_W) + 1
    const out: Coin[] = []
    for (let i = first; i <= last; i++) {
      if (i < 0) continue
      for (const c of this.chunk(i).coins) {
        if (c.x + c.w < x0 || c.x > x1) continue
        out.push(c)
      }
    }
    return out
  }

  /**
   * Generate ahead and drop what is far behind. Called from fixedUpdate, so the
   * work is spread across ticks rather than spiking when a chunk scrolls in — a
   * generation hitch during a flip is a death the player will rightly blame on us.
   */
  advance(distancePx: number): void {
    const here = Math.floor(distancePx / CHUNK_W)
    for (let i = here; i <= here + GEN_AHEAD_CHUNKS; i++) {
      if (i >= 0) this.chunk(i)
    }
    const cutoff = here - KEEP_BEHIND_CHUNKS
    for (const key of this.cache.keys()) {
      if (key < cutoff) this.cache.delete(key)
    }
  }

  /** Diagnostics only. */
  get cachedChunks(): number {
    return this.cache.size
  }
}
