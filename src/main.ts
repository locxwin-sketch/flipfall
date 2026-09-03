// Composition root: canvas, loop, input, sim, fx, render.

import './style.css'
import { FIXED_DT, PLAYER_H, PLAYER_W } from '@/constants/physics'
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
} from '@/constants/feel'
import { createLoop } from '@/lib/engine/loop'
import { bindInput, pollPress, pressQueueDepth, setInputEnabled } from '@/lib/engine/input'
import { initAudio, setMuted, sfx } from '@/lib/engine/audio'
import { World } from '@/lib/game/world'
import { difficultyAt } from '@/lib/game/difficulty'
import { initRun, score, stepRun, type RunState } from '@/lib/game/sim'
import { ReplayRecorder } from '@/lib/game/replay'
import { burst, clearParticles, shatter, spray, trail, updateParticles } from '@/lib/fx/particles'
import { clearRings, ring, updateRings } from '@/lib/fx/shockwave'
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

let world = new World(newSeed())
let run: RunState = initRun(world)
recorder.start(world.seed)
let prev: RunState = run
let started = false
let deaths = 0
let best = 0

// Render-time only. None of this feeds back into the simulation.
let squash = 0
let flash = 0
let trailTimer = 0

function playerWorldX(): number {
  return run.distance + PLAYER_X + PLAYER_W / 2
}

function reset(): void {
  world = new World(newSeed())
  run = initRun(world)
  prev = run
  recorder.start(world.seed)
  clearParticles()
  clearRings()
  resetFx()
  squash = 0
  flash = 0
}

function fixedUpdate(dt: number): void {
  // Hitstop freezes the simulation while rendering continues. Cosmetic by
  // construction: the sim simply does not advance, so no state is invented.
  if (isFrozen()) return

  prev = run

  if (!started) {
    if (pollPress()) started = true
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

  if (next.dead && !run.dead) {
    deaths++
    sfx.die()
    freeze(HITSTOP_DEATH_MS)
    shake(SHAKE_DEATH_PX, SHAKE_DEATH_MS)
    flash = 1

    const cx = playerWorldX()
    const cy = next.player.y + PLAYER_H / 2

    // The pig comes apart into its own pixels, each keeping its colour, so for a
    // moment the pig is still legible in the shrapnel.
    shatter(cx, cy, PIG_PIXELS, PIG_W, PIG_H, PIXEL, SHATTER_SPEED, SHATTER_LIFE_MS, SHATTER_GRAVITY)

    // Two rings, offset in size and timing, so the blast has a front and a wake.
    // One bright, one dark. A white-on-white ring vanishes against this sky, so
    // the leading edge is the hazard colour and only the wake is white.
    ring(cx, cy, RING_RADIUS, RING_MS, PALETTE.hazard, 7)
    ring(cx, cy, RING_RADIUS * 0.55, RING_MS * 0.7, PALETTE.flash, 4)

    // Smoke drifts up regardless of gravity — it is the one thing in the frame
    // that is not obeying the mechanic, which is why it reads as smoke.
    burst(cx, cy, SMOKE_PUFFS, 90, 780, PALETTE.cloud, 6, -140)
    burst(cx, cy, DEATH_BURST, 300, 520, PALETTE.hazardTip, 3, 800)

    best = Math.max(best, score(next))
  }

  run = next
}

function draw(alpha: number, frameDt: number): void {
  updateFx(frameDt)
  updateParticles(frameDt)
  updateRings(frameDt)

  if (squash > 0) squash = Math.max(0, squash - frameDt / (SQUASH_MS / 1000))
  if (flash > 0) flash = Math.max(0, flash - frameDt / (FLASH_MS / 1000))

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
    difficulty: difficultyAt(run.distance),
    squash,
    flash,
  }
  render(ctx!, run, prev, alpha, world, hud, drawBackdrop)
}

// Dev-only: ?skip=<px> starts the run partway in, so art and level changes can be
// reviewed without playing to 24s every time. Never reachable in a production build.
if (import.meta.env.DEV) {
  const q = new URLSearchParams(location.search)
  const fixedSeed = Number(q.get('seed'))
  if (Number.isFinite(fixedSeed) && q.has('seed')) {
    world = new World(fixedSeed)
    run = initRun(world)
    prev = run
    recorder.start(world.seed)
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
      get chunks() {
        return world.cachedChunks
      },
      replay: () => recorder.build(),
      fixedDt: FIXED_DT,
    },
  })
}
