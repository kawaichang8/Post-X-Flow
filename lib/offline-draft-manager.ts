"use client"

/**
 * オフライン下書き管理
 * IndexedDBを使用してオフライン時の下書きを保存・管理
 */

export interface OfflineDraft {
  id: string
  text: string
  hashtags: string[]
  naturalnessScore: number
  trend?: string
  purpose?: string
  formatType?: string
  createdAt: string
  updatedAt: string
  synced: boolean // サーバーに同期済みか
}

const DB_NAME = 'post-x-flow-drafts'
const STORE_NAME = 'drafts'
const DB_VERSION = 1

let db: IDBDatabase | null = null

/**
 * IndexedDBを初期化
 */
async function initDB(): Promise<IDBDatabase> {
  if (db) {
    return db
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('IndexedDBの初期化に失敗しました'))
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // オブジェクトストアが存在しない場合は作成
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = database.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: false,
        })

        // インデックスを作成
        objectStore.createIndex('createdAt', 'createdAt', { unique: false })
        objectStore.createIndex('synced', 'synced', { unique: false })
      }
    }
  })
}

/**
 * 下書きを保存
 */
export async function saveOfflineDraft(draft: Omit<OfflineDraft, 'id' | 'createdAt' | 'updatedAt' | 'synced'>): Promise<string> {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    const offlineDraft: OfflineDraft = {
      ...draft,
      id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      synced: false,
    }

    return new Promise((resolve, reject) => {
      const request = store.add(offlineDraft)

      request.onsuccess = () => {
        resolve(offlineDraft.id)
      }

      request.onerror = () => {
        reject(new Error('下書きの保存に失敗しました'))
      }
    })
  } catch (error) {
    console.error('Error saving offline draft:', error)
    throw error
  }
}

/**
 * すべての下書きを取得
 */
export async function getOfflineDrafts(): Promise<OfflineDraft[]> {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('createdAt')

    return new Promise((resolve, reject) => {
      const request = index.getAll()

      request.onsuccess = () => {
        const drafts = request.result as OfflineDraft[]
        // 作成日時の降順でソート
        drafts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        resolve(drafts)
      }

      request.onerror = () => {
        reject(new Error('下書きの取得に失敗しました'))
      }
    })
  } catch (error) {
    console.error('Error getting offline drafts:', error)
    return []
  }
}

/**
 * 未同期の下書きを取得
 */
export async function getUnsyncedDrafts(): Promise<OfflineDraft[]> {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('synced')

    return new Promise((resolve, reject) => {
      // IndexedDBのgetAllは引数を受け取らないため、全件取得してフィルタリング
      const request = index.getAll()

      request.onsuccess = () => {
        const allDrafts = request.result as OfflineDraft[]
        const drafts = allDrafts.filter(draft => !draft.synced)
        resolve(drafts)
      }

      request.onerror = () => {
        reject(new Error('未同期下書きの取得に失敗しました'))
      }
    })
  } catch (error) {
    console.error('Error getting unsynced drafts:', error)
    return []
  }
}

/**
 * 下書きを更新
 */
export async function updateOfflineDraft(
  id: string,
  updates: Partial<Omit<OfflineDraft, 'id' | 'createdAt' | 'synced'>>
): Promise<void> {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    // 既存の下書きを取得
    const getRequest = store.get(id)

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const draft = getRequest.result as OfflineDraft
        if (!draft) {
          reject(new Error('下書きが見つかりません'))
          return
        }

        // 更新
        const updatedDraft: OfflineDraft = {
          ...draft,
          ...updates,
          updatedAt: new Date().toISOString(),
        }

        const updateRequest = store.put(updatedDraft)

        updateRequest.onsuccess = () => {
          resolve()
        }

        updateRequest.onerror = () => {
          reject(new Error('下書きの更新に失敗しました'))
        }
      }

      getRequest.onerror = () => {
        reject(new Error('下書きの取得に失敗しました'))
      }
    })
  } catch (error) {
    console.error('Error updating offline draft:', error)
    throw error
  }
}

/**
 * 下書きを削除
 */
export async function deleteOfflineDraft(id: string): Promise<void> {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.delete(id)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error('下書きの削除に失敗しました'))
      }
    })
  } catch (error) {
    console.error('Error deleting offline draft:', error)
    throw error
  }
}

/**
 * 下書きを同期済みとしてマーク
 */
export async function markDraftAsSynced(id: string): Promise<void> {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    // 既存の下書きを取得
    const getRequest = store.get(id)

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const draft = getRequest.result as OfflineDraft
        if (!draft) {
          reject(new Error('下書きが見つかりません'))
          return
        }

        // 同期済みとしてマーク
        const updatedDraft: OfflineDraft = {
          ...draft,
          synced: true,
          updatedAt: new Date().toISOString(),
        }

        const updateRequest = store.put(updatedDraft)

        updateRequest.onsuccess = () => {
          resolve()
        }

        updateRequest.onerror = () => {
          reject(new Error('下書きの更新に失敗しました'))
        }
      }

      getRequest.onerror = () => {
        reject(new Error('下書きの取得に失敗しました'))
      }
    })
  } catch (error) {
    console.error('Error marking draft as synced:', error)
    throw error
  }
}

/**
 * すべての下書きを削除
 */
export async function clearOfflineDrafts(): Promise<void> {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    return new Promise((resolve, reject) => {
      const request = store.clear()

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error('下書きの削除に失敗しました'))
      }
    })
  } catch (error) {
    console.error('Error clearing offline drafts:', error)
    throw error
  }
}

/**
 * オフライン下書きをサーバーに同期
 */
export async function syncOfflineDraftsToServer(
  userId: string,
  syncFn: (draft: OfflineDraft) => Promise<void>
): Promise<{ synced: number; failed: number }> {
  const unsyncedDrafts = await getUnsyncedDrafts()
  let synced = 0
  let failed = 0

  for (const draft of unsyncedDrafts) {
    try {
      await syncFn(draft)
      await markDraftAsSynced(draft.id)
      synced++
    } catch (error) {
      console.error('Error syncing draft:', error)
      failed++
    }
  }

  return { synced, failed }
}
