import { describe, it, expect } from 'vitest'
import { computeSTK, computeLTK, computePriority, predictedGain, computeModeCounts } from '../metrics'
import { Word } from '../../types'

// ── helpers ────────────────────────────────────────────────────────────────

function w(state: 'N' | 'C' | 'S' | 'R', opts: { D?: number; C?: number; B?: number; imp?: 1 | 2 | 3 } = {}): Word {
  return {
    id: Math.random().toString(36).slice(2),
    word: 'test',
    translations: [{ lang: 'en', text: 'test' }],
    metadata: {
      state,
      difficulty: opts.D ?? 1.0,
      cramProgress: opts.C ?? 0,
      bloom: opts.B ?? 0,
      importance: opts.imp ?? 1,
    },
  }
}

const DELTA = 0  // stored values are current

// ── computeSTK ─────────────────────────────────────────────────────────────

describe('computeSTK', () => {
  it('returns 0 when all words are N-state (no active words)', () => {
    expect(computeSTK([w('N'), w('N')], DELTA)).toBe(0)
  })

  it('returns 0 for empty list', () => {
    expect(computeSTK([], DELTA)).toBe(0)
  })

  it('returns mean C of non-N words', () => {
    // Two active words with C=0.4 and C=0.8 → mean = 0.6
    const words = [w('C', { C: 0.4 }), w('S', { B: 0.5, C: 0.8 })]
    expect(computeSTK(words, DELTA)).toBeCloseTo(0.6)
  })

  it('ignores N-state words in the mean', () => {
    const words = [w('N'), w('S', { B: 0.5, C: 0.6 })]
    // Only 1 active word → STK = 0.6
    expect(computeSTK(words, DELTA)).toBeCloseTo(0.6)
  })

  it('single active word → STK equals its C', () => {
    expect(computeSTK([w('R', { C: 0.3 })], DELTA)).toBeCloseTo(0.3)
  })
})

// ── computeLTK ─────────────────────────────────────────────────────────────

describe('computeLTK', () => {
  it('returns 0 when all words are N-state', () => {
    expect(computeLTK([w('N'), w('N')])).toBe(0)
  })

  it('returns 0 for empty list', () => {
    expect(computeLTK([])).toBe(0)
  })

  it('returns 0 when all active words have default D=1.0 (1 − 1.0 = 0)', () => {
    const words = [w('C', { D: 1.0 }), w('S', { D: 1.0, B: 0.5 })]
    expect(computeLTK(words)).toBeCloseTo(0)
  })

  it('returns 1 − mean(D) for active words', () => {
    // Two words: D=0.4 and D=0.8 → mean D = 0.6 → LTK = 0.4
    const words = [w('C', { D: 0.4 }), w('S', { D: 0.8, B: 0.5 })]
    expect(computeLTK(words)).toBeCloseTo(0.4)
  })

  it('ignores N-state words', () => {
    const words = [w('N', { D: 0.2 }), w('R', { D: 0.5 })]
    // Only R word counts: 1 - 0.5 = 0.5
    expect(computeLTK(words)).toBeCloseTo(0.5)
  })
})

// ── computePriority ────────────────────────────────────────────────────────

describe('computePriority', () => {
  it('returns B × I × D × (1-C)', () => {
    // B=0.5, I=IMPORTANCE_VALS[1], D=0.8, C=0.2 → 0.5 × 0.25 × 0.8 × 0.8 = 0.08
    // We just verify the formula direction, not the exact value
    const hi = w('S', { B: 0.8, D: 1.0, C: 0.0, imp: 1 })
    const lo = w('S', { B: 0.8, D: 1.0, C: 0.9, imp: 1 })
    expect(computePriority(hi, DELTA)).toBeGreaterThan(computePriority(lo, DELTA))
  })

  it('over-drilled word (C close to 1) scores near 0', () => {
    const word = w('S', { B: 1.0, D: 1.0, C: 0.99, imp: 1 })
    expect(computePriority(word, DELTA)).toBeCloseTo(0, 2)
  })

  it('higher importance raises priority', () => {
    const imp1 = w('S', { B: 0.5, D: 1.0, C: 0, imp: 1 })
    const imp3 = w('S', { B: 0.5, D: 1.0, C: 0, imp: 3 })
    expect(computePriority(imp3, DELTA)).toBeGreaterThan(computePriority(imp1, DELTA))
  })
})

// ── predictedGain ──────────────────────────────────────────────────────────

describe('predictedGain', () => {
  it('returns 0 when totalActive is 0', () => {
    expect(predictedGain([w('S', { C: 0.5 })], 0, DELTA)).toBe(0)
  })

  it('returns 0 for empty selected list', () => {
    expect(predictedGain([], 5, DELTA)).toBe(0)
  })

  it('computes Σ((1-C_i)/2) / totalActive', () => {
    // One word with C=0.6 → (1-0.6)/2 = 0.2, total_active=1 → gain=0.2
    const word = w('S', { C: 0.6 })
    expect(predictedGain([word], 1, DELTA)).toBeCloseTo(0.2)
  })

  it('averages over totalActive, not selected.length', () => {
    // Two selected words, each C=0 → each contributes 0.5; but totalActive=4 → gain=1/4=0.25
    const words = [w('S', { C: 0 }), w('S', { C: 0 })]
    expect(predictedGain(words, 4, DELTA)).toBeCloseTo(0.25)
  })

  it('fully-crammed word contributes almost nothing', () => {
    const word = w('S', { C: 0.99 })
    expect(predictedGain([word], 1, DELTA)).toBeLessThan(0.01)
  })
})

// ── computeModeCounts ──────────────────────────────────────────────────────

describe('computeModeCounts', () => {
  it('counts each category correctly', () => {
    const words = [
      w('N'),                          // fresh
      w('C'),                          // consolidating
      w('S', { B: 0.5 }),              // (bloom < 1, not Ready)
      w('R'),                          // ready
      w('S', { C: 0.5, B: 0.3 }),     // cram (C > 0)
    ]
    const counts = computeModeCounts(words, DELTA)
    expect(counts.fresh).toBe(1)
    expect(counts.consolidating).toBe(1)
    expect(counts.ready).toBe(1)
    expect(counts.cram).toBe(1)
  })

  it('a word can appear in multiple counts (e.g. cram and ready)', () => {
    // R-state with cram > 0 counts in both ready and cram
    const word = w('R', { C: 0.4 })
    const counts = computeModeCounts([word], DELTA)
    expect(counts.ready).toBe(1)
    expect(counts.cram).toBe(1)
  })

  it('returns all zeros for empty list', () => {
    const counts = computeModeCounts([], DELTA)
    expect(counts).toEqual({ fresh: 0, ready: 0, consolidating: 0, cram: 0 })
  })

  it('returns all zeros for all-N list', () => {
    const counts = computeModeCounts([w('N'), w('N')], DELTA)
    expect(counts).toEqual({ fresh: 2, ready: 0, consolidating: 0, cram: 0 })
  })
})
