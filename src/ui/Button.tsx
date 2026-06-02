import React from 'react'

export type ButtonVariant =
  | 'primary' | 'success' | 'danger' | 'purple'
  | 'muted'   | 'warning' | 'orange'
  | 'ghost'   | 'dark-subtle' | 'link'

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
}

/**
 * Single button primitive. All visual concerns live here and in index.css.
 * Feature components only choose variant + size; never specify colors or padding.
 */
export function Button({
  variant = 'ghost',
  size    = 'md',
  block,
  className,
  children,
  ...rest
}: ButtonProps) {
  const cls = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    block ? 'btn-block' : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}
