import React from 'react'
import { PartOfSpeech, Word } from '../lib/types'
import { computeBloom, computeC, computeT, IMPORTANCE_VALS } from '../lib/scheduler'
import { ICON_NEW, ICON_BLOOMING_LOW, ICON_BLOOMING_HIGH, ICON_READY, ICON_CONSOLIDATING, ICON_CRAM_LOCK, ICON_KNW_0, ICON_KNW_1, ICON_KNW_2, ICON_KNW_3 } from '../lib/wordIcons'
import { Button } from '../ui'
import { useI18n } from '../lib/i18n'

const CELL: React.CSSProperties = { padding: '8px 12px' }

// ── shared types ───────────────────────────────────────────

export type ViewMode = 'flat' | 'grammar' | 'alphabet' | 'custom'

/** One navigation/selection unit. In custom view a word can have multiple instances (one per category). */
export type FlatItem = {
  word: Word
  instanceId: string       // wordId for flat/grammar/alphabet; `wordId:catId` for custom
  categoryId: string | null
  depth: number
}

export type RowProps = {
  selectedInstanceIds: Set<string>
  focusedInstanceIds: Set<string>
  focusedWordIds: Set<string>
  hoveredRowId: string | null
  viewMode: ViewMode
  deltaDays: number
  debugMode: boolean
  showTranscription: boolean
  onHover: (id: string | null) => void
  onFocusItem: (instanceId: string, shift: boolean) => void
  onSelectInstance: (instanceId: string) => void
  onEdit: (w: Word) => void
  onDelete: (id: string) => void
}

// ── constants ──────────────────────────────────────────────

export const POS_ORDER: (PartOfSpeech | '__none__')[] = [
  'noun', 'verb', 'adjective', 'adverb', 'phrase', 'other', '__none__',
]
export const POS_LABELS: Record<string, string> = {
  noun: 'Noun', verb: 'Verb', adjective: 'Adjective',
  adverb: 'Adverb', phrase: 'Phrase', other: 'Other',
  __none__: 'No part of speech',
}

// ── icon helpers ───────────────────────────────────────────

function bloomIcon(wordState: string, B: number): string {
  if (wordState === 'N') return ICON_NEW             // 🌱 new, never exercised
  if (wordState === 'C') return ICON_CONSOLIDATING   // 🎯
  if (wordState === 'R') return ICON_READY           // 🌸
  // S state — blossoming progress
  return B < 0.5 ? ICON_BLOOMING_LOW : ICON_BLOOMING_HIGH
}

function knowledgeIcon(knowledge: number): string {
  if (knowledge < 0.25) return ICON_KNW_0  // 👶
  if (knowledge < 0.50) return ICON_KNW_1  // 🎒
  if (knowledge < 0.75) return ICON_KNW_2  // 🎓
  return ICON_KNW_3                         // 🏆
}

function daysRemaining(wordState: string, B: number, importanceVal: number, D: number): string {
  if (wordState === 'N') return '—'
  if (wordState === 'R' || wordState === 'C') return '0d'
  const T = computeT(importanceVal, D)
  const days = Math.ceil(T * (1 - B))
  if (days <= 0) return '<1d'
  return `${days}d`
}

// ── WordRow ────────────────────────────────────────────────

