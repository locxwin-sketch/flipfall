// Debris on the lens — slime, or confetti. Render-only, like everything under fx/,
// so Math.random is fine here and cannot reach the simulation.
//
// This is the one effect drawn in SCREEN space rather than world space. That is the
// whole point: every other effect happens *in* the world and scrolls away with it,
// but a splat on the camera is between the player and the world, so it reads as
// having been thrown at the viewer's face rather than at the scenery. It therefore
// must be drawn outside the camera transform — see renderer.ts.
//
// Blobs do not scroll, do not shake with the camera, and drip straight down
// regardless of which way gravity is currently pointing, because the lens is not
// part of the world the mechanic applies to.

import type { LensShape } from '@/constants/death'
import { motionScale } from './shake'

const MAX = 36

interface Blob {
  x: number
  y: number
  r: number
  /** Downward crawl in px/s. Big blobs run faster, like real drips. */
  drip: number
  /** Length of the tail already run out below the blob. */
  tail: number
  life: number
  maxLife: number
  color: string
  /** Stable per-blob seed. The ragged edge must be recomputed identically every
   *  frame or the blob boils; hashing this instead of storing a cell mask keeps
   *  the pool allocation-free. */
  seed: number
  shape: LensShape
  /** Two satellites, so no piece of debris is a plain circle. */
  s1x: number
  s1y: number
  s1r: number
  s2x: number
  s2y: number
  s2r: number
}

const pool: Blob[] = Array.from({ length: MAX }, () => ({
  x: 0,
  y: 0,
  r: 0,
  drip: 0,
  tail: 0,
  life: 0,
  maxLife: 1,
  color: '#8ee62b',
  shape: 'blob' as LensShape,
  seed: 0,
  s1x: 0,
  s1y: 0,
  s1r: 0,
  s2x: 0,
  s2y: 0,
  s2r: 0,
}))
let cursor = 0

export function clearSplatter(): void {
  for (const b of pool) b.life = 0
}

/**
 * Throws debris at the camera from a screen-space origin.
 *
 * Blobs land further out and larger the longer they "travelled", which is what
 * sells depth: a droplet that passed close to the lens covers more of it. Origin
 * is where the player died on screen, so the spray reads as coming from the pig
 * rather than from the middle of the frame.
 */
export interface SplatterOpts {
  count: number
  spread: number
  lifeMs: number
  maxRadius: number
  colors: readonly string[]
  shape: LensShape
  /** Wet debris runs down the lens; dry debris just sits there and fades. */
  drips: boolean
}

export function splatter(originX: number, originY: number, opts: SplatterOpts): void {
  const { count, spread, lifeMs, maxRadius, colors, shape, drips } = opts
  // Under reduced motion this is a large, high-contrast, screen-covering effect
  // firing on every death. Thin it hard rather than dropping it, so the death is
  // still legible as a death.
  const scale = motionScale() ? 1 : 0.25
  const n = Math.max(1, Math.round(count * scale))

  for (let i = 0; i < n; i++) {
    const b = pool[cursor]!
    cursor = (cursor + 1) % MAX

    const a = (Math.PI * 2 * i) / n + Math.random() * 0.9
    // sqrt keeps the distribution even across the disc instead of clumping at the
    // centre, so the frame gets covered rather than blotched in one place.
    const d = Math.sqrt(Math.random()) * spread
    // Travelled-further = closer to the lens = bigger.
    const near = 0.3 + (d / spread) * 0.7

    b.x = originX + Math.cos(a) * d
    b.y = originY + Math.sin(a) * d * 0.75 // squashed: the frame is wider than tall
    b.r = maxRadius * near * (0.35 + Math.random() * 0.65) * scale
    b.shape = shape
    b.drip = drips ? (6 + Math.random() * 26) * b.r * 0.06 : 0
    b.tail = 0
    b.life = (lifeMs / 1000) * (0.7 + Math.random() * 0.6)
    b.maxLife = b.life
    b.color = colors[(Math.random() * colors.length) | 0]!
    b.seed = (Math.random() * 0xffffffff) >>> 0

    const a1 = Math.random() * Math.PI * 2
    const a2 = a1 + 1.8 + Math.random()
    b.s1x = Math.cos(a1) * b.r * 1.1
    b.s1y = Math.sin(a1) * b.r * 1.1
    b.s1r = b.r * (0.25 + Math.random() * 0.3)
    b.s2x = Math.cos(a2) * b.r * 1.4
    b.s2y = Math.sin(a2) * b.r * 1.4
    b.s2r = b.r * (0.18 + Math.random() * 0.25)
  }
}

