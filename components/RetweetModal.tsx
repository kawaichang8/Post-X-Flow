"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Repeat2,
  Quote,
  Calendar,
  Send,
  Loader2,
  X,
  Heart,
  MessageCircle,
  Eye,
} from "lucide-react"
import type { InspirationPost } from "@/app/actions-inspiration"

export type RetweetMode = "simple" | "quote"

interface RetweetModalProps {
  post: InspirationPost | null
  isOpen: boolean
  onClose: () => void
  /** Immediate simple RT */
  onPostSimple: (tweetId: string) => Promise<{ success: boolean; error?: string }>
  /** Immediate quote RT */
  onPostQuote: (tweetId: string, comment: string) => Promise<{ success: boolean; error?: string }>
  /** Schedule RT (simple or quote) */
  onSchedule: (tweetId: string, type: RetweetMode, options: { comment?: string; scheduledFor: Date }) => Promise<{ success: boolean; postHistoryId?: string; error?: string }>
  /** Optional: optimal time suggestion (e.g. from AI) */
  suggestedSchedule?: Date | null
}

export function RetweetModal({
  post,
  isOpen,
  onClose,
  onPostSimple,
  onPostQuote,
  onSchedule,
  suggestedSchedule = null,
}: RetweetModalProps) {
  const [mode, setMode] = useState<RetweetMode>("simple")
  const [comment, setComment] = useState("")
  const [scheduleAt, setScheduleAt] = useState<"now" | "scheduled">("now")
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = suggestedSchedule || new Date(Date.now() + 60 * 60 * 1000)
    return d.toISOString().slice(0, 16)
  })
  const [loading, setLoading] = useState(false)

  if (!isOpen || !post) return null

  const tweetId = post.tweet_id
  if (!tweetId) return null

  const handleSubmit = async () => {
    setLoading(true)
    try {
      if (scheduleAt === "now") {
        if (mode === "simple") {
          const result = await onPostSimple(tweetId)
          if (result.success) {
            onClose()
          }
          return result
        } else {
          const result = await onPostQuote(tweetId, comment.trim() || "👍")
          if (result.success) {
            onClose()
          }
          return result
        }
      } else {
        const scheduledFor = new Date(scheduleDate)
        if (isNaN(scheduledFor.getTime()) || scheduledFor <= new Date()) {
          return { success: false, error: "予約日時を将来に設定してください。" }
        }
        const result = await onSchedule(tweetId, mode, {
          comment: mode === "quote" ? (comment.trim() || "👍") : undefined,
          scheduledFor,
        })
        if (result.success) {
          onClose()
        }
        return result
      }
    } finally {
      setLoading(false)
    }
  }

  const canSubmit =
    scheduleAt === "now" ||
    (scheduleAt === "scheduled" &&
      !isNaN(new Date(scheduleDate).getTime()) &&
      new Date(scheduleDate) > new Date())
  const quoteValid = mode === "simple" || comment.length <= 280

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <Card className="relative z-10 w-full max-w-lg rounded-2xl shadow-xl border-0 bg-card overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Repeat2 className="h-5 w-5 text-green-500" />
            自動リツイート
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Original tweet preview (Twitter-style) */}
          <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
            <p className="text-sm text-muted-foreground">引用元</p>
            <p className="text-sm whitespace-pre-wrap">{post.text}</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart className="h-3.5 w-3.5 text-red-400" />
                {post.like_count}
              </span>
              <span className="flex items-center gap-1">
                <Repeat2 className="h-3.5 w-3.5 text-green-400" />
                {post.retweet_count}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5 text-blue-400" />
                {post.reply_count}
              </span>
              {post.impression_count != null && (
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {post.impression_count.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Mode: Simple RT vs Quote RT */}
          <div className="space-y-2">
            <Label>リツイートの種類</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "simple" ? "default" : "outline"}
                size="sm"
                className={cn("rounded-xl flex-1", mode === "simple" && "bg-green-600 hover:bg-green-700")}
                onClick={() => setMode("simple")}
              >
                <Repeat2 className="h-4 w-4 mr-1.5" />
                リツイート
              </Button>
              <Button
                type="button"
                variant={mode === "quote" ? "default" : "outline"}
                size="sm"
                className={cn("rounded-xl flex-1", mode === "quote" && "bg-green-600 hover:bg-green-700")}
                onClick={() => setMode("quote")}
              >
                <Quote className="h-4 w-4 mr-1.5" />
                引用RT
              </Button>
            </div>
          </div>

          {mode === "quote" && (
            <div className="space-y-2">
              <Label>コメント（任意）</Label>
              <Textarea
                placeholder="引用RTに添えるコメント..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="rounded-xl resize-none"
                maxLength={280}
              />
              <p className={cn("text-xs", comment.length > 280 ? "text-red-500" : "text-muted-foreground")}>
                {comment.length}/280
              </p>
            </div>
          )}

          {/* When: Now vs Scheduled */}
          <div className="space-y-2">
            <Label>実行タイミング</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={scheduleAt === "now" ? "default" : "outline"}
                size="sm"
                className={cn("rounded-xl flex-1", scheduleAt === "now" && "bg-green-600 hover:bg-green-700")}
                onClick={() => setScheduleAt("now")}
              >
                今すぐ
              </Button>
              <Button
                type="button"
                variant={scheduleAt === "scheduled" ? "default" : "outline"}
                size="sm"
                className={cn("rounded-xl flex-1", scheduleAt === "scheduled" && "bg-green-600 hover:bg-green-700")}
                onClick={() => setScheduleAt("scheduled")}
              >
                <Calendar className="h-4 w-4 mr-1.5" />
                予約
              </Button>
            </div>
            {scheduleAt === "scheduled" && (
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              />
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={loading}>
              キャンセル
            </Button>
            <Button
              className={cn("flex-1 rounded-xl bg-green-600 hover:bg-green-700 transition-transform hover:scale-105")}
              onClick={handleSubmit}
              disabled={loading || !canSubmit || !quoteValid}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : scheduleAt === "now" ? (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  リツイートする
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  予約する
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
