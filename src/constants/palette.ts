// Canvas palette. Mirrors src/style.css deliberately — see docs/ARCHITECTURE.md.
// Reading CSS custom properties per frame via getComputedStyle is a real cost, so
// the canvas gets its own copy as plain constants.

export const PALETTE = {
  bg: '#0b0b0f',
  surface: '#17171d',
  player: '#f4f4f5',
  playerTrail: '#a1a1aa',
  pad: '#3f3f46',
  padEdge: '#52525b',
  hazard: '#f43f5e',
  hazardEdge: '#fb7185',
  hud: '#e4e4e7',
  hudMuted: '#71717a',
  flash: '#ffffff',
} as const

export type PaletteKey = keyof typeof PALETTE
