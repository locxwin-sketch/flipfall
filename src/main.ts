// Composition root: canvas, loop, input, sim, fx, render.

import './style.css'
import { FIXED_DT, PLAYER_H, PLAYER_W, TICK_HZ } from '@/constants/physics'
import { CEIL_Y, FLOOR_Y, PLAYER_X } from '@/constants/layout'
import { PALETTE } from '@/constants/palette'
import {
  DEATH_BURST,
  FLASH_MS,
  HITSTOP_DEATH_MS,
  RING_MS,
  RING_RADIUS,
  SHATTER_GRAVITY,
  SHATTER_LIFE_MS,
  SHATTER_SPEED,
  SMOKE_PUFFS,
  SPLAT_COUNT,
  SPLAT_LIFE_MS,
  SPLAT_MAX_R,
  SPLAT_SPREAD,
  DEATH_WASH_MS,
  GORE_BURST,
  GORE_LIFE_MS,
  GORE_SPEED,
  FLIP_BURST,
  LAND_BURST,
  SHAKE_DEATH_MS,
  SHAKE_DEATH_PX,
  SHAKE_FLIP_MS,
  SHAKE_FLIP_PX,
  SHAKE_LAND_MS,
  SHAKE_LAND_PX,
  SQUASH_MS,
  TRAIL_INTERVAL_MS,
  TRAIL_LIFE_MS,
  HOLD_SELECT_MS,
} from '@/constants/feel'
import { DEATH_LOOKS, DEATH_STYLE, type DeathStyle } from '@/constants/death'
import { isMode, type Mode } from '@/constants/modes'
import { createLoop } from '@/lib/engine/loop'
import {
  bindInput,
  clearQueue,
  isHeld,
  pollPress,
  pressQueueDepth,
  setInputEnabled,
} from '@/lib/engine/input'
import { initAudio, setMuted, sfx } from '@/lib/engine/audio'
import { loadBest, saveBest } from '@/lib/engine/storage'
import { World } from '@/lib/game/world'
import { difficultyAt } from '@/lib/game/difficulty'
import { bonusScore, initRun, score, stepRun, type RunState } from '@/lib/game/sim'
import { ReplayRecorder } from '@/lib/game/replay'
import { burst, clearParticles, shatter, spray, trail, updateParticles } from '@/lib/fx/particles'
import { clearRings, ring, updateRings } from '@/lib/fx/shockwave'
import { clearSplatter, splatter, updateSplatter } from '@/lib/fx/splatter'
import { PIG_H, PIG_PIXELS, PIG_W, PIXEL } from '@/lib/render/sprites'
import { freeze, isFrozen, resetFx, shake, updateFx } from '@/lib/fx/shake'
import { drawBackdrop } from '@/lib/render/backdrop'
import { render, type HudInfo } from '@/lib/render/renderer'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('#game canvas not found')
const ctx = canvas.getContext('2d')
if (!ctx) throw new Error('2d context unavailable')
ctx.imageSmoothingEnabled = false

const recorder = new ReplayRecorder()

// A fresh seed per run. The daily challenge (seed = YYYYMMDD) rides on the same
// mechanism later; nothing about the world is stored, only the number it grew from.
function newSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}

/** Which mode the current world belongs to. Chosen on the title screen. */
let mode: Mode = 'endless'
/** Dev-only `?seed=` pin, so a restart re-rolls the same world instead of a new one. */
let pinnedSeed: number | null = null

let world = new World(newSeed(), mode)
let run: RunState = initRun(world)
recorder.start(world.seed, mode)
let prev: RunState = run
let started = false
let deaths = 0
let best = loadBest(mode)

// Title-screen mode select. A press does not start the run any more; it starts a
// hold timer, and what happens on release decides the mode. Tap → Endless, hold
// past HOLD_SELECT_MS → Gauntlet.
const HOLD_SELECT_TICKS = Math.round((HOLD_SELECT_MS / 1000) * TICK_HZ)
let selecting = false
let selectTicks = 0
/** Which death this build ships. Overridable in dev via ?death=. */
let deathStyle: DeathStyle = DEATH_STYLE

// Render-time only. None of this feeds back into the simulation.
let squash = 0
let flash = 0
let deathWash = 0
let trailTimer = 0

