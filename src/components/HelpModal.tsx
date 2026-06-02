import { Modal } from '../ui'
import { useI18n } from '../lib/i18n'

type Props = { onClose: () => void }

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: '#1a1a2e' }}>{title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.65, color: '#444', whiteSpace: 'pre-line' }}>{body}</div>
    </div>
  )
}

export default function HelpModal({ onClose }: Props) {
  const { t } = useI18n()

  return (
    <Modal onClose={onClose} maxWidth={560}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>{t('help.title')}</h2>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#888', lineHeight: 1 }}
        >✕</button>
      </div>

      <Section title={t('help.stagesTitle')} body={t('help.stagesBody')} />
      <Section title={t('help.bloomTitle')} body={t('help.bloomBody')} />
      <Section title={t('help.consolidateTitle')} body={t('help.consolidateBody')} />
      <Section title={t('help.cramTitle')} body={t('help.cramBody')} />
      <Section title={t('help.importanceTitle')} body={t('help.importanceBody')} />
      <Section title={t('help.tipsTitle')} body={t('help.tipsBody')} />
    </Modal>
  )
}
