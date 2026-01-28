// Service Worker for postXflow PWA
// オフライン対応とキャッシュ管理

const CACHE_NAME = 'postxflow-v1'
const OFFLINE_PAGE = '/offline'

// インストール時にキャッシュを作成
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell')
      return cache.addAll([
        '/',
        '/dashboard',
        '/offline',
        '/manifest.json',
      ])
    })
  )
  self.skipWaiting()
})

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  return self.clients.claim()
})

// フェッチイベント: ネットワーク優先、フォールバックでキャッシュ
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 同じオリジンのリクエストのみ処理
  if (url.origin !== location.origin) {
    return
  }

  // APIリクエストはキャッシュしない（常にネットワークから取得）
  if (url.pathname.startsWith('/api/')) {
    return
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // レスポンスをクローンしてキャッシュに保存
        const responseToCache = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache)
        })
        return response
      })
      .catch(() => {
        // ネットワークエラーの場合、キャッシュから取得
        return caches.match(request).then((response) => {
          if (response) {
            return response
          }
          // キャッシュにもない場合、オフラインページを表示
          if (request.mode === 'navigate') {
            return caches.match(OFFLINE_PAGE)
          }
        })
      })
  )
})

// バックグラウンド同期（オフライン時の下書き保存）
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-drafts') {
    console.log('[Service Worker] Background sync: syncing drafts')
    event.waitUntil(syncDrafts())
  }
})

// 下書きを同期する関数
async function syncDrafts() {
  try {
    // IndexedDBから下書きを取得
    const drafts = await getDraftsFromIndexedDB()
    
    // ネットワークが利用可能な場合、サーバーに送信
    if (navigator.onLine && drafts.length > 0) {
      // クライアントにメッセージを送信して同期を開始
      const clients = await self.clients.matchAll()
      clients.forEach((client) => {
        client.postMessage({
          type: 'SYNC_DRAFTS',
          drafts: drafts,
        })
      })
    }
  } catch (error) {
    console.error('[Service Worker] Error syncing drafts:', error)
  }
}

// IndexedDBから下書きを取得（簡易版）
async function getDraftsFromIndexedDB() {
  // 実際の実装では、IndexedDBから取得
  // ここでは簡易的な実装
  return []
}

// メッセージ受信（クライアントからのメッセージ）
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CACHE_DRAFT') {
    // 下書きをキャッシュに保存
    cacheDraft(event.data.draft)
  }
})

// 下書きをキャッシュに保存
async function cacheDraft(draft) {
  try {
    // IndexedDBまたはCache APIに保存
    const cache = await caches.open(CACHE_NAME)
    const draftKey = `/drafts/${draft.id || Date.now()}`
    await cache.put(
      new Request(draftKey),
      new Response(JSON.stringify(draft), {
        headers: { 'Content-Type': 'application/json' },
      })
    )
  } catch (error) {
    console.error('[Service Worker] Error caching draft:', error)
  }
}
