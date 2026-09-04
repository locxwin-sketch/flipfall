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

  // Slime. Three values because one flat tone reads as paint: bright is the fresh
  // spray, mid is the mass, dark is what has been on the lens longest.
  //
  // Acid yellow-green, NOT a natural green, and that is forced rather than chosen.
  // The backdrop is full of greens — hills at #4cb04c, bushes at #37a137 — and every
  // believable slime colour lands on top of one of them: emerald measures 32 from
  // hillFar, forest green 40 from bushDark. Shifting hard toward yellow is the only
  // way green debris stays visible over a green world.
  slime: '#8ee62b',
  slimeBright: '#ccff33',
  slimeDark: '#5a9e00',
  slimeFilm: 'rgba(110,210,30,0.44)',

  // Piggy-bank burst. The alternate death: the pig is a bank, not a body. Gold is
  // warm against this sky where red went purple, and the confetti spread is picked
  // to miss the sky-blue and hill-green already in the frame.
  coin: '#ffd23f',
  coinBright: '#fff3a0',
  // #e0921a measured 40 from brickTop — coins landing on the floor half-vanished.
  coinDark: '#c9a015',
  // Pale, not banknote-green: #7dbf6a sat directly on top of hillNear #4cb04c and
  // the flecks vanished the moment they drifted over a hill. Light enough to read
  // against both the hills and the sky.
  note: '#dff0c8',
  noteDark: '#a8c98a',
  confettiA: '#ff4d6d',
  confettiB: '#4dd2ff',
  confettiC: '#c77dff',
  confettiD: '#ffa14d',

  // UI
  hud: '#ffffff',
  hudShadow: '#1a1a24',
  hudMuted: '#dce9ff',
  hudDim: 'rgba(26,26,36,0.35)',
  flash: '#ffffff',
  vignette: 'rgba(180,20,40,0.30)',
  /** Heavier wash under the splatter, so the frame itself reads as slimed. */
  vignetteSlime: 'rgba(60,120,10,0.52)',
  /** Gold equivalents, for the coins death. Lighter: a party, not an injury. */
  // Amber rather than yellow. Yellow over this blue sky is its near-complement and
  // neutralises to grey — the wash read as haze instead of as a hit.
  goldFilm: 'rgba(255,138,32,0.46)',
  vignetteCoins: 'rgba(190,110,20,0.45)',
} as const

export type PaletteKey = keyof typeof PALETTE
