// All shared data types. No logic here — pure type definitions.

export type Translation = {
  lang: string
  text: string
}

export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase' | 'other'

export type Category = {
  id: string
  name: string
  parentId: string | null
  order: number
}

/**
 * Word lifecycle state.
 * N → C → S → R → C → S → ...
 */
export type WordState = 'N' | 'C' | 'S' | 'R'

export type Metadata = {
  importance?: 1 | 2 | 3   // 1=normal, 2=important, 3=super important; default 1
  state?: WordState         // lifecycle state; default N
  bloom?: number            // B ∈ [0,1]; grows only in S state; stored as of library's lastUpdateDate
  cramProgress?: number     // C ∈ [0,1]; decays over time; stored as of library's lastUpdateDate
  difficulty?: number       // D ∈ [0,1]; default 1.0
}

/** Global library time anchor. S/C values in every Word are accurate as of lastUpdateDate + lastDebugDateOffset days. */
export type LibraryMeta = {
  lastUpdateDate: string         // ISO timestamp of last commit
  lastDebugDateOffset: number    // debug day offset active at commit time
}

export type Word = {
  id: string
  word: string
  transcription?: string
  translations: Translation[]
  metadata?: Metadata
  dateAdded?: string
  partOfSpeech?: PartOfSpeech
  categoryIds?: string[]
}

/** Per-vocabulary metadata stored in the global metadata.yaml index. */
export type VocabMeta = {
  id: string
  name: string
  file: string              // filename within the LangCards program folder
  learnedLang: string       // free text, e.g. "Armenian"
  knownLang: string         // free text, e.g. "English"
  showTranscription: boolean
  createdAt: string         // ISO timestamp
  wordCount?: number        // cached; updated on save
}

/** Root structure of the global metadata.yaml file. */
export type GlobalMeta = {
  version: number
  vocabs: VocabMeta[]
}
