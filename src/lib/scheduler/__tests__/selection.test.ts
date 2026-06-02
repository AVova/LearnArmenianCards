import { describe, it, expect } from 'vitest'
import {
  selectFresh, selectReady, selectConsolidating, selectCram,
  selectMostSuited, selectWords,
} from '../selection'
import { Word } from '../../types'

// ── helpers ────────────────────────────────────────────────────────────────

function w(id: string, state: 'N' | 'C' | 'S' | 'R', extra: Partial<NonNullable<Word['metadata']>> = {}): Word {
  return {
    id,
    word: id,
    translations: [{ lang: 'en', text: id }],
    metadata: { state, bloom: 0, cramProgress: 0, difficulty: 1.0, importance: 1, ...extra },
  }
}

const DELTA = 0  // no time passing — stored values are current

// ── selectFresh ────────────────────────────────────────────────────────────

describe('selectFresh', () => {
  it('returns only N-state words', () => {
    const words = [w('a', 'N'), w('b', 'C'), w('c', 'S', { bloom: 0.5 }), w('d', 'R')]
    const result = selectFresh(words, 10)
    expect(result.map(x => x.id)).toEqual(['a'])
  })

  it('respects count limit', () => {
    const words = [w('a', 'N'), w('b', 'N'), w('c', 'N'), w('d', 'N'), w('e', 'N')]
    expect(selectFresh(words, 3)).toHaveLength(3)
  })

  it('returns all when count >= available', () => {
    const words = [w('a', 'N'), w('b', 'N')]
    expect(selectFresh(words, 10)).toHaveLength(2)
  })

  it('returns [] for empty input', () => {
    expect(selectFresh([], 5)).toEqual([])
  })

  it('returns [] when no N-state words', () => {
    expect(selectFresh([w('a', 'C'), w('b', 'R')], 5)).toEqual([])
  })

  it('output is a permutation of the matching words', () => {
    const words = Array.from({ length: 8 }, (_, i) => w(`w${i}`, 'N'))
    const result = selectFresh(words, 8)
    expect(result.map(x => x.id).sort()).toEqual(words.map(x => x.id).sort())
  })
})

// ── selectReady ────────────────────────────────────────────────────────────

describe('selectReady', () => {
  it('returns only R-state words', () => {
    const words = [w('a', 'N'), w('b', 'C'), w('c', 'S', { bloom: 0.5 }), w('d', 'R')]
    const result = selectReady(words, 10, DELTA)
    expect(result.map(x => x.id)).toEqual(['d'])
  })

  it('also returns S-state words whose bloom has reached 1.0', () => {
    const words = [w('a', 'S', { bloom: 1.0 }), w('b', 'S', { bloom: 0.5 })]
    const result = selectReady(words, 10, DELTA)
    expect(result.map(x => x.id)).toContain('a')
    expect(result.map(x => x.id)).not.toContain('b')
  })

  it('respects count limit', () => {
    const words = Array.from({ length: 6 }, (_, i) => w(`r${i}`, 'R'))
    expect(selectReady(words, 4, DELTA)).toHaveLength(4)
  })

  it('returns [] for empty input', () => {
    expect(selectReady([], 5, DELTA)).toEqual([])
  })
})

// ── selectConsolidating ────────────────────────────────────────────────────

describe('selectConsolidating', () => {
  it('returns only C-state words', () => {
    const words = [w('a', 'N'), w('b', 'C'), w('c', 'C'), w('d', 'R')]
    const result = selectConsolidating(words, 10)
    expect(result.map(x => x.id).sort()).toEqual(['b', 'c'])
  })

  it('respects count limit', () => {
    const words = Array.from({ length: 5 }, (_, i) => w(`c${i}`, 'C'))
    expect(selectConsolidating(words, 2)).toHaveLength(2)
  })

  it('returns [] when no C-state words', () => {
    expect(selectConsolidating([w('a', 'N'), w('b', 'R')], 5)).toEqual([])
  })

  it('returns [] for empty input', () => {
    expect(selectConsolidating([], 5)).toEqual([])
  })
})

// ── selectCram ─────────────────────────────────────────────────────────────

