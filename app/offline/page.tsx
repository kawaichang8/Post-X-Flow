"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { WifiOff, RefreshCw, Home } from "lucide-react"
import { useRouter } from "next/navigation"

export default function OfflinePage() {
  const router = useRouter()

  const handleRetry = () => {
    if (navigator.onLine) {
      router.push("/dashboard")
    } else {
      window.location.reload()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border border-gray-200 dark:border-gray-800">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <WifiOff className="h-8 w-8 text-gray-600 dark:text-gray-400" />
          </div>
          <CardTitle className="text-2xl">オフラインです</CardTitle>
          <CardDescription>
            インターネット接続を確認してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>現在、インターネットに接続できません。</p>
            <p>以下の機能はオフラインでも利用できます：</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>下書きの作成・編集</li>
              <li>保存済み下書きの閲覧</li>
              <li>オフラインで保存した下書きの確認</li>
            </ul>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleRetry}
              className="flex-1"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              再接続を試す
            </Button>
            <Button
              onClick={() => router.push("/dashboard")}
              className="flex-1"
            >
              <Home className="h-4 w-4 mr-2" />
              ダッシュボードに戻る
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
