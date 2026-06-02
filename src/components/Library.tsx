// Vocabulary table with four view modes (flat, grammar, A–Z, custom category tree).
// Manages focus, selection, and bulk actions. Delegates row rendering to LibraryRow
// and bulk toolbar to LibraryBulkBar.

import React, { useMemo, useReducer, useRef, useState } from 'react'
import { Category, PartOfSpeech, Word } from '../lib/types'
import { useI18n } from '../lib/i18n'
import { IS_TAURI } from '../lib/platform'
import { buildCategoryTree, getSubtreeIds } from '../lib/categoryUtils'
import { selectionReducer, initialSelectionState } from '../lib/selectionReducer'
import { Button } from '../ui'
import Editor from './Editor'
import LanguagePicker from './LanguagePicker'
import CategoryTbodies from './CategoryTree'
import { FlatItem, ViewMode, RowProps, POS_ORDER, POS_LABELS, WordRow, GroupHeaderRow, FlatTbody, GrammarTbody, AlphabetTbody } from './LibraryRow'
import { BulkActionBar, POS_OPTIONS } from './LibraryBulkBar'
import HelpModal from './HelpModal'
import ConfirmDialog from './ConfirmDialog'

export type { FlatItem, ViewMode }

type LibraryProps = {
  words: Word[]
  categories: Category[]
  onAddWord: (word: Word) => void
  onEditWord: (word: Word) => void
  onDeleteWord: (id: string) => void
  onAddCategory: (cat: Category) => void
  onUpdateCategory: (cat: Category) => void
  onDeleteCategory: (id: string) => void
  onExerciseSelected?: (words: Word[]) => void
  onExercise?: () => void
  deltaDays: number
  debugMode: boolean
  // sticky header controls
  vocabName?: string
  onExitToMenu?: () => void
  debugDaysOffset: number
  onDebugToggle: () => void
  onDebugDaysChange: (n: number) => void
  onResetAllWords: () => void
  saveStatus?: 'saving' | 'unsaved' | null
  learnedLang?: string
  knownLang?: string
  showTranscription?: boolean
}

// ── flat item computation ──────────────────────────────────

function computeFlatItems(
  words: Word[], viewMode: ViewMode, categories: Category[],
  prefixLen: 1 | 2, collapsedGroups: Set<string>, categoryCollapsed: Set<string>
): FlatItem[] {
  if (viewMode === 'flat') return words.map(w => ({ word: w, instanceId: w.id, categoryId: null, depth: 0 }))

  if (viewMode === 'grammar') {
    const result: FlatItem[] = []
    POS_ORDER.forEach(key => {
      if (!collapsedGroups.has(key))
        words.filter(w => (w.partOfSpeech ?? '__none__') === key)
          .forEach(w => result.push({ word: w, instanceId: w.id, categoryId: null, depth: 0 }))
    })
    return result
  }

  if (viewMode === 'alphabet') {
    const grouped = new Map<string, Word[]>()
    words.forEach(w => {
      const k = (w.word || '').slice(0, prefixLen).toUpperCase() || '?'
      if (!grouped.has(k)) grouped.set(k, [])
      grouped.get(k)!.push(w)
    })
    const result: FlatItem[] = []
    Array.from(grouped.keys()).sort().forEach(k => {
      if (!collapsedGroups.has(`alpha-${k}`))
        grouped.get(k)!.forEach(w => result.push({ word: w, instanceId: w.id, categoryId: null, depth: 0 }))
    })
    return result
  }

  // custom view — DFS, children before direct words
  const result: FlatItem[] = []
  function traverse(nodes: ReturnType<typeof buildCategoryTree>, depth: number) {
    nodes.forEach(node => {
      if (!categoryCollapsed.has(node.category.id)) {
        traverse(node.children, depth + 1)
        words.filter(w => (w.categoryIds ?? []).includes(node.category.id))
          .forEach(w => result.push({
            word: w,
            instanceId: `${w.id}:${node.category.id}`,
            categoryId: node.category.id,
            depth,
          }))
      }
    })
  }
  traverse(buildCategoryTree(categories), 0)
  words.filter(w => !w.categoryIds || w.categoryIds.length === 0)
    .forEach(w => result.push({ word: w, instanceId: `${w.id}:__uncategorized__`, categoryId: null, depth: 0 }))
  return result
}

