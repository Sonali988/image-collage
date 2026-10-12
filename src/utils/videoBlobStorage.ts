import { createId } from './imageLoader'

const DB_NAME = 'image-collage-app-db'
const VIDEO_STORE = 'videos'
const DB_VERSION = 2

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('zustand')) {
        db.createObjectStore('zustand')
      }
      if (!db.objectStoreNames.contains(VIDEO_STORE)) {
        db.createObjectStore(VIDEO_STORE)
      }
    }
  })
}

async function withVideoStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(VIDEO_STORE, mode)
    const store = transaction.objectStore(VIDEO_STORE)
    const request = action(store)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB video request failed'))
    request.onsuccess = () => resolve(request.result as T)
  })
}

export async function saveVideoBlob(file: File, id?: string): Promise<string> {
  const videoId = id ?? createId()
  await withVideoStore('readwrite', (store) => store.put(file, videoId))
  return videoId
}

export async function getVideoBlob(videoId: string): Promise<Blob | null> {
  try {
    const result = await withVideoStore('readonly', (store) => store.get(videoId))
    return result instanceof Blob ? result : null
  } catch {
    return null
  }
}

export async function deleteVideoBlob(videoId: string): Promise<void> {
  try {
    await withVideoStore('readwrite', (store) => store.delete(videoId))
  } catch {
    // ignore
  }
}

export async function createVideoObjectUrl(videoId: string): Promise<string | null> {
  const blob = await getVideoBlob(videoId)
  if (!blob) return null
  return URL.createObjectURL(blob)
}
