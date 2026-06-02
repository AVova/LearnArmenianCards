// Setup screen shown before an exercise session starts.
// Lets the user pick word limit, selection mode, and optional category filter.

import React from 'react'
import { Category, Word } from '../lib/types'
import { useI18n } from '../lib/i18n'
import { SelectionMethod, selectWords, computeModeCounts } from '../lib/scheduler'
import { buildCategoryTree, getSubtreeIds, TreeNode } from '../lib/categoryUtils'
import {
  ICON_NEW, ICON_READY, ICON_CONSOLIDATING, ICON_CRAM_MODE,
} from '../lib/wordIcons'
import { Button, Card } from '../ui'

type SetupViewProps = {
  words: Word[]
  categories: Category[]
  count: number
  setCount: (n: number) => void
  method: SelectionMethod
  setMethod: (m: SelectionMethod) => void
  selectedCategoryIds: Set<string>
  setSelectedCategoryIds: (s: Set<string>) => void
  onStart: () => void
  deltaDays: number
}

// ── category tree filter ────────────────────────────────────────────────────

type CategoryFilterProps = {
  categories: Category[]
  words: Word[]
  selectedCategoryIds: Set<string>
  setSelectedCategoryIds: (s: Set<string>) => void
}

function CategoryFilterTree({ categories, words, selectedCategoryIds, setSelectedCategoryIds }: CategoryFilterProps) {
  const roots = buildCategoryTree(categories)

  // Expand selection to include all subtree category IDs for a given root id
  const subtreeIds = (id: string): string[] => getSubtreeIds(id, categories)

  // Count words in a subtree
  const subtreeWordCount = (id: string) => {
    const ids = new Set(subtreeIds(id))
    return words.filter(w => (w.categoryIds ?? []).some(cid => ids.has(cid))).length
  }

  // Check state of a node: all | some | none
  function nodeCheckState(id: string): 'all' | 'some' | 'none' {
    const ids = subtreeIds(id)
    const checkedCount = ids.filter(cid => selectedCategoryIds.has(cid)).length
    if (checkedCount === 0) return 'none'
    if (checkedCount === ids.length) return 'all'
    return 'some'
  }

  function toggleNode(id: string, checked: boolean) {
    const next = new Set(selectedCategoryIds)
    const ids = subtreeIds(id)
    if (checked) ids.forEach(cid => next.add(cid))
    else ids.forEach(cid => next.delete(cid))
    setSelectedCategoryIds(next)
  }

  function renderNode(node: TreeNode, depth: number): React.ReactNode {
    const { category, children } = node
    const checkState = nodeCheckState(category.id)
    const count = subtreeWordCount(category.id)
    return (
      <div key={category.id}>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '3px 0', paddingLeft: depth * 16, cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={checkState === 'all'}
            ref={el => { if (el) el.indeterminate = checkState === 'some' }}
            onChange={e => toggleNode(category.id, e.target.checked)}
            style={{ accentColor: 'var(--c-primary)' }}
          />
          <span style={{ fontSize: 13 }}>{category.name}</span>
          <span style={{ fontSize: 11, color: 'var(--c-faint)', marginLeft: 'auto' }}>{count}</span>
        </label>
        {children.map(child => renderNode(child, depth + 1))}
      </div>
    )
  }

  return <>{roots.map(n => renderNode(n, 0))}</>
}

// ── SetupView ───────────────────────────────────────────────────────────────

