import React, { useState } from 'react'
import { VocabMeta } from '../lib/types'
import { useI18n } from '../lib/i18n'
import { IS_TAURI } from '../lib/platform'
import { importVocabViaDialog } from '../lib/tauri-storage'
import { importVocabViaBrowserInput } from '../lib/browser-storage'
import { parseVocabularyFromYAML } from '../lib/parser'
import VocabCreator from './VocabCreator'
import LanguagePicker from './LanguagePicker'
import ConfirmDialog from './ConfirmDialog'

type Props = {
  vocabList: VocabMeta[]
  onSelect: (vocab: VocabMeta) => void
  onCreate: (vocab: VocabMeta, importedYaml?: string) => void
  onUpdate: (updated: VocabMeta) => void
  onDelete: (vocab: VocabMeta) => void
  onExport: (vocab: VocabMeta) => void
}

function cleanName(vocab: VocabMeta): string {
  return vocab.name.replace(/\.(yaml|yml|vocab)$/i, '') || vocab.name
}

export default function VocabPicker({ vocabList, onSelect, onCreate, onUpdate, onDelete, onExport }: Props) {
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [showCreator,  setShowCreator]  = useState(false)
  const [importData,   setImportData]   = useState<{ yaml: string; meta: Partial<VocabMeta> } | null>(null)
  const [editingVocab, setEditingVocab] = useState<VocabMeta | null>(null)
  const [hoveredId,    setHoveredId]    = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<VocabMeta | null>(null)
  const { t } = useI18n()

  const selected = vocabList.find(v => v.id === selectedId) ?? null

  const openCreate = () => { setImportData(null); setEditingVocab(null); setShowCreator(true) }
  const openEdit   = () => { if (selected) { setEditingVocab(selected); setImportData(null); setShowCreator(true) } }

  const handleImportClick = async () => {
    try {
      const result = IS_TAURI
        ? await importVocabViaDialog()
        : await importVocabViaBrowserInput()
      if (!result) return
      const { vocabulary } = parseVocabularyFromYAML(result.yaml)
      const inferredName = result.filename.replace(/\.(yaml|yml|vocab)$/i, '')
      setImportData({ yaml: result.yaml, meta: vocabulary ?? { name: inferredName } })
      setEditingVocab(null)
      setShowCreator(true)
    } catch (e) {
      console.error('Import failed:', e)
      alert(`Import failed:\n${e}`)
    }
  }

  const closeCreator = () => { setShowCreator(false); setImportData(null); setEditingVocab(null) }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#f4f6fb', fontFamily: 'Inter, system-ui, Arial',
    }}>
      {/* Language picker — top right */}
      <div style={{ position: 'fixed', top: 20, right: 24 }}>
        <LanguagePicker />
      </div>

      <div style={{ width: '100%', maxWidth: 520, padding: '0 24px' }}>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{ margin: 0, fontSize: 42, fontWeight: 900, color: '#1a1a2e', letterSpacing: -1 }}>
            Lang Cards
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#8a8fa8' }}>
            {t('vocab.subtitle')}
          </p>
        </div>

        {/* Vocab list */}
        {vocabList.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '36px 20px', marginBottom: 20,
            border: '2px dashed #cdd3e8', borderRadius: 14, color: '#aaa',
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📚</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              {t('vocab.noVocabs').split('\n').map((line, i) =>
                <React.Fragment key={i}>{line}{i === 0 ? <br /> : null}</React.Fragment>
              )}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {vocabList.map(vocab => {
              const isSelected = selectedId === vocab.id
              const isHovered  = hoveredId  === vocab.id

              return (
                <div
                  key={vocab.id}
                  onClick={() => setSelectedId(isSelected ? null : vocab.id)}
                  onMouseEnter={() => setHoveredId(vocab.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '14px 16px',
                    backgroundColor: isSelected ? '#eef4ff' : '#fff',
                    borderRadius: 12,
                    border: `2px solid ${isSelected ? '#4a90e2' : isHovered ? '#c8d6f0' : '#e4e8f0'}`,
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 3px 16px rgba(74,144,226,0.18)' : isHovered ? '0 2px 10px rgba(0,0,0,0.07)' : '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'border-color 0.12s, box-shadow 0.12s',
                    userSelect: 'none',
                  }}
                >
                  {/* Radio dot */}
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', marginRight: 13, flexShrink: 0,
                    border: `2px solid ${isSelected ? '#4a90e2' : '#ccc'}`,
                    backgroundColor: isSelected ? '#4a90e2' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.12s',
                  }}>
                    {isSelected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e', marginBottom: 3,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cleanName(vocab)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{
                        padding: '1px 7px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        backgroundColor: isSelected ? '#d6e8ff' : '#f0f4ff', color: '#4a7cc7',
                      }}>
                        {vocab.learnedLang} → {vocab.knownLang}
                      </span>
                      {vocab.wordCount !== undefined && (
                        <span style={{ color: '#aaa' }}>{vocab.wordCount} {t('vocab.wordsSuffix')}</span>
                      )}
                    </div>
                  </div>

                  {/* Delete icon — visible on hover or selected */}
                  {(isSelected || isHovered) && (
                    <div style={{ marginLeft: 6 }} onClick={e => e.stopPropagation()}>
                      <CardBtn title="Delete" danger onClick={() => setPendingDelete(vocab)}>🗑</CardBtn>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Action buttons ─────────────────────────────────── */}

        {/* Study — big primary, disabled until selected */}
        <button
          onClick={() => selected && onSelect(selected)}
          disabled={!selected}
          style={{
            width: '100%', padding: '14px 0', marginBottom: 10,
            fontSize: 17, fontWeight: 700, letterSpacing: 0.2,
            backgroundColor: selected ? '#4a90e2' : '#d0d6e8', color: '#fff',
            border: 'none', borderRadius: 12,
            cursor: selected ? 'pointer' : 'default',
            boxShadow: selected ? '0 4px 18px rgba(74,144,226,0.32)' : 'none',
            transition: 'background-color 0.18s, box-shadow 0.18s',
          }}
        >
          {selected ? `▶  ${t('vocab.study')}` : t('vocab.selectToStart')}
        </button>

        {/* Edit + Export — disabled until selected */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button onClick={openEdit} disabled={!selected} style={secondaryBtnStyle(!selected)}>
            ✏  {t('vocab.editVocab')}
          </button>
          <button
            onClick={() => selected && onExport(selected)}
            disabled={!selected}
            style={secondaryBtnStyle(!selected)}
          >
            ↑  {t('vocab.exportVocab')}
          </button>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid #e4e8f0', marginBottom: 16 }} />

        {/* Create + Import — always available */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={openCreate}
            style={{
              flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 700,
              backgroundColor: '#fff', color: '#4a90e2',
              border: '2px solid #4a90e2', borderRadius: 10, cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f6ff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#fff' }}
          >
            {t('vocab.createNew')}
          </button>
          <button
            onClick={handleImportClick}
            style={{
              flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 700,
              backgroundColor: '#fff', color: '#4a90e2',
              border: '2px solid #4a90e2', borderRadius: 10, cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f0f6ff' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#fff' }}
          >
            {t('vocab.importVocab')}
          </button>
        </div>
        {/* Desktop download links — only shown in browser/web mode */}
        {!IS_TAURI && (
          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #e4e8f0' }}>
            <div style={{ textAlign: 'center', fontSize: 11, color: '#aaa', marginBottom: 10, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>
              Download desktop app
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
              {([
                { label: '↓ Windows', href: 'https://github.com/AVova/LearnArmenianCards/releases/download/v1.0.3/Lang.Cards_1.0.3_x64_en-US.msi' },
                { label: '↓ Ubuntu', href: 'https://github.com/AVova/LearnArmenianCards/releases/download/v1.0.3/Lang.Cards_1.0.3_amd64.deb' },
                { label: '↓ macOS', href: 'https://github.com/AVova/LearnArmenianCards/releases/download/v1.0.3/Lang.Cards_1.0.3_aarch64.dmg' },
              ] as { label: string; href: string }[]).map(({ label, href }) => (
                <a key={href} href={href}
                  style={{ fontSize: 13, color: '#4a90e2', textDecoration: 'none', fontWeight: 600 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none' }}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCreator && (
        <VocabCreator
          onClose={closeCreator}
          onCreate={(vocab, importedYaml) => { closeCreator(); onCreate(vocab, importedYaml) }}
          onUpdate={(updated) => { closeCreator(); onUpdate(updated) }}
          importYaml={importData?.yaml}
          importMeta={importData?.meta}
          editingVocab={editingVocab ?? undefined}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          message={t('vocab.deleteConfirm', { name: cleanName(pendingDelete) })}
          onConfirm={() => {
            if (selectedId === pendingDelete.id) setSelectedId(null)
            onDelete(pendingDelete)
            setPendingDelete(null)
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}

function CardBtn({ children, onClick, title, danger }: {
  children: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  title?: string
  danger?: boolean
}) {
  return (
    <button onClick={onClick} title={title} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      fontSize: 14, padding: '4px 6px', borderRadius: 5, lineHeight: 1,
      color: danger ? 'var(--c-danger)' : '#999',
    }}>
      {children}
    </button>
  )
}

function secondaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600,
    backgroundColor: disabled ? '#f8f9ff' : '#fff',
    color: disabled ? '#ccc' : '#555',
    border: `1px solid ${disabled ? '#eee' : '#d0d6e8'}`,
    borderRadius: 10, cursor: disabled ? 'default' : 'pointer',
  }
}
