// File I/O layer. Three storage mechanisms:
//   File System Access API  — open/save the vocabulary YAML file
//   IndexedDB               — persist file handles across sessions (so "recent files" can reopen without picker)
//   localStorage            — store recent file metadata (name, last-opened timestamp)

export type RecentVocabularyFile = {
  id: string
  name: string
  lastOpened: string
  handleId?: string
}

const RECENT_FILES_KEY = 'langCards.recentVocabularyFiles'
const HANDLE_DB_NAME = 'langCardsFileHandles'
const HANDLE_STORE_NAME = 'handles'
const MAX_RECENT_FILES = 6

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        db.createObjectStore(HANDLE_STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function saveHandleEntry(handleId: string, handle: any): Promise<void> {
  const db = await openHandleDatabase()
  const transaction = db.transaction(HANDLE_STORE_NAME, 'readwrite')
  const store = transaction.objectStore(HANDLE_STORE_NAME)
  store.put({ id: handleId, handle })
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

async function getHandleEntry(handleId: string): Promise<any | null> {
  const db = await openHandleDatabase()
  const transaction = db.transaction(HANDLE_STORE_NAME, 'readonly')
  const store = transaction.objectStore(HANDLE_STORE_NAME)
  const request = store.get(handleId)
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result?.handle ?? null)
    request.onerror = () => reject(request.error)
  })
}

async function deleteHandleEntry(handleId: string): Promise<void> {
  const db = await openHandleDatabase()
  const transaction = db.transaction(HANDLE_STORE_NAME, 'readwrite')
  const store = transaction.objectStore(HANDLE_STORE_NAME)
  store.delete(handleId)
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

export async function openVocabularyFile(): Promise<{ file: File; handle?: any } | null> {
  if (typeof (window as any).showOpenFilePicker === 'function') {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'Vocabulary Files',
            accept: {
              'application/x-yaml': ['.yaml', '.yml']
            }
          }
        ],
        multiple: false
      })
      const file = await handle.getFile()
      return { file, handle }
    } catch (e) {
      return null
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.yaml,.yml'
    input.onchange = (e: any) => {
      const file = e.target.files?.[0]
      resolve(file ? { file } : null)
    }
    input.click()
  })
}

export async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export async function saveFileToHandle(handle: any, content: string): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
}

export async function saveYAMLToHandle(handle: any, words: string): Promise<void> {
  return saveFileToHandle(handle, words)
}


function getStoredRecentFiles(): RecentVocabularyFile[] {
  const raw = localStorage.getItem(RECENT_FILES_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as RecentVocabularyFile[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function storeRecentFiles(files: RecentVocabularyFile[]) {
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(files))
}

export async function getRecentVocabularyFiles(): Promise<RecentVocabularyFile[]> {
  const files = getStoredRecentFiles()
  return files.sort((a, b) => (a.lastOpened < b.lastOpened ? 1 : -1))
}

export async function addRecentVocabularyFile(entry: { name: string; handle?: any }): Promise<void> {
  const recentFiles = getStoredRecentFiles()
  const existingIndex = recentFiles.findIndex(file => file.name === entry.name)
  if (existingIndex !== -1) {
    recentFiles.splice(existingIndex, 1)
  }

  const id = createId()
  const newEntry: RecentVocabularyFile = {
    id,
    name: entry.name,
    lastOpened: new Date().toISOString(),
    handleId: entry.handle ? id : undefined
  }

  if (entry.handle) {
    try {
      await saveHandleEntry(id, entry.handle)
    } catch (e) {
      console.error('Unable to save file handle:', e)
    }
  }

  const updated = [newEntry, ...recentFiles].slice(0, MAX_RECENT_FILES)
  const removed = recentFiles.slice(MAX_RECENT_FILES)
  for (const removedItem of removed) {
    if (removedItem.handleId) {
      deleteHandleEntry(removedItem.handleId).catch(() => {})
    }
  }
  storeRecentFiles(updated)
}

export async function openRecentVocabularyFile(recent: RecentVocabularyFile): Promise<{ file: File; handle?: any } | null> {
  if (!recent.handleId) {
    return null
  }

  const handle = await getHandleEntry(recent.handleId)
  if (!handle) {
    return null
  }

  try {
    const permission = await (async () => {
      if (typeof handle.queryPermission === 'function') {
        const status = await handle.queryPermission({ mode: 'read' })
        if (status === 'granted') return status
      }
      if (typeof handle.requestPermission === 'function') {
        return await handle.requestPermission({ mode: 'read' })
      }
      return 'granted'
    })()

    if (permission !== 'granted') {
      return null
    }

    const file = await handle.getFile()
    return { file, handle }
  } catch (e) {
    console.error('Unable to open recent vocabulary file handle:', e)
    return null
  }
}
