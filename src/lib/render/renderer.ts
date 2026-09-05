import { PALETTE } from '@/constants/palette'
import { PLAYER_H, PLAYER_W, VIEW_H, VIEW_W } from '@/constants/physics'
import { CEIL_TOP, CEIL_Y, FLOOR_Y, PLAYER_X } from '@/constants/layout'
import { SQUASH_AMOUNT } from '@/constants/feel'
import type { DeathLook } from '@/constants/death'
import type { Mode } from '@/constants/modes'
import { drawParticles } from '@/lib/fx/particles'
import { drawRings } from '@/lib/fx/shockwave'
import { drawSplatter } from '@/lib/fx/splatter'
import { drawPig } from './sprites'
import { motionScale, shakeOffset } from '@/lib/fx/shake'
import type { Coin, Rect } from '@/lib/game/level'
import type { World } from '@/lib/game/world'
import type { RunState } from '@/lib/game/sim'

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
  /** 1 on the death frame, decaying to 0 over DEATH_WASH_MS. Drives the wash. */
  deathWash: number
  /** Colours for the active death style. See constants/death.ts. */
  look: DeathLook
  /** Which mode this run belongs to. */
  mode: Mode
  /** 0..1 while the title-screen button is held. Drives the Gauntlet select bar. */
  holdProgress: number
  /** The score actually being played for: distance, plus bonuses in Gauntlet. */
  total: number
}

/**
 * Death taunts, cycled by death count. One fixed line is read dozens of times a
 * session and stops being read at all after the third — the joke has to keep
 * moving or the screen may as well be blank. The SECOND line is always the
 * instruction, because tapping is still the only thing to do here and a rage game
 * that hides its restart is just broken.
 */
const TAUNTS: ReadonlyArray<readonly [string, string]> = [
  ['YOU SUCK', "DON'T EVEN TRY AGAIN"],
  ['THE PIG DESERVED BETTER', 'tap to disappoint it again'],
  ['SKILL ISSUE', 'tap · this time hold the flip'],
  ['THAT WAS THE EASY BIT', 'tap if you disagree'],
  ['GRAVITY: 1', 'tap to even the score'],
  ['ALMOST', 'it was not almost · tap'],
  ['BACON', 'tap to make more'],
]

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

/**
 * Coin, drawn as chunky pixel blocks like everything else in this world. Gold on a
 * blue sky and green hills clears the 45-unit contrast rule the backdrop forced on
 * every other colour here — see the palette notes and death.test.ts. The inner
 * highlight is what stops it reading as a flat disc at this size.
 */
function drawCoin(ctx: CanvasRenderingContext2D, c: Coin, bob: number): void {
  const s = 4
  const x = Math.round((c.x + c.w / 2) / s) * s
  const y = Math.round((c.y + c.h / 2 + bob) / s) * s
  ctx.fillStyle = PALETTE.coinDark
  ctx.fillRect(x - 3 * s, y - 4 * s, 6 * s, 8 * s)
  ctx.fillRect(x - 4 * s, y - 3 * s, 8 * s, 6 * s)
  ctx.fillStyle = PALETTE.coin
  ctx.fillRect(x - 2 * s, y - 3 * s, 4 * s, 6 * s)
  ctx.fillRect(x - 3 * s, y - 2 * s, 6 * s, 4 * s)
  ctx.fillStyle = PALETTE.coinBright
  ctx.fillRect(x - s, y - 2 * s, s, 4 * s)
}

