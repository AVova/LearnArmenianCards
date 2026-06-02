import React from 'react'

type ModalProps = {
  children: React.ReactNode
  onClose?: () => void
  maxWidth?: number
}

/** Fixed backdrop + centered scrollable container. Click backdrop to close. */
export function Modal({ children, onClose, maxWidth = 500 }: ModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#fff', borderRadius: 8, padding: 24,
          maxWidth, width: '90%',
          boxShadow: 'var(--shadow-xl)',
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}
