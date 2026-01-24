"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, Trash2, RefreshCw, WifiOff } from "lucide-react"
import { getOfflineDrafts, deleteOfflineDraft, OfflineDraft, syncOfflineDraftsToServer } from "@/lib/offline-draft-manager"
import { savePostToHistory } from "@/app/actions"
import { useToast } from "@/components/ui/toast"

interface OfflineDraftsPanelProps {
  userId: string
  onDraftSelect?: (draft: OfflineDraft) => void
}

export function OfflineDraftsPanel({ userId, onDraftSelect }: OfflineDraftsPanelProps) {
  const { showToast } = useToast()
  const [drafts, setDrafts] = useState<OfflineDraft[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    loadDrafts()
  }, [])

  const loadDrafts = async () => {
    setIsLoading(true)
    try {
      const offlineDrafts = await getOfflineDrafts()
      setDrafts(offlineDrafts)
    } catch (error) {
      console.error("Error loading offline drafts:", error)
      showToast("オフライン下書きの読み込みに失敗しました", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSync = async () => {
    if (!navigator.onLine) {
      showToast("インターネット接続が必要です", "warning")
      return
    }

    setIsSyncing(true)
    try {
      const result = await syncOfflineDraftsToServer(userId, async (draft) => {
        await savePostToHistory(userId, {
          text: draft.text,
          hashtags: draft.hashtags,
          naturalnessScore: draft.naturalnessScore,
          formatType: draft.formatType,
        }, draft.trend || '', draft.purpose || '', 'draft')
      })

      if (result.synced > 0) {
        showToast(`${result.synced}件の下書きを同期しました`, "success")
        await loadDrafts()
      } else {
        showToast("同期する下書きがありません", "info")
      }
    } catch (error) {
      console.error("Error syncing drafts:", error)
      showToast("同期に失敗しました", "error")
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("この下書きを削除しますか？")) {
      return
    }

    try {
      await deleteOfflineDraft(id)
      showToast("下書きを削除しました", "success")
      await loadDrafts()
    } catch (error) {
      console.error("Error deleting draft:", error)
      showToast("削除に失敗しました", "error")
    }
  }

  const handleSelect = (draft: OfflineDraft) => {
    if (onDraftSelect) {
      onDraftSelect(draft)
    }
  }

  if (isLoading) {
    return (
      <Card className="border border-gray-200 dark:border-gray-800">
        <CardContent className="py-6 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">読み込み中...</p>
        </CardContent>
      </Card>
    )
  }

  if (drafts.length === 0) {
    return (
      <Card className="border border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-gray-500" />
            オフライン下書き
          </CardTitle>
          <CardDescription>
            オフライン時に保存された下書きがここに表示されます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            オフライン下書きはありません
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-gray-200 dark:border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <WifiOff className="h-5 w-5 text-gray-500" />
              オフライン下書き ({drafts.length}件)
            </CardTitle>
            <CardDescription>
              オフライン時に保存された下書き
            </CardDescription>
          </div>
          {navigator.onLine && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              同期
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {drafts.map((draft) => (
          <div
            key={draft.id}
            className="p-3 border border-gray-200 dark:border-gray-800 rounded-lg space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
                  {draft.text}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {draft.synced ? (
                    <Badge variant="secondary" className="text-xs">
                      同期済み
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                      未同期
                    </Badge>
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(draft.createdAt).toLocaleString('ja-JP')}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSelect(draft)}
                className="flex-1"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                使用
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(draft.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
