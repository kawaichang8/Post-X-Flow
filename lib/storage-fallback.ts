/**
 * ローカルストレージフォールバック
 * DB接続エラー時にローカルストレージに保存
 */

export interface LocalStoragePost {
  id: string
  userId: string
  text: string
  hashtags: string[]
  naturalnessScore: number
  trend: string
  purpose: string
  status: 'draft' | 'posted' | 'scheduled'
  createdAt: string
  synced: boolean // DBに同期済みか
}

const STORAGE_KEY_PREFIX = 'post-x-flow:'
const STORAGE_KEY_POSTS = `${STORAGE_KEY_PREFIX}posts`
const STORAGE_KEY_SYNC_QUEUE = `${STORAGE_KEY_PREFIX}sync-queue`

/**
 * ローカルストレージに投稿を保存
 */
export function savePostToLocalStorage(post: Omit<LocalStoragePost, 'id' | 'createdAt' | 'synced'>): string {
  if (typeof window === 'undefined') {
    throw new Error('LocalStorage is only available in browser')
  }

  const id = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const postWithId: LocalStoragePost = {
    ...post,
    id,
    createdAt: new Date().toISOString(),
    synced: false,
  }

  const existing = getPostsFromLocalStorage()
  existing.push(postWithId)
  localStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(existing))

  // 同期キューに追加
  addToSyncQueue(id)

  return id
}

/**
 * ローカルストレージから投稿を取得
 */
export function getPostsFromLocalStorage(): LocalStoragePost[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY_POSTS)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Error reading from localStorage:', error)
    return []
  }
}

/**
 * ローカルストレージから特定ユーザーの投稿を取得
 */
export function getPostsByUserId(userId: string): LocalStoragePost[] {
  const allPosts = getPostsFromLocalStorage()
  return allPosts.filter((post) => post.userId === userId)
}

/**
 * ローカルストレージから投稿を削除
 */
export function removePostFromLocalStorage(id: string): void {
  if (typeof window === 'undefined') {
    return
  }

  const posts = getPostsFromLocalStorage()
  const filtered = posts.filter((post) => post.id !== id)
  localStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(filtered))
}

/**
 * 投稿を同期済みとしてマーク
 */
export function markPostAsSynced(id: string): void {
  if (typeof window === 'undefined') {
    return
  }

  const posts = getPostsFromLocalStorage()
  const updated = posts.map((post) =>
    post.id === id ? { ...post, synced: true } : post
  )
  localStorage.setItem(STORAGE_KEY_POSTS, JSON.stringify(updated))
}

/**
 * 同期キューに追加
 */
function addToSyncQueue(id: string): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const queue = getSyncQueue()
    if (!queue.includes(id)) {
      queue.push(id)
      localStorage.setItem(STORAGE_KEY_SYNC_QUEUE, JSON.stringify(queue))
    }
  } catch (error) {
    console.error('Error adding to sync queue:', error)
  }
}

/**
 * 同期キューを取得
 */
export function getSyncQueue(): string[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY_SYNC_QUEUE)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Error reading sync queue:', error)
    return []
  }
}

/**
 * 同期キューから削除
 */
export function removeFromSyncQueue(id: string): void {
  if (typeof window === 'undefined') {
    return
  }

  const queue = getSyncQueue()
  const filtered = queue.filter((itemId) => itemId !== id)
  localStorage.setItem(STORAGE_KEY_SYNC_QUEUE, JSON.stringify(filtered))
}

/**
 * ローカルストレージをクリア（テスト用）
 */
export function clearLocalStorage(): void {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.removeItem(STORAGE_KEY_POSTS)
  localStorage.removeItem(STORAGE_KEY_SYNC_QUEUE)
}
