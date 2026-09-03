// Canvas palette. Mirrors src/style.css deliberately — see docs/ARCHITECTURE.md.
// Reading CSS custom properties per frame via getComputedStyle is a real cost, so
// the canvas gets its own copy as plain constants.
//
// Look: bright 8-bit outdoor platformer. Genre conventions only — sky, blocky
// clouds, stepped hills, brick ground. No traced sprites from any published game;
// game portals reject infringing art and that would sink a submission.
//
// Two rules the colours obey, and they are readability rules, not taste:
//   1. Hazards are the only near-black shapes in the frame. Nothing else competes.
//   2. The player carries a dark outline so it stays legible against bright sky,
//      green hills and brown brick alike.

export const PALETTE = {
  // Sky
  skyTop: '#5c94fc',
  skyBottom: '#8ab8ff',

  // Parallax, back to front
  hillFar: '#3a8a3a',
  hillFarDark: '#2f7030',
  hillNear: '#4cb04c',
  hillNearDark: '#3d8f3d',
  bush: '#37a137',
  bushDark: '#2a7d2a',
  cloud: '#ffffff',
  cloudShade: '#dce9ff',

  // Surfaces — brick
  brick: '#c8571b',
  brickDark: '#8f3d12',
  brickMortar: '#5c2709',
  brickTop: '#e07a3a',
  soil: '#a8481a',

  // Hazards — the only near-black in the frame
  hazard: '#1a1a24',
  hazardEdge: '#3d3d52',
  hazardTip: '#f2f2f7',

  // Player
  player: '#ffffff',
  playerCore: '#e63946',
  playerOutline: '#1a1a24',
  trail: 'rgba(255,255,255,0.30)',

  // UI
  hud: '#ffffff',
  hudShadow: '#1a1a24',
  hudMuted: '#dce9ff',
  hudDim: 'rgba(26,26,36,0.35)',
  flash: '#ffffff',
  vignette: 'rgba(180,20,40,0.30)',
} as const

export type PaletteKey = keyof typeof PALETTE
