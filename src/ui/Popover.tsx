import React from 'react'

type PopoverProps = {
  children: React.ReactNode
  onClose: () => void
}

/**
 * Floating panel that closes when clicking outside.
 * Must be inside a `position: relative` container.
 */
export function Popover({ children, onClose }: PopoverProps) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 299 }} />
      <div className="popover">{children}</div>
    </>
  )
}

export function PopoverItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="popover-item" onClick={onClick}>
      {label}
    </button>
  )
}
