// Native file system access via Tauri plugin-fs.
// Storage root: ~/Documents/LangCards/ — uses BaseDirectory.Home so $HOME is
// always resolvable even when the XDG Documents dir isn't configured on Linux.

import { BaseDirectory, mkdir, readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs'
import { homeDir, join } from '@tauri-apps/api/path'
import { open as dialogOpen, save as dialogSave } from '@tauri-apps/plugin-dialog'
import YAML from 'js-yaml'
import { GlobalMeta, VocabMeta } from './types'

// Use $HOME as the base — $DOCUMENT (XDG Documents) is not always configured on Linux.
// All paths below are relative to $HOME.
const FOLDER = 'Documents/LangCards'
const META_FILE = `${FOLDER}/metadata.yaml`
const BASE = BaseDirectory.Home

// Generate an opaque filename from the vocab ID. Never derived from the name.
export function generateVocabFilename(id: string): string {
  return `${id}.yaml`
}

// ── program folder ──────────────────────────────────────────────────────────

export async function ensureProgramFolder(): Promise<void> {
  const alreadyExists = await exists(FOLDER, { baseDir: BASE })
  if (!alreadyExists) {
    await mkdir(FOLDER, { recursive: true, baseDir: BASE })
  }
}

// ── global metadata.yaml ────────────────────────────────────────────────────

export async function readGlobalMeta(): Promise<GlobalMeta> {
  const fileExists = await exists(META_FILE, { baseDir: BASE })
  if (!fileExists) return { version: 1, vocabs: [] }
  try {
    const text = await readTextFile(META_FILE, { baseDir: BASE })
    const data = YAML.load(text) as any
    return {
      version: data?.version ?? 1,
      vocabs: Array.isArray(data?.vocabs) ? data.vocabs : [],
    }
  } catch {
    return { version: 1, vocabs: [] }
  }
}

export async function writeGlobalMeta(meta: GlobalMeta): Promise<void> {
  await writeTextFile(META_FILE, YAML.dump(meta, { lineWidth: -1, noRefs: true }), {
    baseDir: BASE,
  })
}

// ── individual vocab files ──────────────────────────────────────────────────

export async function readVocabFile(filename: string): Promise<string> {
  return readTextFile(`${FOLDER}/${filename}`, { baseDir: BASE })
}

export async function writeVocabFile(filename: string, yaml: string): Promise<void> {
  await writeTextFile(`${FOLDER}/${filename}`, yaml, { baseDir: BASE })
}

// ── import / export via OS dialogs ─────────────────────────────────────────

export async function importVocabViaDialog(): Promise<{ filename: string; yaml: string } | null> {
  const docsDir = await homeDir()
  const selected = await dialogOpen({
    multiple: false,
    defaultPath: docsDir,
    filters: [{ name: 'Vocabulary file', extensions: ['vocab', 'yaml', 'yml'] }],
  })
  if (!selected || typeof selected !== 'string') return null
  const text = await readTextFile(selected)
  const basename = selected.split(/[\\/]/).pop() ?? 'imported.yaml'
  return { filename: basename, yaml: text }
}

export async function exportVocabViaDialog(yaml: string, suggestedName: string): Promise<boolean> {
  const docsDir = await homeDir()
  const nameWithExt = suggestedName.replace(/\.(yaml|yml)$/, '') + '.vocab'
  const defaultPath = await join(docsDir, nameWithExt)
  const path = await dialogSave({
    defaultPath,
    filters: [{ name: 'Vocabulary file', extensions: ['vocab'] }],
  })
  if (!path) return false
  await writeTextFile(path, yaml)
  return true
}

// ── vocab management helpers ────────────────────────────────────────────────

/** Add or update a vocab entry in global metadata and write it to disk. */
export async function upsertVocabInGlobalMeta(vocabMeta: VocabMeta): Promise<void> {
  const global = await readGlobalMeta()
  const idx = global.vocabs.findIndex(v => v.id === vocabMeta.id)
  if (idx >= 0) global.vocabs[idx] = vocabMeta
  else global.vocabs.push(vocabMeta)
  await writeGlobalMeta(global)
}

/** Remove a vocab from global metadata (does not delete the YAML file). */
export async function removeVocabFromGlobalMeta(id: string): Promise<void> {
  const global = await readGlobalMeta()
  global.vocabs = global.vocabs.filter(v => v.id !== id)
  await writeGlobalMeta(global)
}