export function WordRow({ item, depth = 0, rowProps }: {
  item: FlatItem; depth?: number; rowProps: RowProps
}) {
  const { word, instanceId } = item
  const { selectedInstanceIds, focusedInstanceIds, focusedWordIds, hoveredRowId, viewMode,
    deltaDays, debugMode, showTranscription, onHover, onFocusItem, onSelectInstance, onEdit, onDelete } = rowProps
  const { t } = useI18n()
  const B = computeBloom(word, deltaDays)
  const C = computeC(word, deltaDays)
  const D = word.metadata?.difficulty ?? 1.0
  const imp = word.metadata?.importance ?? 1
  const wordState = word.metadata?.state ?? 'N'
  const isFresh = wordState === 'N'

  const importanceVal = IMPORTANCE_VALS[imp]
  const bIcon      = bloomIcon(wordState, B)
  const days       = daysRemaining(wordState, B, importanceVal, D)
  const showCramLock = C > 0.9
  const kIcon      = isFresh ? null : knowledgeIcon(1 - D)

  const bloomTitle = wordState === 'N' ? t('library.stateNew')
    : wordState === 'C' ? t('library.stateConsolidating')
    : wordState === 'R' ? t('library.stateReady')
    : `${t('library.stateBlossoming')} ${Math.round(B * 100)}%`

  const isPrimaryFocused   = focusedInstanceIds.has(instanceId)
  const isSecondaryFocused = !isPrimaryFocused && focusedWordIds.has(word.id) && viewMode === 'custom'
  const isSelected  = selectedInstanceIds.has(instanceId)
  const isHovered   = hoveredRowId === instanceId
  const isMultiCat  = viewMode === 'custom' && (word.categoryIds ?? []).length > 1

  let bg = 'transparent'
  if (isPrimaryFocused || isSelected) bg = '#e8f0fe'
  else if (isSecondaryFocused)        bg = 'rgba(200,218,255,0.35)'
  else if (isMultiCat)                bg = '#fffce8'
  else if (isHovered)                 bg = '#f9f9f9'

  const impColors: Record<number, string> = { 1: '#f0c000', 2: '#f09000', 3: '#e65c00' }

  return (
    <tr
      onMouseEnter={() => onHover(instanceId)}
      onMouseLeave={() => onHover(null)}
      onMouseDown={e => { if (e.shiftKey) e.preventDefault() }}
      onClick={e => {
        if ((e.target as HTMLElement).closest('button,input[type="checkbox"]')) return
        if (e.ctrlKey || e.metaKey) {
          onSelectInstance(instanceId)  // ctrl+click: toggle selection without changing focus
        } else {
          onFocusItem(instanceId, e.shiftKey)
        }
      }}
      style={{
        borderBottom: '1px solid #dee2e6', backgroundColor: bg,
        outline: isPrimaryFocused ? '2px solid var(--c-primary)' : 'none',
        outlineOffset: -1, cursor: 'default', userSelect: 'none',
      }}
    >
      {/* Checkbox */}
      <td style={{ padding: '8px 8px', textAlign: 'center', width: 46 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          {isMultiCat && <span style={{ fontSize: 10, color: '#c0a000', lineHeight: 1 }}>●</span>}
          <input type="checkbox" checked={isSelected}
            onChange={e => { e.stopPropagation(); onSelectInstance(instanceId) }}
            onClick={e => e.stopPropagation()}
            style={{ cursor: 'pointer', accentColor: 'var(--c-primary)' }} />
        </div>
      </td>

      {/* Word */}
      <td style={{ ...CELL, fontWeight: 500, paddingLeft: depth > 0 ? 12 + depth * 16 : 12 }}>{word.word}</td>

      {/* Transcription — hidden when vocab's showTranscription is off */}
      {showTranscription && <td style={{ ...CELL, color: 'var(--c-gray-600)' }}>{word.transcription || '—'}</td>}

      {/* Translations */}
      <td style={CELL}>{word.translations.map(tr => (typeof tr === 'string' ? tr : tr.text)).join(', ')}</td>

      {/* PoS */}
      <td style={{ ...CELL, color: 'var(--c-muted-t)', fontSize: 13 }}>{word.partOfSpeech || '—'}</td>

      {/* Importance — all 3 levels colored */}
      <td style={{ padding: '8px 10px', fontSize: 12, width: 55 }} title={t('library.importanceCellTip', { n: imp })}>
        <span style={{ color: impColors[imp] ?? '#f0c000' }}>{'★'.repeat(imp)}</span>
      </td>

      {/* Bloom / State icon — shows lifecycle stage; C state shows 🎯 */}
      <td style={{ padding: '8px 6px', textAlign: 'center', width: 36, fontSize: 15 }} title={bloomTitle}>
        {bIcon}
      </td>

      {/* Days until review */}
      <td
        style={{ padding: '8px 4px', fontSize: 11, color: 'var(--c-faint)', width: 38, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
        title={wordState === 'S' ? t('library.daysCellTip', { days }) : undefined}
      >
        {days}
      </td>

      {/* Cram lock — shown when C > 0.9 */}
      <td style={{ padding: '8px 6px', textAlign: 'center', width: 44, fontSize: 14 }} title={showCramLock ? t('library.cramLockTip') : undefined}>
        {showCramLock && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <span>{ICON_CRAM_LOCK}</span>
            <span style={{ fontSize: 9, color: 'var(--c-faint)', lineHeight: 1 }}>max</span>
          </div>
        )}
      </td>

      {/* Knowledge level — 👶🎒🎓🏆 */}
      <td style={{ padding: '8px 6px', textAlign: 'center', width: 36, fontSize: 14 }}>
        {kIcon && <span title={`Knowledge: ${Math.round((1 - D) * 100)}%`}>{kIcon}</span>}
      </td>

      {/* Debug column (only when debugMode) */}
      {debugMode && (
        <td style={{ padding: '8px 8px', fontSize: 10, color: '#999', fontFamily: 'monospace', width: 110, whiteSpace: 'nowrap' }}>
          {wordState} {Math.round(C * 100)}% {Math.round(B * 100)}% {Math.round((1 - D) * 100)}%
        </td>
      )}

      {/* Actions */}
      <td style={{ ...CELL, textAlign: 'center' }}>
        {isHovered ? (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            <Button size="sm" variant="primary" onClick={e => { e.stopPropagation(); onEdit(word) }} title="Edit">✎</Button>
            <Button size="sm" variant="danger"  onClick={e => { e.stopPropagation(); onDelete(word.id) }} title="Delete">🗑</Button>
          </div>
        ) : <span style={{ color: 'var(--c-ghost)' }}>—</span>}
      </td>
    </tr>
  )
}

// ── GroupHeaderRow (grammar / alphabet) ───────────────────

export function GroupHeaderRow({ label, count, collapsed, groupInstanceIds, selectedInstanceIds, onToggle, onToggleSelect, debugMode, showTranscription = true }: {
  label: string; count: number; collapsed: boolean
  groupInstanceIds: string[]; selectedInstanceIds: Set<string>
  onToggle: () => void; onToggleSelect: () => void
  debugMode: boolean; showTranscription?: boolean
}) {
  const allSel = groupInstanceIds.length > 0 && groupInstanceIds.every(id => selectedInstanceIds.has(id))
  const colSpan = (debugMode ? 10 : 9) - (showTranscription ? 0 : 1)
  return (
    <tr style={{ backgroundColor: 'var(--c-gray-100)', borderTop: '2px solid #dee2e6', borderBottom: '1px solid #dee2e6' }}>
      <td style={{ padding: '8px 12px', textAlign: 'center', width: 46 }}>
        <input type="checkbox" checked={allSel} onChange={onToggleSelect}
          style={{ cursor: 'pointer', accentColor: 'var(--c-primary)' }} />
      </td>
      <td colSpan={colSpan} style={{ padding: '7px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: 0, color: 'var(--c-gray-600)' }}>
            {collapsed ? '▶' : '▼'}
          </button>
          <span style={{ fontWeight: 700, fontSize: 13, color: '#444', letterSpacing: 0.3 }}>{label}</span>
          <span style={{ fontSize: 12, color: '#999' }}>({count})</span>
        </div>
      </td>
    </tr>
  )
}

// ── FlatTbody ──────────────────────────────────────────────

export function FlatTbody({ words, rowProps }: { words: Word[]; rowProps: RowProps }) {
  return (
    <tbody>
      {words.map(w => (
        <WordRow key={w.id} item={{ word: w, instanceId: w.id, categoryId: null, depth: 0 }} rowProps={rowProps} />
      ))}
    </tbody>
  )
}

// ── GrammarTbody ───────────────────────────────────────────

export function GrammarTbody({ words, collapsedGroups, onToggleGroup, onToggleGroupSelect, rowProps, selectedInstanceIds }: {
  words: Word[]; collapsedGroups: Set<string>; onToggleGroup: (k: string) => void
  onToggleGroupSelect: (ids: string[]) => void; rowProps: RowProps; selectedInstanceIds: Set<string>
}) {
  const grouped = new Map<string, Word[]>()
  POS_ORDER.forEach(k => grouped.set(k, []))
  words.forEach(w => grouped.get(w.partOfSpeech ?? '__none__')!.push(w))

  return (
    <>
      {POS_ORDER.map(key => {
        const group = grouped.get(key)!
        if (group.length === 0) return null
        const collapsed = collapsedGroups.has(key)
        const iids = group.map(w => w.id)
        return (
          <tbody key={key}>
            <GroupHeaderRow label={POS_LABELS[key]} count={group.length} collapsed={collapsed}
              groupInstanceIds={iids} selectedInstanceIds={selectedInstanceIds}
              onToggle={() => onToggleGroup(key)} onToggleSelect={() => onToggleGroupSelect(iids)}
              debugMode={rowProps.debugMode} showTranscription={rowProps.showTranscription} />
            {!collapsed && group.map(w => (
              <WordRow key={w.id} item={{ word: w, instanceId: w.id, categoryId: null, depth: 0 }} rowProps={rowProps} />
            ))}
          </tbody>
        )
      })}
    </>
  )
}

// ── AlphabetTbody ──────────────────────────────────────────

export function AlphabetTbody({ words, prefixLen, collapsedGroups, onToggleGroup, onToggleGroupSelect, rowProps, selectedInstanceIds }: {
  words: Word[]; prefixLen: 1 | 2; collapsedGroups: Set<string>; onToggleGroup: (k: string) => void
  onToggleGroupSelect: (ids: string[]) => void; rowProps: RowProps; selectedInstanceIds: Set<string>
}) {
  const grouped = new Map<string, Word[]>()
  words.forEach(w => {
    const k = (w.word || '').slice(0, prefixLen).toUpperCase() || '?'
    if (!grouped.has(k)) grouped.set(k, [])
    grouped.get(k)!.push(w)
  })
  const keys = Array.from(grouped.keys()).sort()
  return (
    <>
      {keys.map(key => {
        const group = grouped.get(key)!
        const gkey = `alpha-${key}`
        const collapsed = collapsedGroups.has(gkey)
        const iids = group.map(w => w.id)
        return (
          <tbody key={key}>
            <GroupHeaderRow label={key} count={group.length} collapsed={collapsed}
              groupInstanceIds={iids} selectedInstanceIds={selectedInstanceIds}
              onToggle={() => onToggleGroup(gkey)} onToggleSelect={() => onToggleGroupSelect(iids)}
              debugMode={rowProps.debugMode} showTranscription={rowProps.showTranscription} />
            {!collapsed && group.map(w => (
              <WordRow key={w.id} item={{ word: w, instanceId: w.id, categoryId: null, depth: 0 }} rowProps={rowProps} />
            ))}
          </tbody>
        )
      })}
    </>
  )
}
