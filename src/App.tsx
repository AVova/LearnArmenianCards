// Root component. Owns all application state (words, categories, file handle, library meta).
// Delegates display to Library and exercise to Deck.
// All file I/O is coordinated here via tauri-storage (Tauri) or browser-storage (browser).
//
// Two runtime paths share the same handlers — IS_TAURI gates the I/O call:
//   Tauri  — vocabulary manager with ~/Documents/LangCards on disk
//   Browser — same UI, vocabulary manager backed by localStorage

import React, { useEffect, useMemo, useState } from 'react'
import { Category, GlobalMeta, LibraryMeta, VocabMeta, Word } from './lib/types'
import {
  ensureProgramFolder,
  readGlobalMeta,
  readVocabFile,
  writeVocabFile,
  upsertVocabInGlobalMeta,
  removeVocabFromGlobalMeta,
  exportVocabViaDialog,
} from './lib/tauri-storage'
import {
  readGlobalMetaBrowser,
  readVocabFileBrowser,
  writeVocabFileBrowser,
  upsertVocabInGlobalMetaBrowser,
  removeVocabBrowser,
  removeVocabFromGlobalMetaBrowser,
  exportVocabViaBrowser,
} from './lib/browser-storage'
import { parseVocabularyFromYAML, vocabularyToYAML } from './lib/parser'
import { defaultMetadata, computeBloom, computeC, computeCurrentState } from './lib/scheduler'
import { getSubtreeIds } from './lib/categoryUtils'
import { IS_TAURI } from './lib/platform'
import { useI18n } from './lib/i18n'
import Library from './components/Library'
import Deck from './components/Deck'
import VocabPicker from './components/VocabPicker'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function freshMeta(debugDaysOffset: number): LibraryMeta {
  return { lastUpdateDate: new Date().toISOString(), lastDebugDateOffset: debugDaysOffset }
}

