import type { StateStorage } from 'zustand/middleware'

const DB_NAME = 'image-collage-app-db'
const STORE_NAME = 'zustand'
const DB_VERSION = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = action(store)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
    request.onsuccess = () => resolve(request.result as T)
  })
}

async function migrateLegacyLocalStorage(key: string): Promise<string | null> {
  try {
    const legacy = localStorage.getItem(key)
    if (!legacy) return null
    await withStore('readwrite', (store) => store.put(legacy, key))
    localStorage.removeItem(key)
    return legacy
  } catch {
    return localStorage.getItem(key)
  }
}

export const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const value = await withStore('readonly', (store) => store.get(name))
      if (typeof value === 'string') return value
      return await migrateLegacyLocalStorage(name)
    } catch {
      return localStorage.getItem(name)
    }
  },
  setItem: async (name, value) => {
    try {
      await withStore('readwrite', (store) => store.put(value, name))
      if (localStorage.getItem(name)) {
        localStorage.removeItem(name)
      }
    } catch (error) {
      console.error('Failed to persist app state to IndexedDB:', error)
      throw error
    }
  },
  removeItem: async (name) => {
    try {
      await withStore('readwrite', (store) => store.delete(name))
    } catch {
      localStorage.removeItem(name)
    }
  },
}
