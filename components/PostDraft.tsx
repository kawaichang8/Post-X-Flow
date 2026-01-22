"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Copy, Check, Twitter, AlertCircle, Calendar } from "lucide-react"
import { PostDraft as PostDraftType } from "@/lib/ai-generator"
import { openTwitterCompose } from "@/lib/twitter-client"

interface PostDraftProps {
  draft: PostDraftType
  index: number
  onApprove?: (draft: PostDraftType, scheduleFor?: Date) => Promise<void>
  onSchedule?: (draft: PostDraftType, scheduleFor: Date) => Promise<void>
  isPosting?: boolean
  suggestedTime?: Date | null
}

export function PostDraft({ draft, index, onApprove, onSchedule, isPosting, suggestedTime }: PostDraftProps) {
  const [copied, setCopied] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleDateTime, setScheduleDateTime] = useState(
    suggestedTime ? new Date(suggestedTime).toISOString().slice(0, 16) : ""
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Error copying text:", error)
      // Fallback: show error state briefly
      setCopied(false)
    }
  }

  const handleApprove = async () => {
    // Show confirmation dialog for safety (Human-in-the-loop)
    const confirmed = window.confirm(
      "このツイートを投稿しますか？\n\n" +
      "内容:\n" + draft.text.substring(0, 100) + "...\n\n" +
      "OKをクリックすると投稿されます。"
    )

    if (!confirmed) return

    if (!onApprove) {
      // Fallback: Open Twitter compose window
      openTwitterCompose(draft.text)
      return
    }

    setIsApproving(true)
    try {
      await onApprove(draft)
    } finally {
      setIsApproving(false)
    }
  }

  const handleSchedule = async () => {
    if (!scheduleDateTime) {
      alert("スケジュール日時を入力してください")
      return
    }

    const scheduleDate = new Date(scheduleDateTime)
    if (isNaN(scheduleDate.getTime()) || scheduleDate < new Date()) {
      alert("有効な未来の日時を入力してください")
      return
    }

    if (!onSchedule) {
      alert("スケジュール機能は利用できません")
      return
    }

    setIsApproving(true)
    try {
      await onSchedule(draft, scheduleDate)
      setShowSchedule(false)
      setScheduleDateTime("")
    } finally {
      setIsApproving(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "高"
    if (score >= 60) return "中"
    return "低"
  }

  return (
    <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors duration-200">
      <CardHeader className="border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">ドラフト {index + 1}</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">自然さスコア:</span>
            <span className={`text-sm font-semibold ${getScoreColor(draft.naturalnessScore)}`}>
              {draft.naturalnessScore}/100 ({getScoreLabel(draft.naturalnessScore)})
            </span>
          </div>
        </div>
        {draft.naturalnessScore < 60 && (
          <CardDescription className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-4 w-4" />
            スパムリスクが高い可能性があります。内容を確認してください。
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <p className="text-base whitespace-pre-wrap leading-relaxed text-gray-900 dark:text-white">{draft.text}</p>
          
          {draft.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {draft.hashtags.map((tag, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {showSchedule && (
            <div className="space-y-2 pt-4 border-t">
              <label className="text-sm font-medium">スケジュール日時</label>
              <Input
                type="datetime-local"
                value={scheduleDateTime}
                onChange={(e) => setScheduleDateTime(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="flex-1"
          >
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                コピー済み
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                コピー
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSchedule(!showSchedule)}
            className="flex-1"
          >
            <Calendar className="mr-2 h-4 w-4" />
            スケジュール
          </Button>
        </div>
        {showSchedule && (
          <Button
            onClick={handleSchedule}
            disabled={isApproving || isPosting || !scheduleDateTime}
            className="w-full"
            variant="secondary"
          >
            {isApproving ? "スケジュール中..." : "スケジュール設定"}
          </Button>
        )}
        <Button
          onClick={handleApprove}
          disabled={isApproving || isPosting}
          className="w-full bg-black dark:bg-white text-white dark:text-black rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          size="lg"
        >
          {isApproving || isPosting ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              投稿中...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Twitter className="h-4 w-4" />
              承認して投稿
            </span>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
