import React, { createContext, useContext, useState } from 'react'
import strings, { Strings, Lang } from '../locales/strings'

export type { Lang }

const STORAGE_KEY = 'langCards.uiLang'

const translations: Record<Lang, Strings> = strings

/** Resolve a dot-notation key from the translation object. Returns the key itself on miss. */
function resolve(strings: Strings, key: string): string {
  const value = key.split('.').reduce<any>((obj, k) => obj?.[k], strings)
  return typeof value === 'string' ? value : key
}

/** Replace {{param}} placeholders in a translated string. */
function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str
  return Object.entries(params).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v)),
    str,
  )
}

type I18nContextValue = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
})

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    () => {
      const stored = localStorage.getItem(STORAGE_KEY)
      return (stored === 'ru' || stored === 'hy') ? stored : 'en'
    },
  )

  const setLang = (l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l)
    setLangState(l)
  }

  const t = (key: string, params?: Record<string, string | number>) =>
    interpolate(resolve(translations[lang], key), params)

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
