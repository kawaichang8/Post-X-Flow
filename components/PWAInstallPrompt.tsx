"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, Download, Smartphone } from "lucide-react"
import { showInstallPrompt, isInstallable, setupInstallPrompt, isInstalled } from "@/lib/pwa-installer"
import { useToast } from "@/components/ui/toast"

export function PWAInstallPrompt() {
  const { showToast } = useToast()
  const [showPrompt, setShowPrompt] = useState(false)
  const [installable, setInstallable] = useState(false)

  useEffect(() => {
    // すでにインストールされている場合は表示しない
    if (isInstalled()) {
      return
    }

    // インストールプロンプトの設定
    const cleanup = setupInstallPrompt((installable) => {
      setInstallable(installable)
      if (installable) {
        // ローカルストレージで表示済みかチェック
        const hasSeenPrompt = localStorage.getItem('pwa-install-prompt-seen')
        if (!hasSeenPrompt) {
          setShowPrompt(true)
        }
      }
    })

    return cleanup
  }, [])

  const handleInstall = async () => {
    try {
      const accepted = await showInstallPrompt()
      if (accepted) {
        showToast("アプリをインストールしています...", "success")
        setShowPrompt(false)
        localStorage.setItem('pwa-install-prompt-seen', 'true')
      }
    } catch (error) {
      console.error("Error installing PWA:", error)
      showToast("インストールに失敗しました", "error")
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-prompt-seen', 'true')
  }

  if (!showPrompt || !installable) {
    return null
  }

  return (
    <Card className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 border-2 border-blue-500 shadow-lg animate-slide-up">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base">アプリをインストール</CardTitle>
              <CardDescription className="text-xs">
                ホーム画面に追加して、オフラインでも利用できます
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-2">
          <Button
            onClick={handleInstall}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            インストール
          </Button>
          <Button
            onClick={handleDismiss}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            後で
          </Button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          💡 インストールすると、オフラインでも下書きを作成・保存できます
        </p>
      </CardContent>
    </Card>
  )
}
