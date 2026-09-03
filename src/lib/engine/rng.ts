/**
 * Seeded PRNG. Lives under engine/ rather than game/ because game/ bans
 * Math.random entirely — this is the sanctioned replacement.
 *
 * mulberry32: 5 lines, fast, and statistically fine for level layout. Nothing here
 * needs cryptographic quality; it needs to produce the SAME sequence for the same
 * seed on every machine, forever, which is what makes replays and the daily
 * challenge possible.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Rng {
  private next01: () => number
  readonly seed: number

  constructor(seed: number) {
    this.seed = seed >>> 0
    this.next01 = mulberry32(this.seed)
  }

  /** [0, 1) */
  next(): number {
    return this.next01()
  }

  /** [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  pick<T>(xs: readonly T[]): T {
    if (xs.length === 0) throw new Error('Rng.pick on empty array')
    return xs[this.int(0, xs.length - 1)]!
  }

  bool(chanceTrue = 0.5): boolean {
    return this.next() < chanceTrue
  }

  /**
   * An independent stream derived from this seed and a salt. Chunk N forks by its
   * index, so a chunk generates identically regardless of when — or whether — its
   * neighbours were generated. That is what lets the world be regenerated from a
   * seed alone after a restart or a checkpoint.
   */
  fork(salt: number): Rng {
    return new Rng((Math.imul(this.seed ^ (salt + 0x9e3779b9), 0x85ebca6b) ^ (salt << 16)) >>> 0)
  }
}
