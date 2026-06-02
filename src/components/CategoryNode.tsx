import React, { useRef, useState } from 'react'
import { Category, Word } from '../lib/types'
import { countDescendants, getSubtreeIds, TreeNode } from '../lib/categoryUtils'
import { FlatItem, RowProps, WordRow } from './LibraryRow'
import { Button } from '../ui'
import ConfirmDialog from './ConfirmDialog'

type CategoryNodeProps = {
  node: TreeNode
  depth: number
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

export default function CategoryNode({
  node, depth, categories, words,
  selectedInstanceIds, collapsed, onToggleCollapse,
  getSubtreeInstanceIds, onToggleGroupSelect,
  rowProps, onAddCategory, onUpdateCategory, onDeleteCategory,
}: CategoryNodeProps) {
  const { category } = node
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [addingChild, setAddingChild] = useState(false)
  const [newChildName, setNewChildName] = useState('')
  const [hovered, setHovered] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null)
  const renameRef = useRef<HTMLInputElement>(null)
  const addChildRef = useRef<HTMLInputElement>(null)

  const isCollapsed = collapsed.has(category.id)
  const debugMode = rowProps.debugMode
  const headerColSpan = debugMode ? 10 : 9

  const groupWords = words.filter(w => (w.categoryIds ?? []).includes(category.id))
  const subtreeIds = new Set(getSubtreeIds(category.id, categories))
  const totalCount = words.filter(w => (w.categoryIds ?? []).some(cid => subtreeIds.has(cid))).length
  const subtreeIids = getSubtreeInstanceIds(category.id)
  const allSel = subtreeIids.length > 0 && subtreeIids.every(id => selectedInstanceIds.has(id))

  const startRename = () => {
    setRenameValue(category.name); setRenaming(true)
    setTimeout(() => renameRef.current?.focus(), 0)
  }
  const commitRename = () => {
    const t = renameValue.trim()
    if (t) onUpdateCategory({ ...category, name: t })
    setRenaming(false)
  }
  const cancelRename = () => setRenaming(false)

  const startAddChild = () => {
    setNewChildName(''); setAddingChild(true)
    setTimeout(() => addChildRef.current?.focus(), 0)
  }
  const commitAddChild = () => {
    const t = newChildName.trim()
    if (t) onAddCategory({ id: `cat-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, name: t, parentId: category.id, order: categories.filter(c => c.parentId === category.id).length })
    setAddingChild(false); setNewChildName('')
  }
  const cancelAddChild = () => setAddingChild(false)

  const handleDelete = () => {
    const d = countDescendants(category.id, categories)
    const msg = d > 0
      ? `Delete "${category.name}" and its ${d} subcategor${d === 1 ? 'y' : 'ies'}? Words will become uncategorized.`
      : `Delete "${category.name}"? Words will become uncategorized.`
    setConfirmMsg(msg)
  }

  // Depth-based visual weight
  const rowBg = depth === 0 ? '#dde5f0' : depth === 1 ? '#e8eef7' : 'var(--c-gray-100)'
  const rowBorderTop = depth === 0 ? '2px solid #b0c0d8' : '1px solid #d4dce8'
  const nameFontSize = depth === 0 ? 16 : depth === 1 ? 14 : 13
  const nameFontWeight = depth === 0 ? 800 : depth === 1 ? 700 : 600
  const rowPadV = depth === 0 ? 10 : depth === 1 ? 8 : 6

  return (
    <React.Fragment>
      <tbody>
        <tr
          style={{ backgroundColor: rowBg, borderTop: rowBorderTop, borderBottom: '1px solid #d4dce8' }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <td style={{ width: 46, padding: `${rowPadV}px 8px`, textAlign: 'center' }}>
            <input type="checkbox" checked={allSel}
              onChange={() => onToggleGroupSelect(getSubtreeInstanceIds(category.id))}
              onClick={e => e.stopPropagation()}
              style={{ cursor: 'pointer', accentColor: 'var(--c-primary)' }} />
          </td>

          <td
            colSpan={headerColSpan}
            onClick={e => { if ((e.target as HTMLElement).closest('button,input')) return; onToggleCollapse(category.id) }}
            style={{ padding: `${rowPadV}px 12px`, paddingLeft: 12 + depth * 20, cursor: 'pointer', userSelect: 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--c-gray-600)', lineHeight: 1, flexShrink: 0 }}>
                {isCollapsed ? '▶' : '▼'}
              </span>

              {renaming ? (
                <input
                  ref={renameRef}
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') cancelRename() }}
                  onBlur={commitRename}
                  onClick={e => e.stopPropagation()}
                  style={{ flex: 1, padding: '2px 6px', fontSize: nameFontSize, border: '1px solid var(--c-primary)', borderRadius: 4, fontWeight: nameFontWeight }}
                />
              ) : (
                <span style={{ fontWeight: nameFontWeight, fontSize: nameFontSize, color: '#222', flex: 1, letterSpacing: depth === 0 ? 0.4 : 0.2 }}>
                  {category.name}
                  <span style={{ fontWeight: 400, color: '#999', marginLeft: 6, fontSize: nameFontSize - 2 }}>({totalCount})</span>
                </span>
              )}

              {!renaming && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0, opacity: hovered ? 1 : 0.22, transition: 'opacity 0.15s' }}>
                  <Button size="sm" variant="success" onClick={e => { e.stopPropagation(); startAddChild() }} title="Add child category">+ child</Button>
                  <Button size="sm" variant="primary" onClick={e => { e.stopPropagation(); startRename() }} title="Rename">✎</Button>
                  <Button size="sm" variant="danger"  onClick={e => { e.stopPropagation(); handleDelete() }}
                    title="Deleting a category never deletes words — they become uncategorized">🗑</Button>
                </div>
              )}
            </div>
          </td>
        </tr>

        {addingChild && (
          <tr style={{ backgroundColor: '#fafbfc', borderBottom: '1px solid #e2e8f0' }}>
            <td />
            <td colSpan={headerColSpan} style={{ padding: '6px 12px', paddingLeft: 12 + (depth + 1) * 20 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  ref={addChildRef}
                  value={newChildName}
                  onChange={e => setNewChildName(e.target.value)}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') commitAddChild(); if (e.key === 'Escape') cancelAddChild() }}
                  placeholder="New subcategory name…"
                  style={{ flex: 1, padding: '4px 8px', fontSize: 13, border: '1px solid var(--c-primary)', borderRadius: 4 }}
                />
                <Button size="sm" variant="success" onClick={commitAddChild}>Add</Button>
                <Button size="sm" variant="muted" onClick={cancelAddChild}>Cancel</Button>
              </div>
            </td>
          </tr>
        )}
      </tbody>

      {!isCollapsed && (
        <>
          {node.children.map(child => (
            <CategoryNode
              key={child.category.id}
              node={child}
              depth={depth + 1}
              categories={categories}
              words={words}
              selectedInstanceIds={selectedInstanceIds}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              getSubtreeInstanceIds={getSubtreeInstanceIds}
              onToggleGroupSelect={onToggleGroupSelect}
              rowProps={rowProps}
              onAddCategory={onAddCategory}
              onUpdateCategory={onUpdateCategory}
              onDeleteCategory={onDeleteCategory}
            />
          ))}
          {groupWords.length > 0 && (
            <tbody>
              {groupWords.map(w => {
                const item: FlatItem = { word: w, instanceId: `${w.id}:${category.id}`, categoryId: category.id, depth }
                return <WordRow key={item.instanceId} item={item} rowProps={rowProps} />
              })}
            </tbody>
          )}
        </>
      )}
      {confirmMsg && (
        <ConfirmDialog
          message={confirmMsg}
          onConfirm={() => { onDeleteCategory(category.id); setConfirmMsg(null) }}
          onCancel={() => setConfirmMsg(null)}
        />
      )}
    </React.Fragment>
  )
}
