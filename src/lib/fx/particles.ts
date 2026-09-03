// Pooled particle system. Fixed array, zero allocation in the loop.
//
// This lives under src/lib/fx/ and NOT src/lib/game/ for one reason: it uses
// Math.random. Particles are render-only and never feed back into simulation
// state, so randomness here cannot break replay determinism. The eslint rule that
// bans Math.random under src/lib/game/ is what keeps that boundary honest.

const MAX = 320

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  gravity: number
}

const pool: Particle[] = Array.from({ length: MAX }, () => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  life: 0,
  maxLife: 1,
  size: 0,
  color: '#fff',
  gravity: 0,
}))
let cursor = 0

function spawn(
  x: number,
  y: number,
  vx: number,
  vy: number,
  lifeMs: number,
  size: number,
  color: string,
  gravity = 0,
): void {
  // Ring buffer: oldest particle is recycled. Never allocates, never grows.
  const p = pool[cursor]
  cursor = (cursor + 1) % MAX
  p.x = x
  p.y = y
  p.vx = vx
  p.vy = vy
  p.life = lifeMs / 1000
  p.maxLife = p.life
  p.size = size
  p.color = color
  p.gravity = gravity
}

export function clearParticles(): void {
  for (const p of pool) p.life = 0
}

/** Radial burst — used for flips and deaths. */
export function burst(
  x: number,
  y: number,
  count: number,
  speed: number,
  lifeMs: number,
  color: string,
  size = 3,
  gravity = 0,
): void {
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.5
    const s = speed * (0.45 + Math.random() * 0.75)
    spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, lifeMs * (0.6 + Math.random() * 0.6), size, color, gravity)
  }
}

/** Directional spray — used for landings. */
export function spray(
  x: number,
  y: number,
  count: number,
  dirY: number,
  speed: number,
  lifeMs: number,
  color: string,
): void {
  for (let i = 0; i < count; i++) {
    const vx = (Math.random() - 0.5) * speed * 1.6
    const vy = dirY * speed * (0.3 + Math.random() * 0.7)
    spawn(x, y, vx, vy, lifeMs * (0.6 + Math.random() * 0.6), 2, color)
  }
}

/** A single fading square left behind the player. */
export function trail(x: number, y: number, size: number, lifeMs: number, color: string): void {
  spawn(x, y, 0, 0, lifeMs, size, color)
}

export function updateParticles(dt: number): void {
  for (const p of pool) {
    if (p.life <= 0) continue
    p.life -= dt
    if (p.life <= 0) continue
    p.vy += p.gravity * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
  }
}

/** Draws in world coordinates — call inside the camera transform. */
export function drawParticles(ctx: CanvasRenderingContext2D): void {
  for (const p of pool) {
    if (p.life <= 0) continue
    const t = p.life / p.maxLife
    ctx.globalAlpha = t * t
    ctx.fillStyle = p.color
    const s = Math.max(1, p.size * (0.4 + t * 0.6))
    ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), Math.round(s), Math.round(s))
  }
  ctx.globalAlpha = 1
}
