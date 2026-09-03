// Composition root: canvas, loop, input, sim, render.

import './style.css'
import { FIXED_DT } from '@/constants/physics'
import { createLoop } from '@/lib/engine/loop'
import { bindInput, pollPress, pressQueueDepth, setInputEnabled } from '@/lib/engine/input'
import { initAudio, setMuted, sfx } from '@/lib/engine/audio'
import { T01_LEVEL } from '@/lib/game/level'
import { initRun, stepRun, type RunState } from '@/lib/game/sim'
import { ReplayRecorder } from '@/lib/game/replay'
import { render, type HudInfo } from '@/lib/render/renderer'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('#game canvas not found')
const ctx = canvas.getContext('2d')
if (!ctx) throw new Error('2d context unavailable')
ctx.imageSmoothingEnabled = false

const level = T01_LEVEL
const recorder = new ReplayRecorder()

let run: RunState = initRun(level)
let prev: RunState = run
let started = false
let deaths = 0
let best = 0

function reset(): void {
  run = initRun(level)
  prev = run
  recorder.reset()
}

function fixedUpdate(dt: number): void {
  prev = run

  if (!started) {
    if (pollPress()) started = true
    return
  }

  if (run.dead || run.finished) {
    // Zero restart lockout. A press during the death frames is already sitting in
    // the queue and restarts on the very next tick — this is the one-more-try loop,
    // and a 500ms "get ready" here is the most common way the genre kills itself.
    if (pollPress()) reset()
    return
  }

  const flip = pollPress()
  if (flip) {
    recorder.record(run.tick)
    sfx.flip()
  }

  const next = stepRun(run, flip, dt, level)

  if (!run.player.grounded && next.player.grounded) sfx.land()
  if (next.dead && !run.dead) {
    deaths++
    sfx.die()
    best = Math.max(best, Math.round(next.distance))
  }
  if (next.finished) best = Math.max(best, Math.round(next.distance))

  run = next
}

function draw(alpha: number): void {
  const hud: HudInfo = {
    ticksPerSecond: loop.ticksPerSecond,
    deaths,
    best,
    queueDepth: pressQueueDepth(),
    dead: run.dead,
    finished: run.finished,
    started,
  }
  render(ctx!, run, prev, alpha, level, hud)
}

const loop = createLoop({ fixedUpdate, render: draw })

bindInput(canvas, () => initAudio())

// The real ad hazard: an in-page overlay leaves the tab visible, so rAF keeps firing
// and the sim advances under the ad. Same handling for a backgrounded tab.
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

// Dev-only handle for the acceptance checks (tick rate, queue depth, replays).
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
      replay: () => recorder.build(),
      fixedDt: FIXED_DT,
    },
  })
}
