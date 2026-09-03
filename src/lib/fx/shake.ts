// Screenshake and hitstop. Render-only, like everything under src/lib/fx/.
//
// Respects prefers-reduced-motion. This is not a nicety in a rage game: the player
// dies dozens of times a session, so every death effect fires dozens of times, and
// a big shake plus a full-screen flash at that frequency is genuinely punishing for
// some people. matchMedia is read once and guarded, because it does not exist in
// the Node environment the tests run in.

let reducedMotion = false
try {
  reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
} catch {
  reducedMotion = false
}

/** Multiplier for every motion effect: 0 when the OS asks for reduced motion. */
export function motionScale(): number {
  return reducedMotion ? 0 : 1
}

let mag = 0
let time = 0
let duration = 0

let hitstop = 0

export function shake(pixels: number, ms: number): void {
  if (reducedMotion) return
  // Never let a small shake cancel a big one already in flight.
  if (pixels < mag && time < duration) return
  mag = pixels
  duration = ms / 1000
  time = 0
}

export function freeze(ms: number): void {
  // Hitstop stays even under reduced motion — it is a pause, not movement — but
  // shortened, since its whole job is to punctuate effects that are now muted.
  hitstop = Math.max(hitstop, (reducedMotion ? ms * 0.4 : ms) / 1000)
}

/** True while the simulation should be paused for hitstop. */
export function isFrozen(): boolean {
  return hitstop > 0
}

export function updateFx(dt: number): void {
  if (hitstop > 0) hitstop = Math.max(0, hitstop - dt)
  if (time < duration) time += dt
}

export function resetFx(): void {
  mag = 0
  time = 0
  duration = 0
  hitstop = 0
}

/** Current camera offset. Quadratic decay reads as an impact rather than a wobble. */
export function shakeOffset(): { x: number; y: number } {
  if (time >= duration || mag <= 0) return { x: 0, y: 0 }
  const t = 1 - time / duration
  const m = mag * t * t
  return { x: (Math.random() - 0.5) * 2 * m, y: (Math.random() - 0.5) * 2 * m }
}