export default function App() {
  const [words, setWords] = useState<Word[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [libraryMeta, setLibraryMeta] = useState<LibraryMeta>(() => freshMeta(0))
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [showDeck, setShowDeck] = useState(false)
  const [deckWords, setDeckWords] = useState<Word[] | null>(null)
  const [debugMode, setDebugMode] = useState(false)
  const [debugDaysOffset, setDebugDaysOffset] = useState(0)
  const [clockTick, setClockTick] = useState(0)

  // Vocab list + active vocab — shared between Tauri and browser modes
  const [vocabList, setVocabList] = useState<VocabMeta[]>(() => {
    if (!IS_TAURI) return readGlobalMetaBrowser().vocabs
    return []
  })
  const [activeVocabMeta, setActiveVocabMeta] = useState<VocabMeta | null>(null)
  // tauriReady: false until Tauri init completes; always true in browser (no async init needed)
  const [tauriReady, setTauriReady] = useState(!IS_TAURI)

  const { t } = useI18n()

  useEffect(() => {
    const id = setInterval(() => setClockTick(t => t + 1), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Tauri init: ensure program folder exists, load vocab list from disk
  useEffect(() => {
    if (!IS_TAURI) return
    ;(async () => {
      try {
        await ensureProgramFolder()
        const globalMeta: GlobalMeta = await readGlobalMeta()
        setVocabList(globalMeta.vocabs)
        setTauriReady(true)
      } catch (e) {
        console.error('Tauri init failed:', e)
        alert(`Storage initialisation failed:\n${e}\n\nCheck that ~/Documents exists and the app has file system access.`)
      }
    })()
  }, [])

  const { deltaDays, needsAnchorReset } = useMemo(() => {
    const realDelta  = (Date.now() - new Date(libraryMeta.lastUpdateDate).getTime()) / MS_PER_DAY
    const debugDelta = debugDaysOffset - libraryMeta.lastDebugDateOffset
    const total = Math.max(0, realDelta) + Math.max(0, debugDelta)
    return {
      deltaDays:        total < 1 / 24 ? 0 : total,
      needsAnchorReset: realDelta < 0 || debugDelta < 0,
    }
  }, [libraryMeta, debugDaysOffset, clockTick])

  useEffect(() => {
    if (deltaDays === 0 && !needsAnchorReset) return
    if (deltaDays > 0 && words.length > 0) {
      setWords(prev => prev.map(w => {
        const newB     = computeBloom(w, deltaDays)
        const newC     = computeC(w, deltaDays)
        const newState = computeCurrentState(w, deltaDays)
        const curB     = w.metadata?.bloom ?? 0
        const curC     = w.metadata?.cramProgress ?? 0
        const curState = w.metadata?.state ?? 'N'
        if (newB === curB && newC === curC && newState === curState) return w
        return { ...w, metadata: { ...w.metadata, state: newState, bloom: newB, cramProgress: newC } }
      }))
      setHasUnsavedChanges(true)
    }
    setLibraryMeta({ lastUpdateDate: new Date().toISOString(), lastDebugDateOffset: debugDaysOffset })
  }, [deltaDays, needsAnchorReset])  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save — same logic for both modes, only the I/O call differs
  useEffect(() => {
    if (!activeVocabMeta || !hasUnsavedChanges) return

    const timeout = window.setTimeout(async () => {
      setAutoSaving(true)
      try {
        const yaml = vocabularyToYAML(words, categories, libraryMeta, activeVocabMeta)
        if (IS_TAURI) {
          await writeVocabFile(activeVocabMeta.file, yaml)
          const updated = { ...activeVocabMeta, wordCount: words.length }
          setActiveVocabMeta(updated)
          setVocabList(prev => prev.map(v => v.id === updated.id ? updated : v))
          await upsertVocabInGlobalMeta(updated)
        } else {
          writeVocabFileBrowser(activeVocabMeta.file, yaml)
          const updated = { ...activeVocabMeta, wordCount: words.length }
          setActiveVocabMeta(updated)
          setVocabList(prev => prev.map(v => v.id === updated.id ? updated : v))
          upsertVocabInGlobalMetaBrowser(updated)
        }
        setHasUnsavedChanges(false)
      } catch (e) {
        console.error('Auto-save failed:', e)
      } finally {
        setAutoSaving(false)
      }
    }, 1500)

    return () => window.clearTimeout(timeout)
  }, [libraryMeta, activeVocabMeta, hasUnsavedChanges])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── word handlers ──────────────────────────────────────────

  const handleAddWord = (word: Word) => {
    setWords(prev => [...prev, word])
    setHasUnsavedChanges(true)
  }

  const handleEditWord = (updatedWord: Word) => {
    setWords(prev => prev.map(w => w.id === updatedWord.id ? updatedWord : w))
    setHasUnsavedChanges(true)
  }

  const handleDeleteWord = (id: string) => {
    setWords(prev => prev.filter(w => w.id !== id))
    setHasUnsavedChanges(true)
  }

  // ── category handlers ──────────────────────────────────────

  const handleAddCategory = (cat: Category) => {
    setCategories(prev => [...prev, cat])
    setHasUnsavedChanges(true)
  }

  const handleUpdateCategory = (updated: Category) => {
    setCategories(prev => prev.map(c => c.id === updated.id ? updated : c))
    setHasUnsavedChanges(true)
  }

  const handleDeleteCategory = (id: string) => {
    const idsToRemove = new Set(getSubtreeIds(id, categories))
    setCategories(prev => prev.filter(c => !idsToRemove.has(c.id)))
    setWords(prev => prev.map(w => ({
      ...w,
      categoryIds: (w.categoryIds ?? []).filter(cid => !idsToRemove.has(cid)),
    })))
    setHasUnsavedChanges(true)
  }

  // ── vocabulary handlers (unified Tauri + browser) ──────────

  const handleVocabSelect = async (vocab: VocabMeta) => {
    try {
      const yaml = IS_TAURI ? await readVocabFile(vocab.file) : readVocabFileBrowser(vocab.file)
      const { words: loadedWords, categories: loadedCategories, meta } = parseVocabularyFromYAML(yaml)
      setWords(loadedWords)
      setCategories(loadedCategories)
      setLibraryMeta(meta ?? freshMeta(0))
      setActiveVocabMeta(vocab)
      setHasUnsavedChanges(false)
    } catch (e) {
      console.error('Failed to load vocabulary:', e)
      alert('Failed to open vocabulary file.')
    }
  }

  const handleVocabCreate = async (vocab: VocabMeta, importedYaml?: string) => {
    try {
      const yaml = importedYaml ?? vocabularyToYAML([], [], freshMeta(0), vocab)
      if (IS_TAURI) {
        await writeVocabFile(vocab.file, yaml)
        await upsertVocabInGlobalMeta(vocab)
      } else {
        writeVocabFileBrowser(vocab.file, yaml)
        upsertVocabInGlobalMetaBrowser(vocab)
      }
      setVocabList(prev => [...prev.filter(v => v.id !== vocab.id), vocab])

      if (importedYaml) {
        const { words: w, categories: c, meta } = parseVocabularyFromYAML(importedYaml)
        setWords(w); setCategories(c); setLibraryMeta(meta ?? freshMeta(0))
      } else {
        setWords([]); setCategories([]); setLibraryMeta(freshMeta(0))
      }
      setActiveVocabMeta(vocab)
      setHasUnsavedChanges(false)
    } catch (e) {
      console.error('Failed to create vocabulary:', e)
      alert(`Failed to create vocabulary.\n${e}`)
    }
  }

  const handleVocabDelete = async (vocab: VocabMeta) => {
    try {
      if (IS_TAURI) {
        await removeVocabFromGlobalMeta(vocab.id)
      } else {
        removeVocabBrowser(vocab.file)
        removeVocabFromGlobalMetaBrowser(vocab.id)
      }
      setVocabList(prev => prev.filter(v => v.id !== vocab.id))
    } catch (e) {
      console.error('Failed to delete vocabulary:', e)
    }
  }

  const handleVocabUpdate = async (updated: VocabMeta) => {
    try {
      const yaml = IS_TAURI ? await readVocabFile(updated.file) : readVocabFileBrowser(updated.file)
      const { words: w, categories: c, meta } = parseVocabularyFromYAML(yaml)
      const newYaml = vocabularyToYAML(w, c, meta ?? freshMeta(0), updated)
      if (IS_TAURI) {
        await writeVocabFile(updated.file, newYaml)
        await upsertVocabInGlobalMeta(updated)
      } else {
        writeVocabFileBrowser(updated.file, newYaml)
        upsertVocabInGlobalMetaBrowser(updated)
      }
      setVocabList(prev => prev.map(v => v.id === updated.id ? updated : v))
      if (activeVocabMeta?.id === updated.id) setActiveVocabMeta(updated)
    } catch (e) {
      console.error('Vocab update failed:', e)
      alert('Failed to update vocabulary.')
    }
  }

  const handleExportVocabFromList = async (vocab: VocabMeta) => {
    try {
      const yaml = IS_TAURI ? await readVocabFile(vocab.file) : readVocabFileBrowser(vocab.file)
      if (IS_TAURI) {
        await exportVocabViaDialog(yaml, vocab.file)
      } else {
        exportVocabViaBrowser(yaml, vocab.name)
      }
    } catch (e) {
      console.error('Export failed:', e)
      alert('Failed to export vocabulary.')
    }
  }

  // ── exercise handlers ──────────────────────────────────────

  const mergeUpdatedWords = (updatedWords: Word[]) => {
    if (deckWords) {
      const map = new Map(updatedWords.map(w => [w.id, w]))
      setWords(prev => prev.map(w => map.get(w.id) ?? w))
    } else {
      setWords(updatedWords)
    }
  }

  const commitMeta = () => setLibraryMeta(freshMeta(debugDaysOffset))

  const handleDeckClose = (updatedWords: Word[]) => {
    mergeUpdatedWords(updatedWords)
    commitMeta()
    setHasUnsavedChanges(true)
    setShowDeck(false)
    setDeckWords(null)
  }

  const handlePrepareNew = (updatedWords: Word[]) => {
    mergeUpdatedWords(updatedWords)
    if (deckWords) setDeckWords(updatedWords)
    commitMeta()
    setHasUnsavedChanges(true)
  }

  const handleExerciseSelected = (selected: Word[]) => {
    setDeckWords(selected)
    setShowDeck(true)
  }

  const handleResetAllWords = () => {
    if (!window.confirm(t('app.resetConfirm'))) return
    setWords(prev => prev.map(w => ({ ...w, dateAdded: new Date().toISOString(), metadata: defaultMetadata() })))
    setDebugDaysOffset(0)
    setLibraryMeta(freshMeta(0))
    setHasUnsavedChanges(true)
  }

  // ── render ─────────────────────────────────────────────────

  const showPicker = tauriReady && activeVocabMeta === null

  if (showPicker) {
    return (
      <VocabPicker
        vocabList={vocabList}
        onSelect={handleVocabSelect}
        onCreate={handleVocabCreate}
        onUpdate={handleVocabUpdate}
        onDelete={handleVocabDelete}
        onExport={handleExportVocabFromList}
      />
    )
  }

  const saveStatus = autoSaving ? 'saving' : hasUnsavedChanges ? 'unsaved' : null

  return (
    <div style={{ fontFamily: 'Inter, system-ui, Arial', minHeight: '100vh' }}>
      <Library
        words={words}
        categories={categories}
        onAddWord={handleAddWord}
        onEditWord={handleEditWord}
        onDeleteWord={handleDeleteWord}
        onAddCategory={handleAddCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
        onExerciseSelected={handleExerciseSelected}
        onExercise={() => { setDeckWords(null); setShowDeck(true) }}
        deltaDays={deltaDays}
        debugMode={debugMode}
        vocabName={activeVocabMeta?.name}
        onExitToMenu={() => {
          setWords([]); setCategories([]); setActiveVocabMeta(null)
        }}
        debugDaysOffset={debugDaysOffset}
        onDebugToggle={() => { if (debugMode) setDebugDaysOffset(0); setDebugMode(m => !m) }}
        onDebugDaysChange={setDebugDaysOffset}
        onResetAllWords={handleResetAllWords}
        saveStatus={saveStatus}
        learnedLang={activeVocabMeta?.learnedLang}
        knownLang={activeVocabMeta?.knownLang}
        showTranscription={activeVocabMeta?.showTranscription ?? true}
      />

      {showDeck && (
        <Deck
          words={deckWords ?? words}
          categories={categories}
          onClose={handleDeckClose}
          onPrepareNew={handlePrepareNew}
          skipSetup={!!deckWords}
          deltaDays={deltaDays}
          learnedLang={activeVocabMeta?.learnedLang}
          knownLang={activeVocabMeta?.knownLang}
        />
      )}
    </div>
  )
}
