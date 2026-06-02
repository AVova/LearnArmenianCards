import React from 'react'
import { Lang, useI18n } from '../lib/i18n'

const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
  { code: 'hy', label: 'ՀԱՅ' },
]

export default function LanguagePicker() {
  const { lang, setLang } = useI18n()
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          style={{
            padding: '4px 8px', fontSize: 11, fontWeight: 600,
            border: '1px solid',
            borderColor: lang === code ? '#007bff' : '#dee2e6',
            backgroundColor: lang === code ? '#007bff' : '#f8f9fa',
            color: lang === code ? '#fff' : '#555',
            borderRadius: 4, cursor: 'pointer',
            transition: 'background-color 0.1s, color 0.1s',
            lineHeight: 1.4,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
