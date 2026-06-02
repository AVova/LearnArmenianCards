import React, { useRef, useState } from 'react'
import { VocabMeta } from '../lib/types'
import { useI18n } from '../lib/i18n'
import { generateVocabFilename } from '../lib/tauri-storage'

type Props = {
  onClose: () => void
  onCreate: (vocab: VocabMeta, importedYaml?: string) => void
  onUpdate?: (updated: VocabMeta) => void
  // Import mode: pre-filled from a .vocab file the user chose
  importYaml?: string
  importMeta?: Partial<VocabMeta>
  // Edit mode: pre-filled from an existing vocab to change its metadata
  editingVocab?: VocabMeta
}

function makeId(): string {
  return `vocab-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`
}

export default function VocabCreator({ onClose, onCreate, onUpdate, importYaml, importMeta, editingVocab }: Props) {
  const isEditMode   = !!editingVocab
  const isImportMode = !!importYaml && !isEditMode

  const source = editingVocab ?? importMeta
  const [name,             setName]             = useState(source?.name             ?? '')
  const [learnedLang,      setLearnedLang]      = useState(source?.learnedLang      ?? '')
  const [knownLang,        setKnownLang]        = useState(source?.knownLang        ?? '')
  const [showTranscription, setShowTranscription] = useState(source?.showTranscription ?? true)

  const nameRef = useRef<HTMLInputElement>(null)
  const { t } = useI18n()

  React.useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 50)
  }, [])

  const isValid = name.trim().length > 0 && learnedLang.trim().length > 0 && knownLang.trim().length > 0

  function buildMeta(wordCount = 0): VocabMeta {
    const id = makeId()
    return {
      id,
      name: name.trim(),
      file: generateVocabFilename(id),
      learnedLang: learnedLang.trim(),
      knownLang: knownLang.trim(),
      showTranscription,
      createdAt: new Date().toISOString(),
      wordCount,
    }
  }

  const handleCreateEmpty = () => {
    if (!isValid) return
    onCreate(buildMeta(0))
  }

  const handleConfirmImport = () => {
    if (!isValid || !importYaml) return
    const wordCount = (importYaml.match(/^- id:/gm) ?? []).length
    onCreate(buildMeta(wordCount), importYaml)
  }

  const handleSaveEdit = () => {
    if (!isValid || !editingVocab || !onUpdate) return
    onUpdate({
      ...editingVocab,
      name: name.trim(),
      learnedLang: learnedLang.trim(),
      knownLang: knownLang.trim(),
      showTranscription,
    })
  }

  const title = isEditMode
    ? t('vocab.editVocab')
    : isImportMode
      ? t('vocab.create.importTitle')
      : t('vocab.create.title')

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        backgroundColor: '#fff', borderRadius: 14, padding: 32,
        width: 420, maxWidth: '90vw',
        boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
      }}>
        <h2 style={{ margin: '0 0 22px', fontSize: 20, fontWeight: 700 }}>{title}</h2>

        {isImportMode && (
          <div style={{
            marginBottom: 18, padding: '8px 12px', borderRadius: 7,
            backgroundColor: '#f0f7ff', border: '1px solid #c5deff',
            fontSize: 13, color: '#4a7cc7',
          }}>
            {t('vocab.create.importedNote')}
          </div>
        )}

        <label style={labelStyle}>{t('vocab.create.nameLabel')}</label>
        <input
          ref={nameRef}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t('vocab.create.namePlaceholder')}
          onKeyDown={e => {
            if (e.key === 'Escape') onClose()
            if (e.key === 'Enter' && isEditMode) handleSaveEdit()
          }}
          style={inputStyle}
        />

        <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('vocab.create.learningLabel')}</label>
            <input
              value={learnedLang}
              onChange={e => setLearnedLang(e.target.value)}
              placeholder={t('vocab.create.learningPlaceholder')}
              onKeyDown={e => { if (e.key === 'Escape') onClose() }}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t('vocab.create.knowsLabel')}</label>
            <input
              value={knownLang}
              onChange={e => setKnownLang(e.target.value)}
              placeholder={t('vocab.create.knowsPlaceholder')}
              onKeyDown={e => { if (e.key === 'Escape') onClose() }}
              style={inputStyle}
            />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showTranscription}
            onChange={e => setShowTranscription(e.target.checked)}
            style={{ accentColor: 'var(--c-primary)', width: 16, height: 16 }}
          />
          <span style={{ fontSize: 13, color: 'var(--c-gray-700)' }}>{t('vocab.create.transcriptionLabel')}</span>
        </label>

        <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #eee' }} />

        {isEditMode ? (
          <button
            onClick={handleSaveEdit}
            disabled={!isValid}
            style={{ ...btnStyle('#4a90e2'), width: '100%', opacity: !isValid ? 0.5 : 1, cursor: !isValid ? 'not-allowed' : 'pointer' }}
          >
            {t('vocab.create.saveChangesBtn')}
          </button>
        ) : isImportMode ? (
          <button
            onClick={handleConfirmImport}
            disabled={!isValid}
            style={{ ...btnStyle('#4a90e2'), width: '100%', opacity: !isValid ? 0.5 : 1, cursor: !isValid ? 'not-allowed' : 'pointer' }}
          >
            {t('vocab.create.createCopyBtn')}
          </button>
        ) : (
          <button
            onClick={handleCreateEmpty}
            disabled={!isValid}
            style={{ ...btnStyle('var(--c-primary)'), width: '100%', opacity: !isValid ? 0.5 : 1, cursor: !isValid ? 'not-allowed' : 'pointer' }}
          >
            {t('vocab.create.createEmptyBtn')}
          </button>
        )}

        <button
          onClick={onClose}
          style={{ ...btnStyle('var(--c-gray-50)'), width: '100%', marginTop: 10, color: 'var(--c-gray-700)', border: '1px solid #dee2e6' }}
        >
          {t('vocab.create.cancelBtn')}
        </button>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 13, color: '#444',
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box',
  padding: '9px 12px', fontSize: 14, border: '1px solid #dee2e6',
  borderRadius: 7, outline: 'none',
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '10px 0', fontSize: 14, backgroundColor: bg,
    color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600,
    cursor: 'pointer',
  }
}
