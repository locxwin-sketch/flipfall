// Best score persistence. Lives in engine/ rather than game/ because localStorage is
// a browser capability with side effects, and game/ must stay reproducible from a
// seed alone.
//
// Every access is wrapped: Safari private mode throws on `localStorage` access
// itself (not just on setItem), and a portal iframe with third-party storage blocked
// does the same. A game that cannot save a score still has to be playable, so every
// failure here degrades to "no saved best" and never propagates.

import type { Mode } from '@/constants/modes'

/**
 * Per mode, because the two modes are not comparable: Gauntlet opens at the speed
 * Endless spends a minute reaching, so one shared "best" would be won permanently
 * by whichever mode happens to score faster and would stop meaning anything in
 * either. Endless keeps the original unsuffixed key so nobody loses the best they
 * already have.
 */
function keyFor(mode: Mode): string {
  return mode === 'endless' ? 'flipfall.best.v1' : `flipfall.best.${mode}.v1`
}

function store(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** Returns 0 when nothing is stored, storage is unavailable, or the value is junk. */
export function loadBest(mode: Mode = 'endless'): number {
  try {
    const raw = store()?.getItem(keyFor(mode))
    if (raw === null || raw === undefined) return 0
    const n = Number(raw)
    // A hand-edited or corrupted entry must not poison the HUD with NaN or a
    // negative, both of which render and compare badly.
    if (!Number.isFinite(n) || n < 0) return 0
    return Math.floor(n)
  } catch {
    return 0
  }
}

export function saveBest(value: number, mode: Mode = 'endless'): void {
  if (!Number.isFinite(value) || value < 0) return
  try {
    store()?.setItem(keyFor(mode), String(Math.floor(value)))
  } catch {
    // Quota exceeded, or storage disabled mid-session. Nothing to do and nothing
    // worth telling the player about.
  }
}