function playerWorldX(): number {
  return run.distance + PLAYER_X + PLAYER_W / 2
}

/**
 * Endless scores distance alone — its stored bests predate coins and grazing, and
 * folding bonuses in would silently reprice every one of them. Gauntlet, whose
 * bests start empty, scores the lot.
 */
function runScore(s: RunState): number {
  return score(s) + (mode === 'gauntlet' ? bonusScore(s) : 0)
}

function reset(): void {
  world = new World(pinnedSeed ?? newSeed(), mode)
  run = initRun(world)
  prev = run
  recorder.start(world.seed, mode)
  clearParticles()
  clearRings()
  clearSplatter()
  resetFx()
  squash = 0
  flash = 0
  deathWash = 0
}

/**
 * Commit to a mode and start. Rebuilding the world is only necessary when the mode
 * actually changed, but it is unconditional here because the alternative is a
 * `mode` field and a `world.mode` that can disagree — and every bug that produces
 * looks like "the generator is broken" rather than "the world is the wrong mode".
 */
function begin(m: Mode): void {
  mode = m
  best = loadBest(mode)
  deaths = 0
  reset()
  selecting = false
  started = true
  // The press that opened the select is spent, and on a hold the OS may have queued
  // more behind it. Starting a precision run with a banked flip is a free death.
  clearQueue()
}

function fixedUpdate(dt: number): void {
  // Hitstop freezes the simulation while rendering continues. Cosmetic by
  // construction: the sim simply does not advance, so no state is invented.
  if (isFrozen()) return

  prev = run

  if (!started) {
    if (selecting) {
      selectTicks++
      // Release before the threshold is a tap; reaching it is a hold. Deciding on
      // release rather than on press is the whole reason the run does not begin on
      // the first press any more.
      if (!isHeld()) begin('endless')
      else if (selectTicks >= HOLD_SELECT_TICKS) begin('gauntlet')
    } else if (pollPress()) {
      selecting = true
      selectTicks = 0
    }
    return
  }

  if (run.dead) {
    if (pollPress()) reset()
    return
  }

  const flip = pollPress()
  if (flip) {
    recorder.record(run.tick)
    sfx.flip()
    squash = 1
    shake(SHAKE_FLIP_PX, SHAKE_FLIP_MS)
    burst(playerWorldX(), run.player.y + PLAYER_H / 2, FLIP_BURST, 190, 260, PALETTE.player, 3)
  }

  world.advance(run.distance)
  const next = stepRun(run, flip, dt, world)

  if (!run.player.grounded && next.player.grounded) {
    sfx.land()
    shake(SHAKE_LAND_PX, SHAKE_LAND_MS)
    const dir = next.player.gravitySign === 1 ? -1 : 1
    spray(playerWorldX(), next.player.y + (dir === -1 ? PLAYER_H : 0), LAND_BURST, dir, 150, 240, PALETTE.cloud)
  }

  if (next.grazes > run.grazes) {
    sfx.graze()
    shake(SHAKE_FLIP_PX, SHAKE_FLIP_MS)
  }

  if (next.coins > run.coins) {
    sfx.coin()
    // A small gold puff where the coin was, so the pickup registers even when the
    // player's eyes are on the next gap rather than on the counter.
    burst(playerWorldX(), next.player.y + PLAYER_H / 2, 6, 170, 300, PALETTE.coinBright, 3, 260)
  }

  if (next.dead && !run.dead) {
    deaths++
    sfx.die()
    freeze(HITSTOP_DEATH_MS)
    shake(SHAKE_DEATH_PX, SHAKE_DEATH_MS)
    flash = 1
    deathWash = 1

    spawnDeathFx(playerWorldX(), next.player.y + PLAYER_H / 2, next.coins)

    // Only touch storage when the number actually moved. Most deaths are not
    // personal bests, and a write per death is a write per few seconds.
    const final = runScore(next)
    if (final > best) {
      best = final
      saveBest(best, mode)
    }
  }

  run = next
}

/**
 * Everything the death looks like, in one place. Split out of fixedUpdate so the
 * dev-only `__game.kill()` can fire it for headless screenshots — the death fx are
 * otherwise unreachable without actually dying, and this is the effect most in need
 * of being looked at.
 */
