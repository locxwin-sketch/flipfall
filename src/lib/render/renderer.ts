import { PALETTE } from '@/constants/palette'
import { PLAYER_H, PLAYER_W, VIEW_H, VIEW_W } from '@/constants/physics'
import { CEIL_TOP, CEIL_Y, FLOOR_Y, PLAYER_X } from '@/constants/layout'
import type { Level } from '@/lib/game/level'
import type { RunState } from '@/lib/game/sim'

export interface HudInfo {
  ticksPerSecond: number
  deaths: number
  best: number
  queueDepth: number
  dead: boolean
  finished: boolean
  started: boolean
}

const MONO = '14px ui-monospace, SFMono-Regular, Menlo, monospace'

export function render(
  ctx: CanvasRenderingContext2D,
  s: RunState,
  prev: RunState,
  alpha: number,
  level: Level,
  hud: HudInfo,
): void {
  // Interpolate between the last two sim states, then round — sub-pixel positions
  // shimmer under image-rendering: pixelated.
  const distance = prev.distance + (s.distance - prev.distance) * alpha
  const playerY = Math.round(prev.player.y + (s.player.y - prev.player.y) * alpha)
  const camX = Math.round(distance)

  ctx.fillStyle = PALETTE.bg
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  ctx.save()
  // Ported verbatim from contra/game.js:417 — the one rendering line worth keeping.
  ctx.translate(-camX, 0)

  // Surfaces
  ctx.fillStyle = PALETTE.pad
  ctx.fillRect(camX, FLOOR_Y, VIEW_W, VIEW_H - FLOOR_Y)
  ctx.fillRect(camX, CEIL_TOP, VIEW_W, CEIL_Y - CEIL_TOP)
  ctx.fillStyle = PALETTE.padEdge
  ctx.fillRect(camX, FLOOR_Y, VIEW_W, 2)
  ctx.fillRect(camX, CEIL_Y - 2, VIEW_W, 2)

  // Hazards — only those on screen.
  const left = camX - 40
  const right = camX + VIEW_W + 40
  for (const h of level.hazards) {
    if (h.x + h.w < left || h.x > right) continue
    ctx.fillStyle = PALETTE.hazard
    ctx.fillRect(h.x, h.y, h.w, h.h)
    ctx.fillStyle = PALETTE.hazardEdge
    ctx.fillRect(h.x, h.y, h.w, 2)
  }

  // Player
  const px = camX + PLAYER_X
  ctx.fillStyle = s.dead ? PALETTE.hazardEdge : PALETTE.player
  ctx.fillRect(px, playerY, PLAYER_W, PLAYER_H)
  // A notch on the gravity-facing edge, so which way "down" is stays readable.
  ctx.fillStyle = PALETTE.bg
  const notchY = s.player.gravitySign === 1 ? playerY + PLAYER_H - 5 : playerY + 1
  ctx.fillRect(px + 6, notchY, PLAYER_W - 12, 4)

  ctx.restore()

  drawHud(ctx, s, hud, level)
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  s: RunState,
  hud: HudInfo,
  level: Level,
): void {
  ctx.font = MONO
  ctx.textAlign = 'left'
  ctx.fillStyle = PALETTE.hud
  ctx.fillText(`${Math.round(s.distance)} / ${level.lengthPx}`, 20, 36)

  ctx.fillStyle = PALETTE.hudMuted
  ctx.fillText(`best ${hud.best}`, 20, 56)
  ctx.fillText(`deaths ${hud.deaths}`, 20, 74)

  // Acceptance criteria 1 and 2 are on-screen on purpose: the tick rate must read
  // ~120 on a 144Hz display, and the queue must be seen exceeding 1 under fast taps.
  ctx.textAlign = 'right'
  ctx.fillText(`${hud.ticksPerSecond} tick/s`, VIEW_W - 20, 36)
  ctx.fillText(`queue ${hud.queueDepth}`, VIEW_W - 20, 56)

  ctx.textAlign = 'center'
  if (!hud.started) {
    ctx.fillStyle = PALETTE.hud
    ctx.font = '28px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText('TAP TO FLIP GRAVITY', VIEW_W / 2, VIEW_H / 2 - 10)
    ctx.font = MONO
    ctx.fillStyle = PALETTE.hudMuted
    ctx.fillText('space · click · tap', VIEW_W / 2, VIEW_H / 2 + 18)
  } else if (hud.finished) {
    ctx.fillStyle = PALETTE.player
    ctx.font = '28px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText('CLEARED', VIEW_W / 2, VIEW_H / 2)
  } else if (hud.dead) {
    ctx.fillStyle = PALETTE.hazardEdge
    ctx.font = '28px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText('AGAIN', VIEW_W / 2, VIEW_H / 2)
  }
}
