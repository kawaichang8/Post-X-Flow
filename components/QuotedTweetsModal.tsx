"use client"

import * as React from "react"
import { X, Plus, Trash2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { QuotedTweet } from "@/app/actions"
import { useToast } from "@/components/ui/toast"

interface QuotedTweetsModalProps {
  quotedTweets: QuotedTweet[]
  isLoading: boolean
  onUse: (quotedTweet: QuotedTweet) => void
  onClose: () => void
  onAdd: (title: string, tweetText: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function QuotedTweetsModal({
  quotedTweets,
  isLoading,
  onUse,
  onClose,
  onAdd,
  onDelete,
}: QuotedTweetsModalProps) {
  const { showToast } = useToast()
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [newTitle, setNewTitle] = React.useState("")
  const [newTweetText, setNewTweetText] = React.useState("")
  const [isAdding, setIsAdding] = React.useState(false)

  const handleAdd = async () => {
    if (!newTitle.trim() || !newTweetText.trim()) {
      showToast("タイトルとツイート内容を入力してください", "warning")
      return
    }

    setIsAdding(true)
    try {
      await onAdd(newTitle, newTweetText)
      setNewTitle("")
      setNewTweetText("")
      setShowAddForm(false)
      showToast("引用ツイートを登録しました", "success")
    } catch (error) {
      showToast("引用ツイートの登録に失敗しました", "error")
    } finally {
      setIsAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("この引用ツイートを削除しますか？")) return

    try {
      await onDelete(id)
      showToast("引用ツイートを削除しました", "success")
    } catch (error) {
      showToast("引用ツイートの削除に失敗しました", "error")
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl">
        <CardHeader className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">引用ツイート</CardTitle>
              <CardDescription>
                よく使う引用元ツイートを登録・管理
                <br />
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
                  💡 引用リツイート：他の人のツイートを引用しながら、自分のコメントを添えて投稿する機能です
                </span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(!showAddForm)}
                className="rounded-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                登録
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto pt-6">
          {/* Add Form */}
          {showAddForm && (
            <Card className="mb-6 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                      <strong>📝 使い方：</strong><br />
                      1. タイトルとツイート内容を入力して登録<br />
                      2. 登録した引用ツイートを選択<br />
                      3. コメントを入力して投稿<br />
                      <br />
                      <strong>例：</strong> よく引用する自分の過去のツイートや、参考にしたい他人のツイートを登録しておくと便利です。
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      タイトル（管理用）
                    </label>
                    <Input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="例: X運用実績 / 参考ツイート / よく使う引用元"
                      className="bg-white dark:bg-black"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      この引用ツイートを識別するためのタイトル
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      ツイート内容（引用する元ツイートのテキスト）
                    </label>
                    <textarea
                      value={newTweetText}
                      onChange={(e) => setNewTweetText(e.target.value)}
                      placeholder="引用したいツイートの内容をコピー＆ペーストしてください..."
                      className="w-full min-h-[120px] px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-md text-sm bg-white dark:bg-black text-gray-900 dark:text-white resize-none"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      この内容が引用として表示されます
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAdd}
                      disabled={isAdding}
                      className="rounded-full"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      登録
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddForm(false)
                        setNewTitle("")
                        setNewTweetText("")
                      }}
                      className="rounded-full"
                    >
                      キャンセル
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quoted Tweets List */}
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="border rounded-xl p-4 space-y-3">
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : quotedTweets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                登録された引用ツイートがありません
              </p>
              <Button
                variant="outline"
                onClick={() => setShowAddForm(true)}
                className="rounded-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                最初の引用ツイートを登録
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quotedTweets.map((quotedTweet) => (
                <Card
                  key={quotedTweet.id}
                  className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-xl hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors"
                >
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1">
                          {quotedTweet.title}
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(quotedTweet.id)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {quotedTweet.author_name && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          {quotedTweet.author_avatar_url && (
                            <img
                              src={quotedTweet.author_avatar_url}
                              alt={quotedTweet.author_name}
                              className="w-4 h-4 rounded-full"
                            />
                          )}
                          <span className="font-medium">{quotedTweet.author_name}</span>
                          {quotedTweet.author_handle && (
                            <span>@{quotedTweet.author_handle}</span>
                          )}
                        </div>
                      )}

                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-4 leading-relaxed">
                        {quotedTweet.tweet_text}
                      </p>

                      {quotedTweet.media_url && (
                        <div className="rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
                          <img
                            src={quotedTweet.media_url}
                            alt="Media"
                            className="w-full h-32 object-cover"
                          />
                        </div>
                      )}

                      <Button
                        onClick={() => onUse(quotedTweet)}
                        className="w-full rounded-full"
                        size="sm"
                      >
                        この引用ツイートを使用
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
