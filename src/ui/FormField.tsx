import React from 'react'

type FormFieldProps = {
  label: string
  error?: string
  children: React.ReactNode
}

/** Label + input slot + optional error message. Consistent form field wrapper. */
export function FormField({ label, error, children }: FormFieldProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>{label}</label>
      {children}
      {error && (
        <span style={{ color: 'var(--c-danger)', fontSize: 12, marginTop: 4, display: 'block' }}>
          {error}
        </span>
      )}
    </div>
  )
}
