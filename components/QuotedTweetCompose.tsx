"use client"

import * as React from "react"
import { X, Send, Twitter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { QuotedTweet } from "@/app/actions"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

interface QuotedTweetComposeProps {
  quotedTweet: QuotedTweet
  onClose: () => void
  onPost: (text: string, quoteTweetId: string | null) => Promise<void>
  isPosting?: boolean
}

export function QuotedTweetCompose({
  quotedTweet,
  onClose,
  onPost,
  isPosting = false,
}: QuotedTweetComposeProps) {
  const { showToast } = useToast()
  const [comment, setComment] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const maxLength = 280
  const remainingChars = maxLength - comment.length
  const canPost = comment.trim().length > 0 && !isSubmitting && !isPosting

  React.useEffect(() => {
    // Auto focus textarea
    textareaRef.current?.focus()
  }, [])

  const handlePost = async () => {
    if (!canPost) return

    setIsSubmitting(true)
    try {
      await onPost(comment.trim(), quotedTweet.tweet_id || null)
      setComment("")
      onClose()
      showToast("引用ツイートを投稿しました！", "success")
    } catch (error) {
      console.error("Error posting quoted tweet:", error)
      const errorMessage = error instanceof Error ? error.message : "投稿に失敗しました"
      showToast(errorMessage, "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter to post
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault()
      handlePost()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      {/* X-like Quote Tweet Compose Window */}
      <div className="w-full max-w-2xl bg-white dark:bg-black rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Header - X-like */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="rounded-full h-9 w-9 p-0 hover:bg-gray-100 dark:hover:bg-gray-900"
          >
            <X className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            引用ツイート
          </h2>
          <div className="w-9" /> {/* Spacer for centering */}
        </div>

        {/* Main Content - X-like Layout */}
        <div className="flex flex-col max-h-[80vh] overflow-y-auto">
          {/* Your Comment Section - Top */}
          <div className="px-4 pt-4 pb-2 border-b border-gray-200 dark:border-gray-800">
            <div className="flex gap-3">
              {/* User Avatar Placeholder */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">U</span>
              </div>
              
              {/* Comment Textarea */}
              <div className="flex-1 space-y-2">
                <textarea
                  ref={textareaRef}
                  value={comment}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value.length <= maxLength) {
                      setComment(value)
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="ツイートを追加..."
                  className={cn(
                    "w-full min-h-[100px] px-0 py-2 border-0",
                    "text-lg bg-transparent text-gray-900 dark:text-white",
                    "resize-none focus:outline-none",
                    "placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  )}
                  style={{ fontSize: '20px', lineHeight: '1.5' }}
                />
                <div className="flex items-center justify-between text-sm pt-2">
                  <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
                    {/* Character count */}
                    <span className={cn(
                      remainingChars < 20 && "text-orange-500",
                      remainingChars < 0 && "text-red-500"
                    )}>
                      {remainingChars}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quoted Tweet Preview - Twitter-like Card */}
          <div className="px-4 py-3">
            <div className="border border-gray-300 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors">
              {/* Quoted Tweet Content */}
              <div className="p-4 space-y-3">
                {/* Author Info */}
                <div className="flex items-center gap-3">
                  {quotedTweet.author_avatar_url ? (
                    <img
                      src={quotedTweet.author_avatar_url}
                      alt={quotedTweet.author_name || ""}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
                      <span className="text-gray-600 dark:text-gray-400 text-sm">?</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-gray-900 dark:text-white truncate">
                      {quotedTweet.author_name || "不明"}
                    </div>
                    {quotedTweet.author_handle && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        @{quotedTweet.author_handle}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tweet Text */}
                <p className="text-sm text-gray-900 dark:text-white leading-relaxed whitespace-pre-wrap break-words">
                  {quotedTweet.tweet_text}
                </p>

                {/* Media */}
                {quotedTweet.media_url && (
                  <div className="rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                    <img
                      src={quotedTweet.media_url}
                      alt="Media"
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}

                {/* Tweet URL */}
                {quotedTweet.tweet_url && (
                  <a
                    href={quotedTweet.tweet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 inline-flex"
                  >
                    <Twitter className="h-3 w-3" />
                    元のツイートを見る
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer - X-like Action Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-black">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className={cn(
              remainingChars < 20 && "text-orange-500",
              remainingChars < 0 && "text-red-500"
            )}>
              {remainingChars}文字
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="rounded-full"
              disabled={isSubmitting || isPosting}
            >
              キャンセル
            </Button>
            <Button
              onClick={handlePost}
              disabled={!canPost}
              className="rounded-full bg-blue-500 hover:bg-blue-600 text-white px-6 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting || isPosting ? (
                <span className="px-4">投稿中...</span>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  投稿
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