describe('selectCram', () => {
  it('returns only words with C > 0', () => {
    const words = [
      w('a', 'S', { cramProgress: 0.6 }),
      w('b', 'S', { cramProgress: 0 }),
      w('c', 'R', { cramProgress: 0.3 }),
    ]
    const result = selectCram(words, 10, DELTA)
    expect(result.map(x => x.id).sort()).toEqual(['a', 'c'])
  })

  it('sorts by C descending', () => {
    const words = [
      w('low',  'S', { cramProgress: 0.2 }),
      w('high', 'S', { cramProgress: 0.8 }),
      w('mid',  'S', { cramProgress: 0.5 }),
    ]
    const result = selectCram(words, 10, DELTA)
    expect(result[0].id).toBe('high')
    expect(result[1].id).toBe('mid')
    expect(result[2].id).toBe('low')
  })

  it('respects count limit', () => {
    const words = Array.from({ length: 5 }, (_, i) =>
      w(`w${i}`, 'S', { cramProgress: 0.1 * (i + 1) }),
    )
    expect(selectCram(words, 3, DELTA)).toHaveLength(3)
  })

  it('returns [] when no words have C > 0', () => {
    expect(selectCram([w('a', 'N'), w('b', 'C')], 5, DELTA)).toEqual([])
  })

  it('returns [] for empty input', () => {
    expect(selectCram([], 5, DELTA)).toEqual([])
  })
})

// ── selectMostSuited ───────────────────────────────────────────────────────

describe('selectMostSuited', () => {
  it('returns top-N words by priority (B×I×D×(1-C))', () => {
    // high bloom, no cram → high priority
    const hi = w('hi', 'S', { bloom: 0.9, cramProgress: 0, importance: 1, difficulty: 1.0 })
    // fully crammed → low priority (1-C≈0)
    const lo = w('lo', 'S', { bloom: 0.9, cramProgress: 0.99, importance: 1, difficulty: 1.0 })
    const result = selectMostSuited([lo, hi], 1, DELTA)
    expect(result[0].id).toBe('hi')
  })

  it('respects count limit', () => {
    const words = Array.from({ length: 8 }, (_, i) =>
      w(`w${i}`, 'S', { bloom: 0.5 }),
    )
    expect(selectMostSuited(words, 3, DELTA)).toHaveLength(3)
  })

  it('returns all words when count >= length', () => {
    const words = [w('a', 'S', { bloom: 0.3 }), w('b', 'S', { bloom: 0.7 })]
    expect(selectMostSuited(words, 10, DELTA)).toHaveLength(2)
  })

  it('returns [] for empty input', () => {
    expect(selectMostSuited([], 5, DELTA)).toEqual([])
  })
})

// ── selectWords (dispatch) ─────────────────────────────────────────────────

describe('selectWords', () => {
  const words = [
    w('n1', 'N'),
    w('c1', 'C'),
    w('s1', 'S', { bloom: 0.5 }),
    w('r1', 'R'),
    w('cram1', 'S', { cramProgress: 0.5 }),
  ]

  it('fresh → selectFresh', () => {
    const r = selectWords(words, 'fresh', 10, DELTA)
    expect(r.every(x => x.metadata?.state === 'N')).toBe(true)
  })

  it('consolidating → selectConsolidating', () => {
    const r = selectWords(words, 'consolidating', 10, DELTA)
    expect(r.every(x => x.metadata?.state === 'C')).toBe(true)
  })

  it('ready → selectReady', () => {
    const r = selectWords(words, 'ready', 10, DELTA)
    expect(r.every(x => ['R', 'S'].includes(x.metadata?.state ?? ''))).toBe(true)
  })

  it('cram → selectCram', () => {
    const r = selectWords(words, 'cram', 10, DELTA)
    expect(r.every(x => (x.metadata?.cramProgress ?? 0) > 0)).toBe(true)
  })

  it('smart → selectMostSuited (returns all matching)', () => {
    const r = selectWords(words, 'smart', 10, DELTA)
    expect(r.length).toBeGreaterThan(0)
  })
})

// ── shuffle (via selectFresh output) ──────────────────────────────────────

describe('shuffle (internal, tested via selectFresh)', () => {
  it('output is a permutation — same ids, no duplicates', () => {
    const words = Array.from({ length: 20 }, (_, i) => w(`w${i}`, 'N'))
    const result = selectFresh(words, 20)
    expect(result).toHaveLength(20)
    expect(result.map(x => x.id).sort()).toEqual(words.map(x => x.id).sort())
  })
})
