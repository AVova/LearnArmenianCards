// Browser-mode storage: mirrors the tauri-storage.ts interface using localStorage.
// Keys: 'lc_meta' → GlobalMeta JSON, 'lc_vocab_{filename}' → YAML string.
// Storage limit ~5-10 MB — sufficient for typical vocab collections.

import { GlobalMeta, VocabMeta } from './types'

const META_KEY = 'lc_meta'
const vocabKey = (f: string) => `lc_vocab_${f}`

export function readGlobalMetaBrowser(): GlobalMeta {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return { version: 1, vocabs: [] }
    const data = JSON.parse(raw)
    return { version: data?.version ?? 1, vocabs: Array.isArray(data?.vocabs) ? data.vocabs : [] }
  } catch {
    return { version: 1, vocabs: [] }
  }
}

export function writeGlobalMetaBrowser(meta: GlobalMeta): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta))
}

export function readVocabFileBrowser(filename: string): string {
  const raw = localStorage.getItem(vocabKey(filename))
  if (raw === null) throw new Error(`Vocab not found in browser storage: ${filename}`)
  return raw
}

export function writeVocabFileBrowser(filename: string, yaml: string): void {
  localStorage.setItem(vocabKey(filename), yaml)
}

export function removeVocabBrowser(filename: string): void {
  localStorage.removeItem(vocabKey(filename))
}

export function upsertVocabInGlobalMetaBrowser(vocabMeta: VocabMeta): void {
  const meta = readGlobalMetaBrowser()
  const idx = meta.vocabs.findIndex(v => v.id === vocabMeta.id)
  if (idx >= 0) meta.vocabs[idx] = vocabMeta
  else meta.vocabs.push(vocabMeta)
  writeGlobalMetaBrowser(meta)
}

export function removeVocabFromGlobalMetaBrowser(id: string): void {
  const meta = readGlobalMetaBrowser()
  meta.vocabs = meta.vocabs.filter(v => v.id !== id)
  writeGlobalMetaBrowser(meta)
}

/** Opens an OS file picker; resolves with the file's text content, or null if cancelled. */
export function importVocabViaBrowserInput(): Promise<{ filename: string; yaml: string } | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.vocab,.yaml,.yml'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      const reader = new FileReader()
      reader.onload = () => resolve({ filename: file.name, yaml: reader.result as string })
      reader.onerror = () => resolve(null)
      reader.readAsText(file)
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

/** Triggers a browser download of the YAML as a .vocab file. */
export function exportVocabViaBrowser(yaml: string, suggestedName: string): void {
  const name = suggestedName.replace(/\.(yaml|yml)$/, '') + '.vocab'
  const blob = new Blob([yaml], { type: 'text/yaml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}
