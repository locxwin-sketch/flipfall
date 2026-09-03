import { PALETTE } from '@/constants/palette'
import { PLAYER_H, PLAYER_W, VIEW_H, VIEW_W } from '@/constants/physics'
import { CEIL_TOP, CEIL_Y, FLOOR_Y, PLAYER_X } from '@/constants/layout'
import { SQUASH_AMOUNT } from '@/constants/feel'
import { drawParticles } from '@/lib/fx/particles'
import { shakeOffset } from '@/lib/fx/shake'
import type { Rect } from '@/lib/game/level'
import type { World } from '@/lib/game/world'
import { score, type RunState } from '@/lib/game/sim'

export interface HudInfo {
  ticksPerSecond: number
  deaths: number
  best: number
  queueDepth: number
  dead: boolean
  started: boolean
  /** Difficulty 0..1, for the on-screen readout. */
  difficulty: number
  /** 1 immediately after a flip, decaying to 0. Drives the squash. */
  squash: number
  /** 1 on the death frame, decaying to 0. Drives the white flash. */
  flash: number
}

const MONO = '600 14px ui-monospace, SFMono-Regular, Menlo, monospace'
const BIG = '700 30px ui-monospace, SFMono-Regular, Menlo, monospace'

const BRICK_W = 32
const BRICK_H = 16

/** Brick slab in world coords, so the mortar scrolls with the world. */
function brickSlab(ctx: CanvasRenderingContext2D, camX: number, y: number, h: number): void {
  ctx.fillStyle = PALETTE.brick
  ctx.fillRect(camX, y, VIEW_W, h)

  ctx.fillStyle = PALETTE.brickMortar
  const startCol = Math.floor(camX / BRICK_W) - 1
  const endCol = Math.ceil((camX + VIEW_W) / BRICK_W) + 1
  for (let row = 0; row * BRICK_H < h; row++) {
    const by = y + row * BRICK_H
    ctx.fillRect(camX, by, VIEW_W, 2)
    // Offset alternate rows so the bond reads as brick rather than a grid.
    const offset = row % 2 === 0 ? 0 : BRICK_W / 2
    for (let c = startCol; c <= endCol; c++) {
      ctx.fillRect(c * BRICK_W + offset, by, 2, BRICK_H)
    }
  }
  ctx.fillStyle = PALETTE.brickDark
  ctx.fillRect(camX, y + h - 3, VIEW_W, 3)
}

/**
 * Hazards. The filled silhouette is EXACTLY the collision rect — the spikes are
 * highlights drawn inside it, never a slimmer shape sticking out of a fatter
 * hitbox. Drawing something narrower than it kills is how a game earns the word
 * "unfair", which this level already had to be rescued from once.
 */
function hazard(ctx: CanvasRenderingContext2D, h: Rect): void {
  const pointsDown = h.y <= CEIL_Y + 1

  ctx.fillStyle = PALETTE.hazard
  ctx.fillRect(h.x, h.y, h.w, h.h)

  ctx.fillStyle = PALETTE.hazardEdge
  ctx.fillRect(h.x, h.y, 2, h.h)
  ctx.fillRect(h.x + h.w - 2, h.y, 2, h.h)

  // Sawtooth highlight on the lethal edge, inset so it stays inside the rect.
  const teeth = Math.max(1, Math.round(h.w / 11))
  const tw = h.w / teeth
  const depth = Math.min(14, h.h * 0.45)
  ctx.fillStyle = PALETTE.hazardTip
  for (let i = 0; i < teeth; i++) {
    const x0 = h.x + i * tw
    ctx.beginPath()
    if (pointsDown) {
      ctx.moveTo(x0 + 1, h.y + h.h - depth)
      ctx.lineTo(x0 + tw - 1, h.y + h.h - depth)
      ctx.lineTo(x0 + tw / 2, h.y + h.h - 1)
    } else {
      ctx.moveTo(x0 + 1, h.y + depth)
      ctx.lineTo(x0 + tw - 1, h.y + depth)
      ctx.lineTo(x0 + tw / 2, h.y + 1)
    }
    ctx.closePath()
    ctx.fill()
  }
}

