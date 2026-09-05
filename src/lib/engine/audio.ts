// Zero audio files. Every sound is a synthesized oscillator, which is what keeps the
// bundle in the KB range — a portal requirement, not a stylistic choice. Structure
// ported from Gaming/contra/game.js; the master gain node is new.

let AC: AudioContext | null = null
let master: GainNode | null = null

/** Must be called from a user gesture — iOS will not start an AudioContext otherwise. */
export function initAudio(): void {
  if (AC) {
    void AC.resume().catch(() => {})
    return
  }
  try {
    AC = new AudioContext()
    master = AC.createGain()
    master.gain.value = 0.9
    master.connect(AC.destination)
  } catch {
    AC = null
    master = null
  }
}

/**
 * One assignment mutes everything. Portals require mute-on-ad-start, and this is
 * also called from loop.resume() — without the resume, the game goes silently mute
 * after the first ad.
 */
export function setMuted(muted: boolean): void {
  if (master) master.gain.value = muted ? 0 : 0.9
  if (!muted && AC?.state === 'suspended') void AC.resume().catch(() => {})
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide?: number): void {
  if (!AC || !master) return
  // OscillatorNode is one-shot by spec, so per-call allocation is correct here.
  const o = AC.createOscillator()
  const g = AC.createGain()
  o.type = type
  o.frequency.value = freq
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, AC.currentTime + dur)
  g.gain.value = vol
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur)
  o.connect(g)
  g.connect(master)
  o.start()
  o.stop(AC.currentTime + dur)
}

export const sfx = {
  flip: (): void => tone(420, 0.06, 'square', 0.05, 700),
  land: (): void => tone(180, 0.05, 'sine', 0.05),
  die: (): void => tone(300, 0.45, 'sawtooth', 0.11, 40),
  // Rising, short and quiet. It fires several times a second in a good run, so
  // anything longer or louder than the flip it accompanies becomes a nuisance fast.
  coin: (): void => tone(880, 0.07, 'square', 0.035, 1320),
  // Very short, very quiet, and high enough to sit above the flip without masking
  // it. A graze happens at the exact moment the player is busiest; the sound has to
  // register as "that was close" without competing for attention with the gap.
  graze: (): void => tone(1560, 0.04, 'sine', 0.03, 1980),
}