export function SetupView({
  words, categories, count, setCount, method, setMethod,
  selectedCategoryIds, setSelectedCategoryIds, onStart, deltaDays,
}: SetupViewProps) {
  const [countStr, setCountStr] = React.useState(String(count))
  const [filterOpen, setFilterOpen] = React.useState(false)
  React.useEffect(() => setCountStr(String(count)), [count])
  const { t } = useI18n()

  const filteredWords = selectedCategoryIds.size > 0
    ? words.filter(w => (w.categoryIds ?? []).some(id => selectedCategoryIds.has(id)))
    : words

  const clamp = (v: string) => {
    const n = parseInt(v)
    return isNaN(n) ? 1 : Math.max(1, Math.min(Math.max(filteredWords.length, 1), n))
  }

  const counts = computeModeCounts(filteredWords, deltaDays)

  const primaryModes: { value: SelectionMethod; icon: string; label: string; desc: string; count: number }[] = [
    { value: 'ready',         icon: ICON_READY,         label: t('deck.ready'),         desc: t('deck.readyDesc'),         count: counts.ready },
    { value: 'consolidating', icon: ICON_CONSOLIDATING, label: t('deck.consolidating'), desc: t('deck.consolidatingDesc'), count: counts.consolidating },
    { value: 'fresh',         icon: ICON_NEW,           label: t('deck.fresh'),         desc: t('deck.freshDesc'),         count: counts.fresh },
    { value: 'cram',          icon: ICON_CRAM_MODE,     label: t('deck.cram'),          desc: t('deck.cramDesc'),          count: counts.cram },
  ]

  const clearFilter = () => setSelectedCategoryIds(new Set())

  // Count of selected filter categories (any level)
  const filterCount = selectedCategoryIds.size

  return (
    <Card style={{ maxWidth: 460, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
      <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: 22 }}>{t('deck.title')}</h2>

      {/* Word count */}
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>{t('deck.wordLimit')}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <input
          type="text" inputMode="numeric" value={countStr}
          onChange={e => {
            const v = e.target.value.replace(/[^0-9]/g, '')
            setCountStr(v)
            if (v) setCount(clamp(v))
          }}
          onBlur={() => { const n = clamp(countStr); setCount(n); setCountStr(String(n)) }}
          style={{ width: 80, padding: '6px 10px', fontSize: 16, border: '1px solid var(--c-gray-300)', borderRadius: 6 }}
        />
      </div>

      {/* Selection mode cards */}
      <label style={{ display: 'block', fontWeight: 600, marginBottom: 10 }}>{t('deck.selection')}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        {primaryModes.map(m => {
          const active   = method === m.value
          const disabled = m.count === 0
          return (
            <label key={m.value} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 8,
              cursor: disabled ? 'not-allowed' : 'pointer',
              border: `2px solid ${active ? 'var(--c-primary)' : 'var(--c-gray-200)'}`,
              backgroundColor: active ? '#f0f7ff' : '#fff',
              opacity: disabled ? 0.4 : 1,
              pointerEvents: disabled ? 'none' : 'auto',
              transition: 'border-color 0.15s, background-color 0.15s',
            }}>
              <input type="radio" name="method" value={m.value}
                checked={active} onChange={() => setMethod(m.value)}
                disabled={disabled}
                style={{ accentColor: 'var(--c-primary)' }} />
              <span style={{ flex: 1 }}>
                <span style={{ marginRight: 6 }}>{m.icon}</span>
                <strong>{m.label}</strong>
                <span style={{ color: 'var(--c-muted-t)', marginLeft: 8, fontSize: 13 }}>{m.desc}</span>
              </span>
              <span style={{
                fontSize: 12, fontWeight: 600, minWidth: 24, textAlign: 'center',
                color: disabled ? 'var(--c-ghost)' : active ? 'var(--c-primary)' : 'var(--c-gray-700)',
              }}>
                {m.count}
              </span>
            </label>
          )
        })}
      </div>
      {/* Most suited — de-emphasized fallback */}
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
        border: `1px solid ${method === 'smart' ? 'var(--c-primary)' : '#f0f0f0'}`,
        backgroundColor: method === 'smart' ? '#f0f7ff' : '#fafafa',
        marginBottom: 20,
      }}>
        <input type="radio" name="method" value="smart"
          checked={method === 'smart'} onChange={() => setMethod('smart')}
          style={{ accentColor: 'var(--c-primary)' }} />
        <span style={{ flex: 1, fontSize: 13, color: '#777' }}>
          <span style={{ marginRight: 6 }}>↕</span>
          <strong style={{ fontWeight: 500 }}>{t('deck.smart')}</strong>
          <span style={{ color: 'var(--c-faint)', marginLeft: 8, fontSize: 12 }}>{t('deck.smartDesc')}</span>
        </span>
      </label>

      {/* Category filter */}
      {categories.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => setFilterOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: 'var(--c-gray-700)', fontWeight: 600, padding: '4px 0',
            }}
          >
            <span style={{ fontSize: 10 }}>{filterOpen ? '▼' : '▶'}</span>
            {t('deck.filterCategory')}
            {filterCount > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, background: 'var(--c-primary)', color: '#fff', borderRadius: 10, padding: '1px 6px' }}>
                {filterCount}
              </span>
            )}
          </button>
          {filterOpen && (
            <div style={{ marginTop: 8, padding: '8px 12px', border: '1px solid #e9ecef', borderRadius: 6, maxHeight: 200, overflowY: 'auto' }}>
              {filterCount > 0 && (
                <Button variant="link" size="sm" onClick={clearFilter} style={{ marginBottom: 6, padding: 0 }}>
                  {t('deck.clearFilter')}
                </Button>
              )}
              <CategoryFilterTree
                categories={categories}
                words={words}
                selectedCategoryIds={selectedCategoryIds}
                setSelectedCategoryIds={setSelectedCategoryIds}
              />
            </div>
          )}
        </div>
      )}

      <Button variant="primary" size="lg" block onClick={onStart}>
        {t('deck.startBtn')}
      </Button>
    </Card>
  )
}
