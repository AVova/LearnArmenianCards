import { describe, it, expect } from 'vitest'
import { parseVocabularyFromYAML, vocabularyToYAML } from '../parser'
import { Word, Category, LibraryMeta } from '../types'

// ── helpers ────────────────────────────────────────────────────────────────

const META: LibraryMeta = { lastUpdateDate: '2024-01-01T00:00:00.000Z', lastDebugDateOffset: 0 }

function word(id: string, extra: Partial<Word> = {}): Word {
  return {
    id,
    word: id,
    translations: [{ lang: 'en', text: id }],
    ...extra,
  }
}

function cat(id: string, parentId: string | null = null, order = 0): Category {
  return { id, name: id, parentId, order }
}

// ── round-trip ─────────────────────────────────────────────────────────────

describe('round-trip', () => {
  it('words survive serialize → parse unchanged', () => {
    const words = [
      word('apple', { transcription: 'æpl', partOfSpeech: 'noun', metadata: { state: 'S', bloom: 0.4, cramProgress: 0.1, difficulty: 0.7, importance: 2 } }),
      word('run',   { partOfSpeech: 'verb', categoryIds: ['cat1'] }),
    ]
    const yaml = vocabularyToYAML(words, [], META)
    const result = parseVocabularyFromYAML(yaml)
    expect(result.words).toHaveLength(2)
    expect(result.words[0]).toMatchObject({ id: 'apple', transcription: 'æpl' })
    expect(result.words[0].metadata?.bloom).toBeCloseTo(0.4)
    expect(result.words[1].categoryIds).toEqual(['cat1'])
  })

  it('categories survive serialize → parse unchanged', () => {
    const categories = [cat('fruits'), cat('berries', 'fruits', 1)]
    const yaml = vocabularyToYAML([], categories, META)
    const result = parseVocabularyFromYAML(yaml)
    expect(result.categories).toHaveLength(2)
    expect(result.categories.find(c => c.id === 'berries')?.parentId).toBe('fruits')
  })

  it('meta fields survive round-trip', () => {
    const yaml = vocabularyToYAML([], [], META)
    const result = parseVocabularyFromYAML(yaml)
    expect(result.meta?.lastUpdateDate).toBe(META.lastUpdateDate)
    expect(result.meta?.lastDebugDateOffset).toBe(0)
  })

  it('vocabulary block survives round-trip', () => {
    const vocabMeta = { id: 'v1', name: 'Armenian', file: 'arm.yaml', learnedLang: 'Armenian', knownLang: 'English', showTranscription: true, createdAt: '2024-01-01T00:00:00.000Z' }
    const yaml = vocabularyToYAML([], [], META, vocabMeta)
    const result = parseVocabularyFromYAML(yaml)
    expect(result.vocabulary?.name).toBe('Armenian')
  })

  it('empty categories not written to YAML (no spurious key)', () => {
    const yaml = vocabularyToYAML([word('x')], [], META)
    expect(yaml).not.toContain('categories:')
  })
})

// ── migration ──────────────────────────────────────────────────────────────

describe('steeping → bloom migration', () => {
  it('renames steeping to bloom and preserves the value', () => {
    const yaml = `
words:
  - id: w1
    word: hello
    translations:
      - lang: en
        text: hello
    metadata:
      state: S
      steeping: 0.75
      cramProgress: 0
      difficulty: 1.0
`
    const result = parseVocabularyFromYAML(yaml)
    expect(result.words[0].metadata?.bloom).toBeCloseTo(0.75)
    expect((result.words[0].metadata as any).steeping).toBeUndefined()
  })

  it('does not modify words that already have bloom', () => {
    const yaml = `
words:
  - id: w1
    word: hello
    translations: []
    metadata:
      state: S
      bloom: 0.5
`
    const result = parseVocabularyFromYAML(yaml)
    expect(result.words[0].metadata?.bloom).toBeCloseTo(0.5)
  })
})

// ── legacy array-only format ───────────────────────────────────────────────

describe('legacy array-only format', () => {
  it('parses a plain YAML array as words', () => {
    const yaml = `
- id: w1
  word: cat
  translations:
    - lang: en
      text: cat
`
    const result = parseVocabularyFromYAML(yaml)
    expect(result.words).toHaveLength(1)
    expect(result.words[0].id).toBe('w1')
    expect(result.categories).toEqual([])
    expect(result.meta).toBeNull()
  })
})

// ── error handling ─────────────────────────────────────────────────────────

describe('error handling', () => {
  it('returns safe fallback for invalid YAML without throwing', () => {
    const result = parseVocabularyFromYAML('{ this is: [not valid yaml')
    expect(result.words).toEqual([])
    expect(result.categories).toEqual([])
    expect(result.meta).toBeNull()
    expect(result.vocabulary).toBeNull()
  })

  it('returns safe fallback for empty string', () => {
    const result = parseVocabularyFromYAML('')
    expect(result.words).toEqual([])
    expect(result.categories).toEqual([])
  })

  it('returns safe fallback for null-ish YAML (null document)', () => {
    const result = parseVocabularyFromYAML('~')  // YAML null
    expect(result.words).toEqual([])
    expect(result.categories).toEqual([])
  })
})

// ── meta field defaults ────────────────────────────────────────────────────

describe('meta field defaults', () => {
  it('lastDebugDateOffset defaults to 0 when absent', () => {
    const yaml = `
meta:
  lastUpdateDate: "2024-01-01T00:00:00.000Z"
words: []
`
    const result = parseVocabularyFromYAML(yaml)
    expect(result.meta?.lastDebugDateOffset).toBe(0)
  })

  it('meta is null when the meta key is absent', () => {
    const yaml = `words: []`
    expect(parseVocabularyFromYAML(yaml).meta).toBeNull()
  })
})
