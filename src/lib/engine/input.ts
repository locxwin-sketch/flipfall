// One-button input. A counter the DOM increments and only the sim decrements, so a
// tap faster than the frame rate is never dropped.
//
// Gaming/contra/game.js used a boolean `pressed[k]` cleared once per frame, which
// collapses two presses in one frame into one. But its `if (!keys[k])` test was ALSO
// doing auto-repeat suppression, and that half must be kept — see guard 1.

const PRESS_CODES = new Set(['Space', 'ArrowUp', 'KeyW', 'Enter'])

/** Clamp on the queue. Two banked presses is a buffer; ten is a stuck key. */
const MAX_QUEUED = 2

let pressQueue = 0
let held = false
let enabled = true
const codesDown = new Set<string>()

function enqueue(): void {
  if (!enabled) return
  if (pressQueue < MAX_QUEUED) pressQueue++
}

/** Consume one press. Returns false when the queue is empty. */
export function pollPress(): boolean {
  if (pressQueue > 0) {
    pressQueue--
    return true
  }
  return false
}

export function isHeld(): boolean {
  return held
}

/** Exposed for the T01 acceptance check: must be observed > 1 under fast tapping. */
export function pressQueueDepth(): number {
  return pressQueue
}

/**
 * Portals require input disabled during commercial breaks (Poki states this
 * explicitly). Disabling also drops presses that would otherwise fire in a burst on
 * resume.
 */
export function setInputEnabled(value: boolean): void {
  enabled = value
  if (!value) {
    pressQueue = 0
    held = false
    codesDown.clear()
  }
}

export function clearQueue(): void {
  pressQueue = 0
}

export function bindInput(canvas: HTMLCanvasElement, onFirstGesture: () => void): () => void {
  let gestured = false
  const firstGesture = (): void => {
    if (gestured) return
    gestured = true
    onFirstGesture()
  }

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!PRESS_CODES.has(e.code)) return
    e.preventDefault() // Space scrolls the page otherwise.
    // Guard 1: OS auto-repeat fires ~30Hz from a held key. Combined with the
    // zero-net-drift property of evenly spaced flips, a held key would be
    // machine-precision level flight. Two checks because `e.repeat` is not
    // universally reliable across browsers and remapped keyboards.
    if (e.repeat) return
    if (codesDown.has(e.code)) return
    codesDown.add(e.code)
    held = true
    firstGesture()
    enqueue()
  }

  const onKeyUp = (e: KeyboardEvent): void => {
    if (!PRESS_CODES.has(e.code)) return
    e.preventDefault()
    codesDown.delete(e.code)
    if (codesDown.size === 0) held = false
  }

  // pointerdown covers mouse, touch and pen in one handler.
  const onPointerDown = (e: PointerEvent): void => {
    e.preventDefault()
    held = true
    firstGesture()
    enqueue()
  }

  const onPointerUp = (): void => {
    held = false
  }

  // Android long-press menu eats the second tap of a double-flip.
  const onContextMenu = (e: Event): void => e.preventDefault()

  const onBlur = (): void => {
    held = false
    codesDown.clear()
  }

  addEventListener('keydown', onKeyDown)
  addEventListener('keyup', onKeyUp)
  canvas.addEventListener('pointerdown', onPointerDown)
  addEventListener('pointerup', onPointerUp)
  addEventListener('pointercancel', onPointerUp)
  canvas.addEventListener('contextmenu', onContextMenu)
  addEventListener('blur', onBlur)

  return (): void => {
    removeEventListener('keydown', onKeyDown)
    removeEventListener('keyup', onKeyUp)
    canvas.removeEventListener('pointerdown', onPointerDown)
    removeEventListener('pointerup', onPointerUp)
    removeEventListener('pointercancel', onPointerUp)
    canvas.removeEventListener('contextmenu', onContextMenu)
    removeEventListener('blur', onBlur)
  }
}