function player(ctx: CanvasRenderingContext2D, px: number, py: number, gravitySign: 1 | -1, squash: number): void {
  // Squash along the axis of travel, stretch across it. Volume roughly preserved.
  const s = squash * SQUASH_AMOUNT
  const w = PLAYER_W * (1 + s)
  const h = PLAYER_H * (1 - s)
  const x = px + (PLAYER_W - w) / 2
  const y = py + (gravitySign === 1 ? PLAYER_H - h : 0)

  ctx.fillStyle = PALETTE.playerOutline
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4)
  ctx.fillStyle = PALETTE.player
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = PALETTE.playerCore
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8)

  // A bar on the gravity-facing edge: the only readout of which way is "down".
  ctx.fillStyle = PALETTE.playerOutline
  const barY = gravitySign === 1 ? y + h - 5 : y + 1
  ctx.fillRect(x + 4, barY, w - 8, 4)
}

export function render(
  ctx: CanvasRenderingContext2D,
  s: RunState,
  prev: RunState,
  alpha: number,
  world: World,
  hud: HudInfo,
  drawBackdrop: (ctx: CanvasRenderingContext2D, camX: number, topY: number, botY: number) => void,
): void {
  const distance = prev.distance + (s.distance - prev.distance) * alpha
  const playerY = Math.round(prev.player.y + (s.player.y - prev.player.y) * alpha)
  const camX = Math.round(distance)

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  drawBackdrop(ctx, camX, CEIL_Y, FLOOR_Y)

  const shake = shakeOffset()
  ctx.save()
  ctx.translate(Math.round(shake.x), Math.round(shake.y))
  ctx.translate(-camX, 0)

  brickSlab(ctx, camX, FLOOR_Y, VIEW_H - FLOOR_Y)
  brickSlab(ctx, camX, CEIL_TOP, CEIL_Y - CEIL_TOP)
  ctx.fillStyle = PALETTE.brickTop
  ctx.fillRect(camX, FLOOR_Y, VIEW_W, 3)
  ctx.fillRect(camX, CEIL_Y - 3, VIEW_W, 3)

  for (const h of world.hazardsInRange(camX - 60, camX + VIEW_W + 60)) {
    hazard(ctx, h)
  }

  drawParticles(ctx)
  player(ctx, camX + PLAYER_X, playerY, s.player.gravitySign, hud.squash)

  ctx.restore()

  if (hud.flash > 0) {
    ctx.fillStyle = PALETTE.flash
    ctx.globalAlpha = hud.flash * 0.75
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    ctx.globalAlpha = 1
  }
  if (hud.dead) {
    const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.7)
    v.addColorStop(0, 'rgba(0,0,0,0)')
    v.addColorStop(1, PALETTE.vignette)
    ctx.fillStyle = v
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  }

  drawHud(ctx, s, hud)
}

function text(ctx: CanvasRenderingContext2D, str: string, x: number, y: number, color: string): void {
  ctx.fillStyle = PALETTE.hudShadow
  ctx.fillText(str, x + 2, y + 2)
  ctx.fillStyle = color
  ctx.fillText(str, x, y)
}

function drawHud(ctx: CanvasRenderingContext2D, s: RunState, hud: HudInfo): void {
  ctx.font = BIG
  ctx.textAlign = 'left'
  text(ctx, `${score(s)}`, 20, 46, PALETTE.hud)
  ctx.font = MONO
  text(ctx, `best ${hud.best}`, 20, 68, PALETTE.hudMuted)
  text(ctx, `deaths ${hud.deaths}`, 20, 86, PALETTE.hudMuted)

  ctx.textAlign = 'right'
  text(ctx, `${hud.ticksPerSecond} tick/s`, VIEW_W - 20, 34, PALETTE.hudMuted)
  text(ctx, `queue ${hud.queueDepth}`, VIEW_W - 20, 54, PALETTE.hudMuted)

  // Difficulty meter. An endless run has no progress to show, but it does have a
  // ramp, and seeing it climb is what makes a long run feel like it is going
  // somewhere rather than just continuing.
  const barW = 200
  const bx = (VIEW_W - barW) / 2
  ctx.fillStyle = PALETTE.hudDim
  ctx.fillRect(bx, 26, barW, 8)
  ctx.fillStyle = PALETTE.hud
  ctx.fillRect(bx, 26, barW * hud.difficulty, 8)

  ctx.textAlign = 'center'
  if (!hud.started) {
    ctx.font = BIG
    text(ctx, 'TAP TO FLIP GRAVITY', VIEW_W / 2, VIEW_H / 2 - 8, PALETTE.hud)
    ctx.font = MONO
    text(ctx, 'space · click · tap', VIEW_W / 2, VIEW_H / 2 + 20, PALETTE.hudMuted)
  } else if (hud.dead) {
    ctx.font = BIG
    text(ctx, 'AGAIN', VIEW_W / 2, VIEW_H / 2, PALETTE.hud)
  }
}