function player(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  gravitySign: 1 | -1,
  squash: number,
  dead: boolean,
  coins: number,
): void {
  // The pig IS the death animation's raw material — once it dies the sprite is
  // gone and its pixels are in flight, so drawing nothing here is correct.
  if (dead) return

  // Squash along the axis of travel, stretch across it. Volume roughly preserved.
  const s = squash * SQUASH_AMOUNT
  const w = PLAYER_W * (1 + s)
  const h = PLAYER_H * (1 - s)
  const x = px + (PLAYER_W - w) / 2
  const y = py + (gravitySign === 1 ? PLAYER_H - h : 0)

  drawPig(ctx, x, y, w, h, gravitySign, coins)
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

  // Bob is a pure function of world x, not of a clock: two coins side by side rise
  // and fall out of phase, which reads as a row of objects rather than one sprite
  // stamped repeatedly, and it stays identical between a run and its replay.
  const taken = new Set(s.takenCoins)
  for (const c of world.coinsInRange(camX - 60, camX + VIEW_W + 60)) {
    if (taken.has(c.id)) continue
    drawCoin(ctx, c, Math.sin((camX + c.x) / 60) * 3)
  }

  drawRings(ctx)
  drawParticles(ctx)
  player(ctx, camX + PLAYER_X, playerY, s.player.gravitySign, hud.squash, s.dead, s.coins)

  ctx.restore()

  if (hud.flash > 0) {
    // 0.35, not 0.75. A full-screen white flash fires on every death, and in this
    // genre that is dozens of times per session — at 0.75 it washes the whole frame
    // out and becomes tiring rather than punchy. Halved again under reduced motion.
    ctx.fillStyle = PALETTE.flash
    ctx.globalAlpha = hud.flash * (motionScale() ? 0.35 : 0.15)
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    ctx.globalAlpha = 1
  }
  if (hud.deathWash > 0) {
    // Squared so it slams on and eases off, rather than sitting at half strength
    // for half a second. Thinned under reduced motion like every other full-frame
    // hit.
    ctx.fillStyle = hud.look.wash
    ctx.globalAlpha = hud.deathWash * hud.deathWash * (motionScale() ? 1 : 0.35)
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    ctx.globalAlpha = 1
  }
  if (hud.dead) {
    const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.7)
    v.addColorStop(0, 'rgba(0,0,0,0)')
    // Deepened on death so the whole frame reads as hit, not just tinted at the
    // corners. Reduced motion keeps the old, gentler tint.
    v.addColorStop(1, motionScale() ? hud.look.vignette : PALETTE.vignette)
    ctx.fillStyle = v
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  }

  // The above-wash particle layer: world-space, so the camera transform comes back,
  // but drawn after the wash and vignette so a spilled purse still reads as gold
  // rather than as more of whatever colour the death happens to be.
  ctx.save()
  ctx.translate(Math.round(shake.x), Math.round(shake.y))
  ctx.translate(-camX, 0)
  drawParticles(ctx, true)
  ctx.restore()

  // Screen space, on purpose: the splat is on the lens, in front of the world and
  // in front of the vignette. It is drawn before the HUD so a blob can never cover
  // the score.
  drawSplatter(ctx)

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
  text(ctx, `${hud.total}`, 20, 46, PALETTE.hud)
  ctx.font = MONO
  text(ctx, `best ${hud.best}`, 20, 68, PALETTE.hudMuted)
  text(ctx, `deaths ${hud.deaths}`, 20, 86, PALETTE.hudMuted)
  // Bests are per mode, so the HUD has to say which one this number belongs to —
  // otherwise a Gauntlet best looks like a mysteriously reset Endless best.
  if (hud.mode !== 'endless') text(ctx, hud.mode.toUpperCase(), 20, 104, PALETTE.hud)
  // Coins and grazes only appear once they exist, so Endless's HUD is unchanged
  // for anyone who never holds the button.
  let row = hud.mode === 'endless' ? 104 : 122
  ctx.font = MONO
  if (s.coins > 0) {
    text(ctx, `coins ${s.coins}`, 20, row, PALETTE.coin)
    row += 18
  }
  if (s.grazes > 0) text(ctx, `close calls ${s.grazes}`, 20, row, PALETTE.hazardTip)

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

    // The second mode is behind a hold, and a hold nobody discovers is the same as
    // no second mode at all. So the prompt is always on screen, and the bar fills
    // as you hold — the gesture teaches itself the first time a thumb lingers.
    const held = hud.holdProgress > 0
    text(
      ctx,
      held ? 'KEEP HOLDING…' : 'or HOLD for GAUNTLET',
      VIEW_W / 2,
      VIEW_H / 2 + 46,
      held ? PALETTE.hud : PALETTE.hudMuted,
    )
    if (held) {
      const w = 180
      const x = (VIEW_W - w) / 2
      ctx.fillStyle = PALETTE.hudDim
      ctx.fillRect(x, VIEW_H / 2 + 56, w, 8)
      ctx.fillStyle = PALETTE.hud
      ctx.fillRect(x, VIEW_H / 2 + 56, w * hud.holdProgress, 8)
    }
  } else if (hud.dead) {
    // A rage game that says nothing on death wastes the one moment it has the
    // player's full attention. Indexed by death count rather than randomly, so the
    // set is seen in full before anything repeats.
    const [big, small] = TAUNTS[hud.deaths % TAUNTS.length]!
    ctx.font = BIG
    text(ctx, big, VIEW_W / 2, VIEW_H / 2 - 6, PALETTE.hud)
    ctx.font = MONO
    text(ctx, small, VIEW_W / 2, VIEW_H / 2 + 22, PALETTE.hudMuted)
  }
}
