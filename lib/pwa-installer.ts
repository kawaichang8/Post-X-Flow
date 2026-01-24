"use client"

/**
 * PWAインストール機能
 * ブラウザのPWAインストールプロンプトを管理
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null

/**
 * PWAインストールプロンプトを表示
 */
export function showInstallPrompt(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!deferredPrompt) {
      resolve(false)
      return
    }

    deferredPrompt.prompt()
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt')
        resolve(true)
      } else {
        console.log('User dismissed the install prompt')
        resolve(false)
      }
      deferredPrompt = null
    })
  })
}

/**
 * PWAインストール可能かどうかをチェック
 */
export function isInstallable(): boolean {
  return deferredPrompt !== null
}

/**
 * PWAインストールイベントリスナーを設定
 */
export function setupInstallPrompt(
  onInstallable: (installable: boolean) => void
): () => void {
  const handler = (e: Event) => {
    // デフォルトのプロンプトを防ぐ
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    onInstallable(true)
  }

  window.addEventListener('beforeinstallprompt', handler)

  // クリーンアップ関数を返す
  return () => {
    window.removeEventListener('beforeinstallprompt', handler)
  }
}

/**
 * すでにインストールされているかチェック
 */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false
  
  // スタンドアロンモードで実行されているかチェック
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true
  }

  // iOS Safariの場合
  if ((window.navigator as any).standalone === true) {
    return true
  }

  return false
}

/**
 * オフライン状態をチェック
 */
export function isOnline(): boolean {
  if (typeof window === 'undefined') return true
  return navigator.onLine
}

/**
 * オンライン/オフライン状態の変更を監視
 */
export function setupOnlineStatusListener(
  onStatusChange: (isOnline: boolean) => void
): () => void {
  const handleOnline = () => onStatusChange(true)
  const handleOffline = () => onStatusChange(false)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // 初期状態を通知
  onStatusChange(navigator.onLine)

  // クリーンアップ関数を返す
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