export function updateSplatter(dt: number): void {
  for (const b of pool) {
    if (b.life <= 0) continue
    b.life -= dt
    if (b.life <= 0) continue
    b.y += b.drip * dt
    b.tail += b.drip * dt
  }
}

// --- pixel-grid rasterisation ------------------------------------------------
// Everything else in this game is blocky: stepped hills, 32x16 bricks, sprites on
// a 2px grid. A smooth anti-aliased arc in that frame does not read as a splat, it
// reads as a balloon. So blobs are rasterised onto a grid like the rest of the
// art, drawn one row-span at a time — ~11 fillRects per blob rather than one per
// cell.

/** Screen px per debris cell. Matches the chunk size the backdrop art reads at. */
const CELL = 5

const snap = (v: number): number => Math.round(v / CELL) * CELL

/** Cheap stable hash. Same blob + same row = same jitter, so the edge never boils. */
function hash(seed: number, row: number): number {
  let h = (Math.imul(seed ^ row, 374761393) + 1274126177) >>> 0
  h = (h ^ (h >>> 13)) >>> 0
  h = Math.imul(h, 1274126177) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000
}

/** One pixel-art disc: row spans with a jittered edge, so it is not a clean circle. */
function blot(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number): void {
  if (r < CELL * 0.4) return
  const rows = Math.ceil(r / CELL)
  const gx = snap(cx)
  const gy = snap(cy)
  for (let i = -rows; i <= rows; i++) {
    const dy = i * CELL
    const inner = r * r - dy * dy
    if (inner <= 0) continue
    // 0.82..1.12 of the true half-width: some rows overhang, some bite in, which is
    // what makes it look thrown rather than drawn.
    const half = Math.sqrt(inner) * (0.82 + hash(seed, i) * 0.3)
    const w = Math.max(CELL, Math.round(half / CELL) * CELL * 2)
    ctx.fillRect(gx - w / 2, gy + dy, w, CELL)
  }
}

/** One confetti flake or coin edge-on: a chunky rect, wider than tall. */
function chip(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, seed: number): void {
  if (r < CELL * 0.4) return
  const w = Math.max(CELL, Math.round((r * 1.7) / CELL) * CELL)
  const h = Math.max(CELL, Math.round((r * (0.5 + hash(seed, 3) * 0.5)) / CELL) * CELL)
  const gx = snap(cx) - w / 2
  const gy = snap(cy) - h / 2
  // Built additively as two stacked rows of unequal width. Never punch the shape
  // out with clearRect: this draws over the world, and clearing would erase the
  // scenery behind the flake instead of the flake's own corner.
  if (h > CELL) {
    const top = Math.max(CELL, w - CELL * (hash(seed, 7) > 0.5 ? 1 : 0))
    ctx.fillRect(gx, gy, top, CELL)
    ctx.fillRect(gx, gy + CELL, w, h - CELL)
  } else {
    ctx.fillRect(gx, gy, w, h)
  }
}

/**
 * Screen coordinates — call OUTSIDE the camera transform, after the world and the
 * impact flash, before the HUD. The HUD stays on top so the score is never hidden
 * behind a blob.
 */
export function drawSplatter(ctx: CanvasRenderingContext2D): void {
  for (const b of pool) {
    if (b.life <= 0) continue
    const t = b.life / b.maxLife
    // Holds near-opaque, then goes late. A splat that fades linearly looks like it
    // is being wiped off in real time, a much weaker read than it drying.
    ctx.globalAlpha = Math.min(1, t * 1.9) * 0.92
    ctx.fillStyle = b.color

    // The drip tail, drawn first so the head sits on top of it.
    if (b.tail > CELL) {
      const w = Math.max(CELL, Math.round((b.r * 0.5) / CELL) * CELL)
      const h = Math.round(b.tail / CELL) * CELL
      ctx.fillRect(snap(b.x - w / 2), snap(b.y) - h, w, h)
    }

    const piece = b.shape === 'chip' ? chip : blot
    piece(ctx, b.x, b.y, b.r, b.seed)
    piece(ctx, b.x + b.s1x, b.y + b.s1y, b.s1r, b.seed ^ 0x9e3779b9)
    piece(ctx, b.x + b.s2x, b.y + b.s2y, b.s2r, b.seed ^ 0x85ebca6b)
  }
  ctx.globalAlpha = 1
}
