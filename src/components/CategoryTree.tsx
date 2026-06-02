import React, { useRef, useState } from 'react'
import { Category, Word } from '../lib/types'
import { buildCategoryTree } from '../lib/categoryUtils'
import { FlatItem, RowProps, WordRow } from './LibraryRow'
import { Button } from '../ui'
import CategoryNode from './CategoryNode'

type CategoryTbodiesProps = {
  categories: Category[]
  words: Word[]
  selectedInstanceIds: Set<string>
  collapsed: Set<string>
  onToggleCollapse: (id: string) => void
  getSubtreeInstanceIds: (catId: string) => string[]
  onToggleGroupSelect: (instanceIds: string[]) => void
  rowProps: RowProps
  onAddCategory: (cat: Category) => void
  onUpdateCategory: (cat: Category) => void
  onDeleteCategory: (id: string) => void
}

export default function CategoryTbodies({
  categories, words,
  selectedInstanceIds, collapsed, onToggleCollapse,
  getSubtreeInstanceIds, onToggleGroupSelect, rowProps,
  onAddCategory, onUpdateCategory, onDeleteCategory,
}: CategoryTbodiesProps) {
  const [addingRoot, setAddingRoot] = useState(false)
  const [newRootName, setNewRootName] = useState('')
  const addRootRef = useRef<HTMLInputElement>(null)

  const tree = buildCategoryTree(categories)
  const uncategorizedWords = words.filter(w => !w.categoryIds || w.categoryIds.length === 0)
  const debugMode = rowProps.debugMode
  const headerColSpan = debugMode ? 10 : 9

  const startAddRoot = () => {
    setAddingRoot(true); setNewRootName('')
    setTimeout(() => addRootRef.current?.focus(), 0)
  }
  const commitAddRoot = () => {
    const t = newRootName.trim()
    if (t) onAddCategory({ id: `cat-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, name: t, parentId: null, order: categories.filter(c => c.parentId === null).length })
    setAddingRoot(false); setNewRootName('')
  }
  const cancelAddRoot = () => { setAddingRoot(false); setNewRootName('') }

  const sharedProps = {
    categories, words, selectedInstanceIds, collapsed,
    onToggleCollapse, getSubtreeInstanceIds, onToggleGroupSelect,
    rowProps, onAddCategory, onUpdateCategory, onDeleteCategory,
  }

  return (
    <>
      {tree.map(node => (
        <CategoryNode key={node.category.id} node={node} depth={0} {...sharedProps} />
      ))}

      {/* Add root category row */}
      <tbody>
        {addingRoot ? (
          <tr style={{ backgroundColor: 'var(--c-gray-50)', borderTop: '1px solid var(--c-gray-300)' }}>
            <td />
            <td colSpan={headerColSpan} style={{ padding: '8px 12px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  ref={addRootRef}
                  value={newRootName}
                  onChange={e => setNewRootName(e.target.value)}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') commitAddRoot(); if (e.key === 'Escape') cancelAddRoot() }}
                  placeholder="New top-level category name…"
                  style={{ flex: 1, padding: '4px 8px', fontSize: 13, border: '1px solid var(--c-primary)', borderRadius: 4 }}
                />
                <Button size="sm" variant="success" onClick={commitAddRoot}>Add</Button>
                <Button size="sm" variant="muted" onClick={cancelAddRoot}>Cancel</Button>
              </div>
            </td>
          </tr>
        ) : (
          <tr style={{ backgroundColor: 'var(--c-gray-50)', borderTop: tree.length > 0 ? '1px solid var(--c-gray-300)' : undefined }}>
            <td />
            <td colSpan={6} style={{ padding: '8px 12px' }}>
              <Button size="sm" variant="success" onClick={startAddRoot}>+ Add category</Button>
            </td>
          </tr>
        )}
      </tbody>

      {/* Uncategorized words */}
      {uncategorizedWords.length > 0 && (
        <tbody>
          <tr style={{ backgroundColor: 'var(--c-gray-50)', borderTop: '2px solid var(--c-gray-300)', borderBottom: '1px solid var(--c-gray-300)' }}>
            <td style={{ width: 46, padding: '7px 8px', textAlign: 'center' }}>
              <input type="checkbox"
                checked={uncategorizedWords.length > 0 && uncategorizedWords.every(w => selectedInstanceIds.has(`${w.id}:__uncategorized__`))}
                onChange={() => onToggleGroupSelect(uncategorizedWords.map(w => `${w.id}:__uncategorized__`))}
                style={{ cursor: 'pointer', accentColor: 'var(--c-primary)' }} />
            </td>
            <td colSpan={headerColSpan} style={{ padding: '7px 12px' }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--c-muted-t)' }}>
                Not categorized <span style={{ fontWeight: 400 }}>({uncategorizedWords.length})</span>
              </span>
            </td>
          </tr>
          {uncategorizedWords.map(w => {
            const item: FlatItem = { word: w, instanceId: `${w.id}:__uncategorized__`, categoryId: null, depth: 0 }
            return <WordRow key={item.instanceId} item={item} rowProps={rowProps} />
          })}
        </tbody>
      )}
    </>
  )
}
