// Parallax backdrop, drawn as chunky pixel blocks rather than curves — that
// blockiness is what reads as "8-bit outdoor platformer" more than any single
// colour does.
//
// Everything here is laid out from a DETERMINISTIC hash of the tile index, never
// Math.random. Random placement would reshuffle the hills every frame.

import { PALETTE } from '@/constants/palette'
import { VIEW_W } from '@/constants/physics'
import { PARALLAX_FAR, PARALLAX_MID, PARALLAX_NEAR } from '@/constants/feel'

/** Stable per-tile pseudo-random in [0,1). Same tile, same value, forever. */
function hash01(n: number, salt: number): number {
  let h = Math.imul(n ^ salt, 0x27d4eb2d)
  h ^= h >>> 15
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  return (h >>> 0) / 0x100000000
}

const PX = 4 // block size; everything snaps to this so edges stay crisp

function block(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillRect(Math.round(x / PX) * PX, Math.round(y / PX) * PX, Math.ceil(w / PX) * PX, Math.ceil(h / PX) * PX)
}

/** Stepped mound. Rows of shrinking rectangles — no curves, no anti-aliasing. */
function hill(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  halfW: number,
  height: number,
  light: string,
  dark: string,
): void {
  const steps = Math.max(3, Math.round(height / 12))
  for (let i = 0; i < steps; i++) {
    const t = i / steps
    const w = halfW * (1 - t)
    const y = baseY - (height * (i + 1)) / steps
    const h = height / steps + 1
    ctx.fillStyle = light
    block(ctx, cx - w, y, w * 2, h)
    // A darker right shoulder gives the mound a light direction.
    ctx.fillStyle = dark
    block(ctx, cx + w - 8, y, 8, h)
  }
}

/** Cloud built from overlapping rectangles — the classic blocky silhouette. */
function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const lumps: [number, number, number, number][] = [
    [0, 8, 40, 16],
    [10, 0, 24, 16],
    [26, 4, 22, 14],
    [-8, 12, 20, 12],
  ]
  ctx.fillStyle = PALETTE.cloud
  for (const [dx, dy, w, h] of lumps) block(ctx, x + dx * s, y + dy * s, w * s, h * s)
  ctx.fillStyle = PALETTE.cloudShade
  for (const [dx, dy, w, h] of lumps) block(ctx, x + dx * s, y + (dy + h) * s - 4 * s, w * s, 4 * s)
}

/** Two-tier bush, same silhouette language as the hills but squatter. */
function bush(ctx: CanvasRenderingContext2D, x: number, baseY: number, s: number): void {
  ctx.fillStyle = PALETTE.bush
  block(ctx, x, baseY - 14 * s, 46 * s, 14 * s)
  block(ctx, x + 8 * s, baseY - 24 * s, 14 * s, 12 * s)
  block(ctx, x + 26 * s, baseY - 21 * s, 12 * s, 10 * s)
  ctx.fillStyle = PALETTE.bushDark
  block(ctx, x, baseY - 5 * s, 46 * s, 5 * s)
}

/**
 * Draws sky plus three parallax layers. `camX` is world scroll in px; each layer
 * moves at a fraction of it, which is what sells depth on a flat 2D canvas.
 * `topY`/`botY` bound the visible band so the backdrop never paints over the slabs.
 */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  camX: number,
  topY: number,
  botY: number,
): void {
  // Sky covers everything down to the floor, including the strip above the ceiling
  // slab, so no gap can show the bare canvas.
  const sky = ctx.createLinearGradient(0, 0, 0, botY)
  sky.addColorStop(0, PALETTE.skyTop)
  sky.addColorStop(1, PALETTE.skyBottom)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, VIEW_W, botY)

  // Parallax is clipped to the CORRIDOR only. Drawn to the full height instead,
  // clouds get half-covered by the ceiling slab and read as a rendering glitch
  // rather than as sky.
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, topY, VIEW_W, botY - topY)
  ctx.clip()

  // Layer 1 — distant hills
  const farSpacing = 300
  const farOff = (camX * PARALLAX_FAR) % farSpacing
  for (let i = -1; i <= Math.ceil(VIEW_W / farSpacing) + 1; i++) {
    const idx = Math.floor((camX * PARALLAX_FAR) / farSpacing) + i
    const x = i * farSpacing - farOff
    const h = 70 + hash01(idx, 11) * 60
    hill(ctx, x + farSpacing / 2, botY, 110 + hash01(idx, 12) * 50, h, PALETTE.hillFar, PALETTE.hillFarDark)
  }

  // Layer 2 — clouds. They drift between the hill bands so the sky is not empty.
  const cloudSpacing = 340
  const cloudOff = (camX * PARALLAX_MID) % cloudSpacing
  for (let i = -1; i <= Math.ceil(VIEW_W / cloudSpacing) + 1; i++) {
    const idx = Math.floor((camX * PARALLAX_MID) / cloudSpacing) + i
    const x = i * cloudSpacing - cloudOff
    const y = topY + 20 + hash01(idx, 21) * Math.max(20, (botY - topY) * 0.35)
    cloud(ctx, x, y, 0.7 + hash01(idx, 22) * 0.6)
  }

  // Layer 3 — near hills and bushes, the fastest and most saturated
  const nearSpacing = 210
  const nearOff = (camX * PARALLAX_NEAR) % nearSpacing
  for (let i = -1; i <= Math.ceil(VIEW_W / nearSpacing) + 1; i++) {
    const idx = Math.floor((camX * PARALLAX_NEAR) / nearSpacing) + i
    const x = i * nearSpacing - nearOff
    if (hash01(idx, 31) > 0.45) {
      const h = 46 + hash01(idx, 32) * 40
      hill(ctx, x + nearSpacing / 2, botY, 80 + hash01(idx, 33) * 30, h, PALETTE.hillNear, PALETTE.hillNearDark)
    } else {
      bush(ctx, x + 40, botY, 0.8 + hash01(idx, 34) * 0.5)
    }
  }

  // Atmospheric haze. Not decoration — it is what stops the green hills competing
  // with foreground hazards. A thin floor-level hazard was almost invisible against
  // bare hills, and a hazard you cannot see is the unfair kind of hard.
  const haze = ctx.createLinearGradient(0, botY - (botY - topY) * 0.45, 0, botY)
  haze.addColorStop(0, 'rgba(140,184,255,0)')
  haze.addColorStop(1, 'rgba(160,196,255,0.42)')
  ctx.fillStyle = haze
  ctx.fillRect(0, topY, VIEW_W, botY - topY)

  ctx.restore()
}
