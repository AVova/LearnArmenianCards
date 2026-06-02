import React, { useEffect, useState } from 'react'
import { Category, PartOfSpeech, Word } from '../lib/types'
import { buildCategoryTree, TreeNode } from '../lib/categoryUtils'
import { useI18n } from '../lib/i18n'
import { Button, FormField, Modal } from '../ui'

type EditorProps = {
  word?: Word
  categories: Category[]
  onSave: (word: Word) => void
  onCancel: () => void
}

const POS_VALUES: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other']

const INPUT_STYLE: React.CSSProperties = {
  width: '100%', padding: 8, border: '1px solid var(--c-gray-300)',
  borderRadius: 4, fontSize: 14, boxSizing: 'border-box',
}
const INPUT_ERROR_STYLE: React.CSSProperties = { ...INPUT_STYLE, border: '2px solid var(--c-danger)' }

export default function Editor({ word, categories, onSave, onCancel }: EditorProps) {
  const { t } = useI18n()
  const [formData, setFormData] = useState({
    armenian: '',
    transcription: '',
    english: '',
    partOfSpeech: '' as PartOfSpeech | '',
    importance: 1 as 1 | 2 | 3,
  })
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (word) {
      setFormData({
        armenian: word.word || '',
        transcription: word.transcription || '',
        english: word.translations.find(t => t.lang === 'en')?.text || '',
        partOfSpeech: word.partOfSpeech || '',
        importance: word.metadata?.importance ?? 1,
      })
      setSelectedCategoryIds(new Set(word.categoryIds ?? []))
    } else {
      setFormData({ armenian: '', transcription: '', english: '', partOfSpeech: '', importance: 1 })
      setSelectedCategoryIds(new Set())
    }
    setErrors({})
  }, [word])

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!formData.armenian.trim()) newErrors.armenian = t('editor.wordRequired')
    if (!formData.transcription.trim()) newErrors.transcription = t('editor.transcriptionRequired')
    if (!formData.english.trim()) newErrors.english = t('editor.translationRequired')
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const newWord: Word = {
      id: word?.id || `word-${Date.now()}`,
      word: formData.armenian.trim(),
      transcription: formData.transcription.trim(),
      translations: [{ lang: 'en', text: formData.english.trim() }],
      metadata: { ...word?.metadata, importance: formData.importance },
      dateAdded: word?.dateAdded || new Date().toISOString(),
      partOfSpeech: formData.partOfSpeech || undefined,
      categoryIds: [...selectedCategoryIds],
    }
    onSave(newWord)
  }

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const tree = buildCategoryTree(categories)

  return (
    <Modal onClose={onCancel}>
      <h2 style={{ marginTop: 0, marginBottom: 20 }}>
        {word ? t('editor.editTitle') : t('editor.addTitle')}
      </h2>
      <form onSubmit={handleSubmit}>
        <FormField label={t('editor.wordLabel')} error={errors.armenian}>
          <input
            type="text"
            value={formData.armenian}
            onChange={e => setFormData({ ...formData, armenian: e.target.value })}
            style={errors.armenian ? INPUT_ERROR_STYLE : INPUT_STYLE}
            placeholder="e.g., Բարեւ"
          />
        </FormField>

        <FormField label={t('editor.transcriptionLabel')} error={errors.transcription}>
          <input
            type="text"
            value={formData.transcription}
            onChange={e => setFormData({ ...formData, transcription: e.target.value })}
            style={errors.transcription ? INPUT_ERROR_STYLE : INPUT_STYLE}
            placeholder="e.g., Barev"
          />
        </FormField>

        <FormField label={t('editor.translationLabel')} error={errors.english}>
          <input
            type="text"
            value={formData.english}
            onChange={e => setFormData({ ...formData, english: e.target.value })}
            style={errors.english ? INPUT_ERROR_STYLE : INPUT_STYLE}
            placeholder="e.g., Hello, Greetings"
          />
        </FormField>

        {/* Importance */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>{t('editor.importanceLabel')}</label>
          <div style={{ display: 'flex', gap: 16 }}>
            {([1, 2, 3] as const).map(v => (
              <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="importance"
                  value={v}
                  checked={formData.importance === v}
                  onChange={() => setFormData({ ...formData, importance: v })}
                />
                <span style={{ color: v === 3 ? 'var(--c-orange)' : v === 2 ? '#f09000' : '#f0c000', fontSize: 16, letterSpacing: 1 }}>
                  {'★'.repeat(v)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Part of Speech */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{t('editor.posLabel')}</label>
          <select
            value={formData.partOfSpeech}
            onChange={e => setFormData({ ...formData, partOfSpeech: e.target.value as PartOfSpeech | '' })}
            style={{ width: '100%', padding: 8, border: '1px solid var(--c-gray-300)', borderRadius: 4, fontSize: 14, boxSizing: 'border-box', backgroundColor: '#fff' }}
          >
            <option value="">{t('editor.notSet')}</option>
            {POS_VALUES.map(v => (
              <option key={v} value={v}>{t(`pos.${v}`)}</option>
            ))}
          </select>
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{t('editor.categoriesLabel')}</label>
            <div style={{ border: '1px solid var(--c-gray-300)', borderRadius: 4, maxHeight: 180, overflowY: 'auto', padding: '4px 0' }}>
              {tree.length === 0 ? (
                <div style={{ padding: '8px 12px', color: 'var(--c-faint)', fontSize: 13 }}>{t('editor.noCats')}</div>
              ) : (
                <CategoryChecklist nodes={tree} selected={selectedCategoryIds} onToggle={toggleCategory} depth={0} />
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Button type="button" variant="ghost" size="md" onClick={onCancel}>
            {t('editor.cancelBtn')}
          </Button>
          <Button type="submit" variant="primary" size="md">
            {t('editor.saveBtn')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function CategoryChecklist({ nodes, selected, onToggle, depth }: {
  nodes: TreeNode[]
  selected: Set<string>
  onToggle: (id: string) => void
  depth: number
}) {
  return (
    <>
      {nodes.map(node => (
        <React.Fragment key={node.category.id}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 12px',
            paddingLeft: 12 + depth * 18,
            cursor: 'pointer',
            userSelect: 'none',
          }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--c-gray-50)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <input
              type="checkbox"
              checked={selected.has(node.category.id)}
              onChange={() => onToggle(node.category.id)}
              style={{ accentColor: 'var(--c-primary)', flexShrink: 0 }}
            />
            <span style={{ fontSize: 14 }}>{node.category.name}</span>
          </label>
          {node.children.length > 0 && (
            <CategoryChecklist nodes={node.children} selected={selected} onToggle={onToggle} depth={depth + 1} />
          )}
        </React.Fragment>
      ))}
    </>
  )
}
