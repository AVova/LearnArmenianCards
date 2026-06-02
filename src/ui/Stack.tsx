import React from 'react'

type StackProps = {
  children: React.ReactNode
  gap?: number | string
  style?: React.CSSProperties
}

/** Vertical flex container with uniform gap. Eliminates the repeated flex+flexDirection+gap pattern. */
export function Stack({ children, gap = 12, style }: StackProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
      {children}
    </div>
  )
}