function spawnDeathFx(cx: number, y: number, coins = 0): void {
  const look = DEATH_LOOKS[deathStyle]
  const cy = y

  // The pig comes apart into its own pixels, each keeping its colour, so for a
  // moment the pig is still legible in the shrapnel. Style-independent: this is the
  // sprite itself, and it is what makes either death read as *this* pig dying.
  shatter(cx, cy, PIG_PIXELS, PIG_W, PIG_H, PIXEL, SHATTER_SPEED, SHATTER_LIFE_MS, SHATTER_GRAVITY)

  // Heavy debris. Gravity so it arcs and falls rather than drifting — slime has
  // weight, and so do coins.
  burst(cx, cy, GORE_BURST, GORE_SPEED, GORE_LIFE_MS, look.chunkA.color, look.chunkA.size, look.chunkA.gravity)
  burst(
    cx,
    cy,
    Math.round(GORE_BURST * 0.5),
    GORE_SPEED * 0.7,
    GORE_LIFE_MS,
    look.chunkB.color,
    look.chunkB.size,
    look.chunkB.gravity,
  )

  // Three rings: leading edge, body, dark wake. The wake stays dark in both styles
  // because a bright ring over a bright ring loses its edge.
  ring(cx, cy, RING_RADIUS * 1.15, RING_MS, look.rings[0], 8)
  ring(cx, cy, RING_RADIUS * 0.8, RING_MS * 0.85, look.rings[1], 6)
  ring(cx, cy, RING_RADIUS * 0.45, RING_MS * 0.6, look.rings[2], 4)

  // The drift layer rises against gravity — the one thing in the frame not obeying
  // the mechanic, which is why it reads as smoke, or as banknotes.
  burst(cx, cy, SMOKE_PUFFS, 90, 780, look.drift, 6, -140)
  burst(cx, cy, DEATH_BURST, 300, 520, look.spark, 3, 800)

  // The savings. Independent of DEATH_STYLE on purpose: whether the pig bursts into
  // slime or into confetti, what it was carrying comes out too, and the size of the
  // spray is exactly what the run earned. A run that collected nothing spills
  // nothing — the effect reports the run rather than decorating it.
  if (coins > 0) {
    const n = Math.min(60, coins * 3)
    // Sized to compete with the death debris rather than the world: a coin fleck
    // at 3px reads as dust next to a slime chunk. This is a static contrast call
    // and safe to make from a still — the SPREAD and timing are not, and have not
    // been touched.
    burst(cx, cy, n, 380, 1100, PALETTE.coin, 5, 900, true)
    burst(cx, cy, Math.round(n * 0.4), 300, 1200, PALETTE.coinBright, 4, 780, true)
  }

  // And the lens takes it. Screen space, so the origin is the player's fixed
  // on-screen x, NOT the world x used by everything above — the pig is always at
  // PLAYER_X, and using cx here would throw the debris off the side of the frame.
  splatter(PLAYER_X + PLAYER_W / 2, y, {
    count: SPLAT_COUNT,
    spread: SPLAT_SPREAD,
    lifeMs: SPLAT_LIFE_MS,
    maxRadius: SPLAT_MAX_R,
    colors: look.lens.colors,
    shape: look.lens.shape,
    drips: look.lens.drips,
  })
}

function draw(alpha: number, frameDt: number): void {
  updateFx(frameDt)
  updateParticles(frameDt)
  updateRings(frameDt)
  updateSplatter(frameDt)

  if (squash > 0) squash = Math.max(0, squash - frameDt / (SQUASH_MS / 1000))
  if (flash > 0) flash = Math.max(0, flash - frameDt / (FLASH_MS / 1000))
  if (deathWash > 0) deathWash = Math.max(0, deathWash - frameDt / (DEATH_WASH_MS / 1000))

  if (started && !run.dead && !run.player.grounded) {
    trailTimer += frameDt * 1000
    while (trailTimer >= TRAIL_INTERVAL_MS) {
      trailTimer -= TRAIL_INTERVAL_MS
      trail(playerWorldX(), run.player.y + PLAYER_H / 2, PLAYER_W * 0.7, TRAIL_LIFE_MS, PALETTE.trail)
    }
  } else {
    trailTimer = 0
  }

  const hud: HudInfo = {
    ticksPerSecond: loop.ticksPerSecond,
    deaths,
    best,
    queueDepth: pressQueueDepth(),
    dead: run.dead,
    started,
    difficulty: difficultyAt(run.distance, world.curve),
    mode,
    total: runScore(run),
    holdProgress: selecting ? Math.min(1, selectTicks / HOLD_SELECT_TICKS) : 0,
    squash,
    flash,
    deathWash,
    look: DEATH_LOOKS[deathStyle],
  }
  render(ctx!, run, prev, alpha, world, hud, drawBackdrop)
}

