import { describe, it, expect, afterEach } from 'vitest'
import { loadBest, saveBest } from './storage'

// Vitest runs in node, where `localStorage` does not exist. That is not a gap in the
// test — it is the "storage unavailable" case the module has to survive, so the
// default (no stub installed) covers it directly.

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial))
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  }
}

function install(s: Storage | (() => never) | undefined): void {
  if (typeof s === 'function') {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: s })
  } else {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: s, writable: true })
  }
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage')
})

describe('best score persistence', () => {
  it('round-trips a score', () => {
    install(fakeStorage())
    saveBest(1234)
    expect(loadBest()).toBe(1234)
  })

  it('reports 0 when nothing has been stored', () => {
    install(fakeStorage())
    expect(loadBest()).toBe(0)
  })

  it('reports 0 when storage does not exist at all', () => {
    expect(loadBest()).toBe(0)
  })

  it('does not throw when storage does not exist at all', () => {
    expect(() => saveBest(50)).not.toThrow()
  })

  // Safari private mode and a storage-blocked portal iframe throw on the property
  // access itself, before any method is called.
  it('survives storage that throws on access', () => {
    install(() => {
      throw new DOMException('denied')
    })
    expect(loadBest()).toBe(0)
    expect(() => saveBest(50)).not.toThrow()
  })

  it('survives a storage that throws on write', () => {
    const s = fakeStorage()
    s.setItem = () => {
      throw new DOMException('QuotaExceededError')
    }
    install(s)
    expect(() => saveBest(50)).not.toThrow()
  })

  // A hand-edited entry must not reach the HUD as NaN or a negative.
  it.each([['nonsense'], ['NaN'], ['-5'], ['']])('rejects the junk value %o', (raw) => {
    install(fakeStorage({ 'flipfall.best.v1': raw }))
    expect(loadBest()).toBe(0)
  })

  it('floors a fractional stored value', () => {
    install(fakeStorage({ 'flipfall.best.v1': '42.9' }))
    expect(loadBest()).toBe(42)
  })

  it('ignores a negative or non-finite save', () => {
    install(fakeStorage())
    saveBest(100)
    saveBest(-1)
    saveBest(Number.NaN)
    expect(loadBest()).toBe(100)
  })
})
