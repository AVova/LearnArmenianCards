import { Modal, Button } from '../ui'

type Props = {
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
  return (
    <Modal onClose={onCancel} maxWidth={380}>
      <p style={{ margin: '0 0 24px', fontSize: 15, lineHeight: 1.5, color: '#1a1a2e' }}>{message}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}