// Dev-only: ?skip=<px> starts the run partway in, so art and level changes can be
// reviewed without playing to 24s every time. Never reachable in a production build.
if (import.meta.env.DEV) {
  const q = new URLSearchParams(location.search)

  // ?mode=gauntlet — reach the second mode without holding the button. Without
  // this, Gauntlet can only be entered by a gesture, which makes every screenshot
  // and bug report against it awkward to reproduce.
  const modeParam = q.get('mode')
  if (isMode(modeParam)) {
    mode = modeParam
    best = loadBest(mode)
  }

  const fixedSeed = Number(q.get('seed'))
  if (Number.isFinite(fixedSeed) && q.has('seed')) {
    pinnedSeed = fixedSeed >>> 0
  }
  if (pinnedSeed !== null || isMode(modeParam)) {
    world = new World(pinnedSeed ?? world.seed, mode)
    run = initRun(world)
    prev = run
    recorder.start(world.seed, mode)
  }
  const skip = Number(q.get('skip'))
  if (Number.isFinite(skip) && skip > 0) {
    started = true
    world.advance(skip)
    // Mid-corridor, not on the floor: spawning grounded at an arbitrary distance
    // usually lands inside a hazard and dies on frame one.
    run = {
      ...run,
      distance: skip,
      player: { ...run.player, y: (CEIL_Y + FLOOR_Y) / 2 - PLAYER_H / 2, grounded: false },
    }
    prev = run
  }
  // ?die=1 — fire the death fx at boot. `--screenshot` cannot run JS, so this is
  // the only way to get the explosion into a headless still; see docs/JOURNAL.md.
  const styleParam = q.get('death')
  if (styleParam === 'coins' || styleParam === 'slime') deathStyle = styleParam
  if (q.get('die') === '1') {
    started = true
    // A death with no coins spills no coins, which makes the default preview
    // misleading. `?coins=<n>` seeds a purse so the spill can actually be judged.
    const previewCoins = Number(q.get('coins') ?? 8)
    run = { ...run, coins: Number.isFinite(previewCoins) ? previewCoins : 8 }
    spawnDeathFx(playerWorldX(), run.player.y + PLAYER_H / 2, run.coins)
    // Set the dead flag too, so the still shows what a death actually looks like —
    // wash and vignette included — rather than only the particle layer.
    flash = 1
    deathWash = 1
    run = { ...run, dead: true }
    prev = run
  }
}

const loop = createLoop({ fixedUpdate, render: draw })

bindInput(canvas, () => initAudio())

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    setInputEnabled(false)
    setMuted(true)
    loop.pause()
  } else {
    loop.resume()
    setMuted(false)
    setInputEnabled(true)
  }
})

loop.start()

if (import.meta.env.DEV) {
  Object.assign(window, {
    __game: {
      get run() {
        return run
      },
      get ticksPerSecond() {
        return loop.ticksPerSecond
      },
      get queueDepth() {
        return pressQueueDepth()
      },
      get seed() {
        return world.seed
      },
      get mode() {
        return world.mode
      },
      get chunks() {
        return world.cachedChunks
      },
      replay: () => recorder.build(),
      /** Fires the death fx where the player currently is, without dying. For
       *  headless screenshots: the death effects are otherwise unreachable
       *  without playing into a hazard, which cannot be scripted. */
      kill: () => spawnDeathFx(playerWorldX(), run.player.y + PLAYER_H / 2, run.coins),
      fixedDt: FIXED_DT,
    },
  })
}
