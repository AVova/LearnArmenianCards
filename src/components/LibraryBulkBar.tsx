import React from 'react'
import { Category, PartOfSpeech } from '../lib/types'
import { buildCategoryTree } from '../lib/categoryUtils'
import { Button } from '../ui'

export const POS_OPTIONS: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other']

type BulkActionBarProps = {
  count: number
  categories: Category[]
  commonCategoryIds: string[]
  activePopover: 'pos' | 'attach' | 'detach' | null
  onSetPopover: (p: 'pos' | 'attach' | 'detach' | null) => void
  onClearSelection: () => void
  onDelete: () => void
  onSetPoS: (pos: PartOfSpeech | '') => void
  onAttach: (id: string) => void
  onDetach: (id: string) => void
  onExerciseSelected?: () => void
}

export function BulkActionBar({
  count, categories, commonCategoryIds, activePopover, onSetPopover,
  onClearSelection, onDelete, onSetPoS, onAttach, onDetach, onExerciseSelected,
}: BulkActionBarProps) {
  const toggle = (p: 'pos' | 'attach' | 'detach') => onSetPopover(activePopover === p ? null : p)
  const commonCats = categories.filter(c => commonCategoryIds.includes(c.id))

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      backgroundColor: '#1a1a2e', color: '#fff', padding: '10px 16px', borderRadius: 10,
      display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      zIndex: 200, whiteSpace: 'nowrap', flexWrap: 'wrap', justifyContent: 'center',
    }}>
      <span style={{ fontWeight: 600, fontSize: 13 }}>{count} selected</span>

      <Button size="sm" variant="dark-subtle" onClick={onClearSelection}>Deselect</Button>

      {onExerciseSelected && (
        <Button size="sm" variant="purple" onClick={onExerciseSelected}>🃏 Exercise selected</Button>
      )}

      <div style={{ position: 'relative' }}>
        <Button size="sm" variant="muted" onClick={() => toggle('pos')}>Part of speech ▾</Button>
        {activePopover === 'pos' && (
          <Popover onClose={() => onSetPopover(null)}>
            <PopoverItem label="— clear —" onClick={() => onSetPoS('')} />
            {POS_OPTIONS.map(p => <PopoverItem key={p} label={p.charAt(0).toUpperCase() + p.slice(1)} onClick={() => onSetPoS(p)} />)}
          </Popover>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <Button size="sm" variant="primary" onClick={() => toggle('attach')}>Attach category ▾</Button>
        {activePopover === 'attach' && (
          <Popover onClose={() => onSetPopover(null)}>
            {categories.length === 0
              ? <div style={{ padding: '8px 12px', color: 'var(--c-faint)', fontSize: 13 }}>No categories</div>
              : <CatPickerNodes nodes={buildCategoryTree(categories)} onPick={onAttach} depth={0} />}
          </Popover>
        )}
      </div>

      <div style={{ position: 'relative' }}>
        <Button size="sm" variant="orange"
          onClick={() => commonCategoryIds.length > 0 && toggle('detach')}
          disabled={commonCategoryIds.length === 0}
          title={commonCategoryIds.length === 0 ? 'No common categories among selected words' : undefined}
        >
          Detach category ▾
        </Button>
        {activePopover === 'detach' && commonCats.length > 0 && (
          <Popover onClose={() => onSetPopover(null)}>
            {commonCats.map(c => <PopoverItem key={c.id} label={c.name} onClick={() => onDetach(c.id)} />)}
          </Popover>
        )}
      </div>

      <Button size="sm" variant="danger" onClick={onDelete}>🗑 Delete</Button>
    </div>
  )
}

function Popover({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 299 }} />
      <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 8, backgroundColor: '#fff', borderRadius: 8, border: '1px solid #dee2e6', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', minWidth: 180, maxHeight: 280, overflowY: 'auto', zIndex: 300 }}>
        {children}
      </div>
    </>
  )
}

function PopoverItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--c-gray-800)' }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--c-gray-100)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
    >{label}</button>
  )
}

function CatPickerNodes({ nodes, onPick, depth }: { nodes: ReturnType<typeof buildCategoryTree>; onPick: (id: string) => void; depth: number }): React.ReactElement {
  return (
    <>
      {nodes.map(node => (
        <React.Fragment key={node.category.id}>
          <button onClick={() => onPick(node.category.id)}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', paddingLeft: 12 + depth * 14, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--c-gray-100)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >{node.category.name}</button>
          {node.children.length > 0 && <CatPickerNodes nodes={node.children} onPick={onPick} depth={depth + 1} />}
        </React.Fragment>
      ))}
    </>
  )
}
