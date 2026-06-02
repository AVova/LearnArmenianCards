// Serialisation: YAML ↔ {words, categories, meta}.
// The YAML format is the canonical on-disk format for vocabulary files.

import { Category, Word, LibraryMeta, VocabMeta } from './types'
import YAML from 'js-yaml'

export function parseVocabularyFromYAML(yaml: string): {
  words: Word[]
  categories: Category[]
  meta: LibraryMeta | null
  vocabulary: Partial<VocabMeta> | null
} {
  try {
    const data = YAML.load(yaml) as any
    const rawWords: any[] = Array.isArray(data?.words)
      ? data.words
      : Array.isArray(data) ? data : []
    // Migrate old 'steeping' field to 'bloom'
    const words: Word[] = rawWords.map((w: any) => {
      let word = w
      // Migrate old 'steeping' field to 'bloom'
      if (word?.metadata && word.metadata.bloom === undefined && word.metadata.steeping !== undefined) {
        const { steeping, ...rest } = word.metadata
        word = { ...word, metadata: { ...rest, bloom: steeping } }
      }
      // Strip plain-string items from translations when proper {lang,text} objects are present.
      // Some imported files store category tags as extra strings in the translations array.
      if (Array.isArray(word.translations)) {
        const hasObjects = word.translations.some((t: any) => t && typeof t === 'object' && t.text)
        if (hasObjects) {
          word = { ...word, translations: word.translations.filter((t: any) => t && typeof t === 'object' && t.text) }
        }
      }
      return word
    })
    const categories: Category[] = Array.isArray(data?.categories) ? data.categories : []
    const meta: LibraryMeta | null = data?.meta
      ? { lastUpdateDate: data.meta.lastUpdateDate, lastDebugDateOffset: data.meta.lastDebugDateOffset ?? 0 }
      : null
    const vocabulary: Partial<VocabMeta> | null = data?.vocabulary ?? null
    return { words, categories, meta, vocabulary }
  } catch (e) {
    console.error('parseVocabularyFromYAML error', e)
    return { words: [], categories: [], meta: null, vocabulary: null }
  }
}

export function vocabularyToYAML(
  words: Word[],
  categories: Category[],
  meta: LibraryMeta,
  vocabMeta?: VocabMeta,
): string {
  const data = {
    ...(vocabMeta ? { vocabulary: vocabMeta } : {}),
    meta,
    ...(categories.length > 0 ? { categories } : {}),
    words,
  }
  return YAML.dump(data, { lineWidth: -1, noRefs: true })
}


