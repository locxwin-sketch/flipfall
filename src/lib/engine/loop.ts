import { FIXED_DT, MAX_FRAME_DELTA_MS, MAX_TICKS_PER_FRAME } from '@/constants/physics'

export interface LoopCallbacks {
  /** dt is ALWAYS FIXED_DT. Never variable. */
  fixedUpdate(dt: number, tick: number): void
  /** alpha in [0,1) — interpolation factor between the last two sim states. */
  render(alpha: number, frameDt: number): void
}

export interface Loop {
  start(): void
  stop(): void
  /** Stops rAF AND zeroes the accumulator. Call before any ad break. */
  pause(): void
  resume(): void
  readonly paused: boolean
  readonly tick: number
  /** Measured sim rate, for the T01 acceptance check. */
  readonly ticksPerSecond: number
}

export function createLoop(cb: LoopCallbacks): Loop {
  let rafId = 0
  let running = false
  let paused = false
  let lastTime = 0
  let acc = 0
  let tick = 0

  // Rolling tick-rate measurement. This exists so acceptance criterion 1 is
  // observable rather than asserted: it must read ~120 on a 144Hz display.
  let rateWindowStart = 0
  let rateWindowTicks = 0
  let ticksPerSecond = 0

  function frame(now: number): void {
    if (!running || paused) return
    rafId = requestAnimationFrame(frame)

    const delta = Math.min(now - lastTime, MAX_FRAME_DELTA_MS)
    lastTime = now
    acc += delta / 1000

    let n = 0
    while (acc >= FIXED_DT && n < MAX_TICKS_PER_FRAME) {
      cb.fixedUpdate(FIXED_DT, ++tick)
      acc -= FIXED_DT
      n++
    }
    // Discard the debt rather than banking it. Banking turns one long stall into a
    // burst of unreacted simulation, which in a precision game is an unearned death.
    if (n === MAX_TICKS_PER_FRAME) acc = 0

    rateWindowTicks += n
    if (now - rateWindowStart >= 500) {
      ticksPerSecond = Math.round((rateWindowTicks * 1000) / (now - rateWindowStart))
      rateWindowStart = now
      rateWindowTicks = 0
    }

    cb.render(acc / FIXED_DT, delta / 1000)
  }

  return {
    start(): void {
      if (running) return
      running = true
      paused = false
      lastTime = performance.now()
      rateWindowStart = lastTime
      rateWindowTicks = 0
      acc = 0
      rafId = requestAnimationFrame(frame)
    },
    stop(): void {
      running = false
      cancelAnimationFrame(rafId)
    },
    pause(): void {
      if (paused) return
      paused = true
      cancelAnimationFrame(rafId)
      acc = 0
    },
    resume(): void {
      if (!paused) return
      paused = false
      // Reset the clock BEFORE restarting rAF, or the first delta is the whole
      // pause duration. The clamp would absorb it, but resume should be exact.
      lastTime = performance.now()
      rateWindowStart = lastTime
      rateWindowTicks = 0
      acc = 0
      if (running) rafId = requestAnimationFrame(frame)
    },
    get paused(): boolean {
      return paused
    },
    get tick(): number {
      return tick
    },
    get ticksPerSecond(): number {
      return ticksPerSecond
    },
  }
}