// ── Library component ──────────────────────────────────────

export default function Library({
  words, categories,
  onAddWord, onEditWord, onDeleteWord,
  onAddCategory, onUpdateCategory, onDeleteCategory,
  onExerciseSelected,
  onExercise,
  deltaDays, debugMode,
  vocabName, onExitToMenu,
  debugDaysOffset, onDebugToggle, onDebugDaysChange, onResetAllWords,
  saveStatus,
  learnedLang, knownLang, showTranscription = true,
}: LibraryProps) {
  const [viewMode, setViewMode]               = useState<ViewMode>('flat')
  const [alphabetPrefixLen, setAlphabetPrefixLen] = useState<1 | 2>(1)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [categoryCollapsed, setCategoryCollapsed] = useState<Set<string>>(new Set())
  const [sel, dispatchSel]                    = useReducer(selectionReducer, undefined, initialSelectionState)
  const [activePopover, setActivePopover]     = useState<'pos' | 'attach' | 'detach' | null>(null)
  const [editorOpen, setEditorOpen]           = useState(false)
  const [editingWord, setEditingWord]         = useState<Word | undefined>(undefined)
  const [hoveredRowId, setHoveredRowId]       = useState<string | null>(null)
  const [showHelp, setShowHelp]               = useState(false)
  const [pendingDelete, setPendingDelete]     = useState<{ message: string; onConfirm: () => void } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { focusAnchor, focusEnd, selectedInstanceIds } = sel

  // ── computed ─────────────────────────────────────────────

  const flatItems = useMemo(
    () => computeFlatItems(words, viewMode, categories, alphabetPrefixLen, collapsedGroups, categoryCollapsed),
    [words, viewMode, categories, alphabetPrefixLen, collapsedGroups, categoryCollapsed]
  )

  const { focusedInstanceIds, focusedWordIds } = useMemo(() => {
    if (focusAnchor === null) return { focusedInstanceIds: new Set<string>(), focusedWordIds: new Set<string>() }
    const from = Math.min(focusAnchor, focusEnd ?? focusAnchor)
    const to   = Math.max(focusAnchor, focusEnd ?? focusAnchor)
    const iids = new Set<string>()
    const wids = new Set<string>()
    for (let i = from; i <= to; i++) {
      if (flatItems[i]) { iids.add(flatItems[i].instanceId); wids.add(flatItems[i].word.id) }
    }
    return { focusedInstanceIds: iids, focusedWordIds: wids }
  }, [focusAnchor, focusEnd, flatItems])

  const selectedWordIds = useMemo(
    () => new Set([...selectedInstanceIds].map(id => id.split(':')[0])),
    [selectedInstanceIds]
  )
  const selectedWords = useMemo(
    () => words.filter(w => selectedWordIds.has(w.id)),
    [words, selectedWordIds]
  )
  const commonCategoryIds = useMemo(() => {
    if (selectedWords.length === 0) return []
    const first = selectedWords[0].categoryIds ?? []
    return selectedWords.slice(1).reduce<string[]>(
      (acc, w) => acc.filter(id => (w.categoryIds ?? []).includes(id)),
      [...first]
    )
  }, [selectedWords])

  // ── collapse all ─────────────────────────────────────────

  const allGroupKeys = useMemo(() => {
    if (viewMode === 'grammar')  return POS_ORDER.filter(k => words.some(w => (w.partOfSpeech ?? '__none__') === k))
    if (viewMode === 'alphabet') {
      const keys = new Set<string>()
      words.forEach(w => keys.add(`alpha-${(w.word || '').slice(0, alphabetPrefixLen).toUpperCase() || '?'}`))
      return Array.from(keys)
    }
    if (viewMode === 'custom') return categories.map(c => c.id)
    return []
  }, [viewMode, words, categories, alphabetPrefixLen])

  const allCollapsed = allGroupKeys.length > 0 && allGroupKeys.every(k =>
    viewMode === 'custom' ? categoryCollapsed.has(k) : collapsedGroups.has(k)
  )

  const handleCollapseAll = () => {
    if (viewMode === 'custom') {
      if (allCollapsed) setCategoryCollapsed(new Set())
      else setCategoryCollapsed(new Set(categories.map(c => c.id)))
    } else {
      if (allCollapsed) setCollapsedGroups(new Set())
      else setCollapsedGroups(new Set(allGroupKeys as string[]))
    }
  }

  // ── editor ────────────────────────────────────────────────

  const { t } = useI18n()
  const openAdd  = () => { setEditingWord(undefined); setEditorOpen(true) }
  const openEdit = (w: Word) => { setEditingWord(w); setEditorOpen(true) }
  const closeEditor    = () => { setEditorOpen(false); setEditingWord(undefined) }
  const handleSaveWord = (w: Word) => { editingWord ? onEditWord(w) : onAddWord(w); closeEditor() }
  const handleDeleteWord = (id: string) => {
    setPendingDelete({
      message: t('library.deleteWord'),
      onConfirm: () => {
        onDeleteWord(id)
        const toRemove = [...sel.selectedInstanceIds].filter(iid => iid.startsWith(id + ':') || iid === id)
        dispatchSel({ type: 'REMOVE_INSTANCE_IDS', ids: toRemove })
        setPendingDelete(null)
      },
    })
  }

  // ── focus ─────────────────────────────────────────────────

  const focusItem = (idx: number, shiftHeld: boolean) => {
    dispatchSel({ type: 'FOCUS', idx, shift: shiftHeld })
    containerRef.current?.focus()
  }

  const focusItemByInstanceId = (instanceId: string, shiftHeld: boolean) => {
    const idx = flatItems.findIndex(item => item.instanceId === instanceId)
    if (idx >= 0) focusItem(idx, shiftHeld)
  }

  // Clear focus when clicking outside the Library container
  React.useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        dispatchSel({ type: 'FOCUS_CLEAR' })
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // ── selection ─────────────────────────────────────────────

  const selectInstance = (instanceId: string) => {
    dispatchSel({ type: 'SELECT_INSTANCE', instanceId })
    focusItemByInstanceId(instanceId, false)
  }

  const selectFocused = () => {
    dispatchSel({ type: 'SELECT_FOCUSED', focusedIds: focusedInstanceIds })
  }

  const toggleGroupSelect = (instanceIds: string[]) => {
    dispatchSel({ type: 'TOGGLE_GROUP', instanceIds })
  }

  const instanceIdsForCategorySubtree = (catId: string): string[] => {
    const subIds = new Set(getSubtreeIds(catId, categories))
    return flatItems.filter(item => item.categoryId && subIds.has(item.categoryId)).map(item => item.instanceId)
  }

  // ── bulk actions ──────────────────────────────────────────

  const handleBulkDelete = () => {
    setPendingDelete({
      message: t('library.deleteBulk', { n: selectedWordIds.size }),
      onConfirm: () => {
        selectedWordIds.forEach(id => onDeleteWord(id))
        dispatchSel({ type: 'FULL_RESET' })
        setPendingDelete(null)
      },
    })
  }

  const handleBulkSetPoS = (pos: PartOfSpeech | '') => {
    selectedWords.forEach(w => onEditWord({ ...w, partOfSpeech: pos || undefined }))
    dispatchSel({ type: 'SELECTION_CLEAR' }); setActivePopover(null)
  }

  const handleBulkAttach = (catId: string) => {
    selectedWords.forEach(w => onEditWord({ ...w, categoryIds: Array.from(new Set([...(w.categoryIds ?? []), catId])) }))
    dispatchSel({ type: 'SELECTION_CLEAR' }); setActivePopover(null)
  }

  const handleBulkDetach = (catId: string) => {
    selectedWords.forEach(w => onEditWord({ ...w, categoryIds: (w.categoryIds ?? []).filter(id => id !== catId) }))
    dispatchSel({ type: 'SELECTION_CLEAR' }); setActivePopover(null)
  }

  // ── group collapse ────────────────────────────────────────

  const toggleGroup = (key: string) =>
    setCollapsedGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const toggleCategoryCollapse = (id: string) =>
    setCategoryCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // ── keyboard ──────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    if (['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(tag)) return

    const curEnd = focusEnd ?? focusAnchor ?? -1

    if (e.key === 'Escape') {
      e.preventDefault()
      if (focusAnchor !== null || focusEnd !== null) {
        dispatchSel({ type: 'FOCUS_CLEAR' })
      } else if (selectedInstanceIds.size > 0) {
        dispatchSel({ type: 'SELECTION_CLEAR' })
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusItem(Math.min(flatItems.length - 1, curEnd + 1), e.shiftKey)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusItem(Math.max(0, curEnd - 1), e.shiftKey)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      selectFocused()
    }
  }

  // ── view change ───────────────────────────────────────────

  const switchView = (mode: ViewMode) => {
    setViewMode(mode)
    dispatchSel({ type: 'FULL_RESET' })
  }

  // ── shared row props ──────────────────────────────────────

  const rowProps: RowProps = {
    selectedInstanceIds,
    focusedInstanceIds,
    focusedWordIds,
    hoveredRowId,
    viewMode,
    deltaDays,
    debugMode,
    showTranscription,
    onHover: setHoveredRowId,
    onFocusItem: focusItemByInstanceId,
    onSelectInstance: selectInstance,
    onEdit: openEdit,
    onDelete: handleDeleteWord,
  }

  const hasGrouping = viewMode !== 'flat'

  // ── render ────────────────────────────────────────────────

  return (
    <div ref={containerRef} tabIndex={0} onKeyDown={handleKeyDown}
      style={{ outline: 'none', minHeight: '60vh', fontFamily: 'Inter, system-ui, Arial' }}>

      {/* ── Sticky header ──────────────────────────────────────── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        backgroundColor: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}>

        {/* Row 1: three-column nav bar — left | centre (exercise) | right */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '8px 20px', minHeight: 52,
          borderBottom: '1px solid var(--c-gray-200)',
        }}>
          {/* Left: back + vocab name */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            {onExitToMenu && (
              <Button variant="link" size="sm" onClick={onExitToMenu} style={{ whiteSpace: 'nowrap' }}>
                {t('app.backToVocab')}
              </Button>
            )}
            {vocabName && (
              <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                {vocabName}
              </span>
            )}
          </div>

          {/* Centre: Exercise + Help — always visible */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
            <Button
              variant="purple"
              onClick={onExercise}
              disabled={words.length === 0 || !onExercise}
              style={{ fontSize: 15, padding: '8px 28px', borderRadius: 10, whiteSpace: 'nowrap' }}
            >
              {t('app.exercise')}
            </Button>
            <button
              onClick={() => setShowHelp(true)}
              title={t('help.title')}
              style={{
                background: 'none', border: '1.5px solid var(--c-gray-300)',
                borderRadius: '50%', cursor: 'pointer',
                fontSize: 14, fontWeight: 700,
                width: 30, height: 30, lineHeight: '28px',
                textAlign: 'center', color: 'var(--c-muted-t)', padding: 0,
                transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--c-primary)'; el.style.borderColor = 'var(--c-primary)'; el.style.background = '#eef4ff' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = 'var(--c-muted-t)'; el.style.borderColor = 'var(--c-gray-300)'; el.style.background = 'none' }}
            >?</button>
          </div>

          {/* Right: search · lang · save status · debug · help */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
            <input
              type="search"
              placeholder={t('library.search')}
              style={{
                padding: '5px 10px', fontSize: 13, border: '1px solid var(--c-gray-200)',
                borderRadius: 20, outline: 'none', width: 160, color: 'var(--c-text)',
                backgroundColor: 'var(--c-gray-50)',
              }}
            />
            <LanguagePicker />
            {saveStatus === 'saving' && (
              <span style={{ fontSize: 12, color: 'var(--c-primary)', whiteSpace: 'nowrap' }}>{t('app.autoSaving')}</span>
            )}
            {saveStatus === 'unsaved' && (
              <span style={{ fontSize: 12, color: 'var(--c-danger)', whiteSpace: 'nowrap' }}>{t('app.unsaved')}</span>
            )}
            {/* Debug toggle */}
            <button
              onClick={onDebugToggle}
              title="⚠ Developer debug tools — internal use only"
              style={{
                background: debugMode ? '#fff3cd' : 'none',
                border: `1px solid ${debugMode ? '#e6a700' : 'transparent'}`,
                borderRadius: 6, cursor: 'pointer',
                fontSize: 11, padding: '3px 7px', lineHeight: 1.5,
                opacity: debugMode ? 1 : 0.25,
                color: debugMode ? '#856404' : '#999',
                fontFamily: 'monospace', transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.75' }}
              onMouseLeave={e => { if (!debugMode) (e.currentTarget as HTMLElement).style.opacity = '0.25' }}
            >⚙</button>
          </div>
        </div>

        {/* Row 2: view + word controls */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 20px 8px', flexWrap: 'wrap',
        }}>
          {/* View mode tabs */}
          <div style={{ display: 'flex', gap: 3 }}>
            {(['flat', 'grammar', 'alphabet', 'custom'] as ViewMode[]).map(mode => (
              <Button key={mode} size="sm"
                variant={viewMode === mode ? 'primary' : 'ghost'}
                onClick={() => switchView(mode)}
                style={{ borderRadius: 20 }}
              >
                {mode === 'flat'     ? t('library.viewAll')
                 : mode === 'grammar'  ? t('library.viewGrammar')
                 : mode === 'alphabet' ? t('library.viewAlpha')
                 :                      t('library.viewCustom')}
              </Button>
            ))}
          </div>

          {/* Alphabet prefix selector */}
          {viewMode === 'alphabet' && (
            <div style={{ display: 'flex', gap: 2, alignItems: 'center', marginLeft: 2 }}>
              <span style={{ fontSize: 11, color: 'var(--c-muted-t)' }}>{t('library.prefix')}</span>
              {([1, 2] as const).map(n => (
                <Button key={n} size="sm"
                  variant={alphabetPrefixLen === n ? 'primary' : 'ghost'}
                  onClick={() => setAlphabetPrefixLen(n)}
                >{n}</Button>
              ))}
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Collapse/expand (only in grouped views) */}
          {hasGrouping && allGroupKeys.length > 0 && (
            <Button size="sm" variant="ghost" onClick={handleCollapseAll}>
              {allCollapsed ? t('library.expandAll') : t('library.collapseAll')}
            </Button>
          )}

          {/* Add Word */}
          <Button size="sm" variant="success" onClick={openAdd}>
            {t('library.addWord')}
          </Button>
        </div>

        {/* Row 3: debug bar (only when active) */}
        {debugMode && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
            padding: '6px 20px 8px',
            backgroundColor: '#fff3cd', borderTop: '1px solid var(--c-warning)',
            fontSize: 13,
          }}>
            <span style={{ fontWeight: 600, color: '#856404' }}>{t('app.debugMode')}</span>
            <span style={{ color: '#856404' }}>{t('app.debugDays', { n: debugDaysOffset })}</span>
            <Button size="sm" variant="warning" onClick={() => onDebugDaysChange(debugDaysOffset + 1)}>
              {t('app.plusOneDay')}
            </Button>
            <Button size="sm" variant="danger" onClick={onResetAllWords} disabled={words.length === 0}>
              {t('app.resetAll')}
            </Button>
          </div>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div style={{ padding: '12px 20px 32px' }}>

        <div style={{ fontSize: 12, color: 'var(--c-muted-t)', marginBottom: 8, textAlign: 'right' }}>
          {t('library.hint')}
        </div>

        {viewMode === 'custom' && words.some(w => (w.categoryIds ?? []).length > 1) && (
          <div style={{ fontSize: 12, color: 'var(--c-muted-t)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: '#fffce8', border: '1px solid #e8d96c', borderRadius: 2 }} />
            {t('library.multiCat')}
          </div>
        )}

        {words.length === 0 ? (
          <p style={{ color: '#999', textAlign: 'center', padding: '48px 24px' }}>
            {t('library.noWords')}
          </p>
        ) : (
          <div style={{ overflowX: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderRadius: 4 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', fontSize: 14 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--c-gray-50)', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ width: 46, padding: '8px 12px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      title="Select all visible"
                      checked={flatItems.length > 0 && flatItems.every(item => selectedInstanceIds.has(item.instanceId))}
                      onChange={() => {
                        const allSel = flatItems.every(item => selectedInstanceIds.has(item.instanceId))
                        if (allSel) dispatchSel({ type: 'SELECTION_CLEAR' })
                        else dispatchSel({ type: 'SELECT_ALL', instanceIds: flatItems.map(item => item.instanceId) })
                      }}
                      style={{ cursor: 'pointer', accentColor: 'var(--c-primary)' }}
                    />
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>{learnedLang ?? t('library.colWord')}</th>
                  {showTranscription && <th style={{ padding: '8px 12px', textAlign: 'left', width: 140 }}>{t('library.colTranscription')}</th>}
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>{knownLang ?? t('library.colTranslations')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', width: 100 }}>{t('library.colPoS')}</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', width: 55, fontSize: 12 }} title={t('library.importanceTip')}>★</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', width: 36, fontSize: 12 }} title={t('library.bloomTip')}>{t('library.colBloom')}</th>
                  <th style={{ padding: '8px 4px', textAlign: 'center', width: 38, fontSize: 11 }} title={t('library.daysTip')}>{t('library.colDays')}</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', width: 44, fontSize: 10, color: 'var(--c-faint)' }} title={t('library.cramMeterTip')}>{t('library.colCramMeter')}</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', width: 48, fontSize: 11 }} title={t('library.knowledgeTip')}>{t('library.colKnowledge')}</th>
                  {debugMode && <th style={{ padding: '8px 8px', textAlign: 'left', width: 110, fontSize: 10, color: 'var(--c-faint)', fontFamily: 'monospace' }}>{t('library.colDebug')}</th>}
                  <th style={{ padding: '8px 12px', textAlign: 'center', width: 80 }}>{t('library.colActions')}</th>
                </tr>
              </thead>

              {viewMode === 'flat' && <FlatTbody words={words} rowProps={rowProps} />}
              {viewMode === 'grammar' && (
                <GrammarTbody words={words} collapsedGroups={collapsedGroups} onToggleGroup={toggleGroup}
                  onToggleGroupSelect={toggleGroupSelect} rowProps={rowProps} selectedInstanceIds={selectedInstanceIds} />
              )}
              {viewMode === 'alphabet' && (
                <AlphabetTbody words={words} prefixLen={alphabetPrefixLen} collapsedGroups={collapsedGroups}
                  onToggleGroup={toggleGroup} onToggleGroupSelect={toggleGroupSelect}
                  rowProps={rowProps} selectedInstanceIds={selectedInstanceIds} />
              )}
              {viewMode === 'custom' && (
                <CategoryTbodies
                  categories={categories} words={words}
                  collapsed={categoryCollapsed} onToggleCollapse={toggleCategoryCollapse}
                  getSubtreeInstanceIds={instanceIdsForCategorySubtree}
                  onToggleGroupSelect={toggleGroupSelect}
                  onAddCategory={onAddCategory} onUpdateCategory={onUpdateCategory} onDeleteCategory={onDeleteCategory}
                  rowProps={rowProps} selectedInstanceIds={selectedInstanceIds}
                />
              )}
            </table>
          </div>
        )}
      </div>

      {selectedInstanceIds.size > 0 && (
        <BulkActionBar
          count={selectedWordIds.size}
          categories={categories}
          commonCategoryIds={commonCategoryIds}
          activePopover={activePopover}
          onSetPopover={setActivePopover}
          onClearSelection={() => dispatchSel({ type: 'SELECTION_CLEAR' })}
          onDelete={handleBulkDelete}
          onSetPoS={handleBulkSetPoS}
          onAttach={handleBulkAttach}
          onDetach={handleBulkDetach}
          onExerciseSelected={onExerciseSelected ? () => {
            dispatchSel({ type: 'SELECTION_CLEAR' })
            onExerciseSelected(selectedWords)
          } : undefined}
        />
      )}

      {editorOpen && (
        <Editor word={editingWord} categories={categories} onSave={handleSaveWord} onCancel={closeEditor} />
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {pendingDelete && (
        <ConfirmDialog
          message={pendingDelete.message}
          onConfirm={pendingDelete.onConfirm}
          onCancel={() => setPendingDelete(null)}
        />
      )}

    </div>
  )
}
