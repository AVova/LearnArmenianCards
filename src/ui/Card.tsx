import React from 'react'

const PADDING = { sm: 16, md: 24, lg: 32, xl: 36 } as const

type CardProps = {
  children: React.ReactNode
  padding?: keyof typeof PADDING
  maxWidth?: number | string
  center?: boolean          // textAlign: center
  style?: React.CSSProperties
  className?: string
}

/** White rounded container with drop shadow. Used for setup, result screens, modals. */
export function Card({
  children,
  padding  = 'lg',
  maxWidth,
  center,
  style,
  className,
}: CardProps) {
  return (
    <div
      className={['card', className].filter(Boolean).join(' ')}
      style={{
        padding:   PADDING[padding],
        maxWidth,
        textAlign: center ? 'center' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
