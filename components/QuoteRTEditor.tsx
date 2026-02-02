"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  Quote,
  Sparkles,
  Loader2,
  Send,
  Calendar,
  Heart,
  Repeat2,
  MessageCircle,
  Eye,
  X,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Image as ImageIcon,
} from "lucide-react"
import type { InspirationPost, QuoteRTDraft, ReplyDraft } from "@/app/actions-inspiration"

type EngagementMode = "quote" | "reply"

interface QuoteRTEditorProps {
  isOpen: boolean
  onClose: () => void
  post: InspirationPost | null
  draft: QuoteRTDraft | ReplyDraft | null
  isGenerating: boolean
  onGenerate: (context?: string) => void
  onRegenerate: () => void
  onPost: (comment: string) => Promise<{ success: boolean; error?: string }>
  onSchedule: (comment: string, scheduledFor: Date) => Promise<{ success: boolean; error?: string }>
  mode?: EngagementMode // "quote" (default) or "reply"
}

export function QuoteRTEditor({
  isOpen,
  onClose,
  post,
  draft,
  isGenerating,
  onGenerate,
  onRegenerate,
  onPost,
  onSchedule,
  mode = "quote",
}: QuoteRTEditorProps) {
  const isReply = mode === "reply"
  
  // Mode-specific text
  const modeConfig = {
    quote: {
      title: "引用RTエディター",
      description: "AIが生成したコメントを編集してから投稿できます",
      icon: Quote,
      commentLabel: "あなたのコメント",
      placeholder: "コメントを入力...",
      previewLabel: "プレビュー",
      previewPrefix: "📌",
      generateButton: "AIでコメントを生成",
      confirmTitle: "引用RTを投稿しますか？",
      confirmScheduleTitle: "引用RTを予約しますか？",
      confirmText: "この投稿は即座にXに公開されます。",
      gradientFrom: "from-purple-400",
      gradientTo: "to-pink-500",
    },
    reply: {
      title: "リプライエディター",
      description: "AIが生成した返信を編集してから投稿できます",
      icon: MessageCircle,
      commentLabel: "あなたの返信",
      placeholder: "返信を入力...",
      previewLabel: "返信プレビュー",
      previewPrefix: "↩️",
      generateButton: "AIで返信を生成",
      confirmTitle: "リプライを投稿しますか？",
      confirmScheduleTitle: "リプライを予約しますか？",
      confirmText: "この返信は即座にXに公開されます。",
      gradientFrom: "from-blue-400",
      gradientTo: "to-cyan-500",
    },
  }
  
  const config = modeConfig[mode]
  const ModeIcon = config.icon
  const [comment, setComment] = useState("")
  const [userContext, setUserContext] = useState("")
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000)
    return d.toISOString().slice(0, 16)
  })
  const [isPosting, setIsPosting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmAction, setConfirmAction] = useState<"post" | "schedule">("post")

  // Update comment when draft changes
  useEffect(() => {
    if (draft) {
      // Handle both QuoteRTDraft (generatedComment) and ReplyDraft (generatedReply)
      const text = "generatedComment" in draft ? draft.generatedComment : "generatedReply" in draft ? draft.generatedReply : ""
      setComment(text)
    }
  }, [draft])

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setComment("")
      setUserContext("")
      setShowSchedule(false)
      setShowConfirm(false)
    }
  }, [isOpen])

  const handleGenerate = () => {
    onGenerate(userContext.trim() || undefined)
  }

  const handlePost = async () => {
    if (confirmAction === "post") {
      setIsPosting(true)
      try {
        const result = await onPost(comment.trim() || "👍")
        if (result.success) {
          onClose()
        }
      } finally {
        setIsPosting(false)
        setShowConfirm(false)
      }
    } else {
      const scheduledFor = new Date(scheduleDate)
      if (isNaN(scheduledFor.getTime()) || scheduledFor <= new Date()) {
        return
      }
      setIsPosting(true)
      try {
        const result = await onSchedule(comment.trim() || "👍", scheduledFor)
        if (result.success) {
          onClose()
        }
      } finally {
        setIsPosting(false)
        setShowConfirm(false)
      }
    }
  }

  const charCount = comment.length
  const isOverLimit = charCount > 280
  const isValidSchedule = !isNaN(new Date(scheduleDate).getTime()) && new Date(scheduleDate) > new Date()

  // Estimate naturalness score
  const estimatedScore = draft?.naturalnessScore ?? estimateNaturalness(comment)

  if (!isOpen || !post) return null

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={cn("w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center", config.gradientFrom, config.gradientTo)}>
                <ModeIcon className="h-4 w-4 text-white" />
              </div>
              {config.title}
            </DialogTitle>
            <DialogDescription>
              {config.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Original Tweet Preview - Twitter Card Style */}
            <div className="rounded-xl border bg-card/50 overflow-hidden">
              <div className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0">
                    <span className="text-white text-sm font-bold">
                      {post.author_name?.[0] || "X"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm truncate">
                        {post.author_name || "投稿者"}
                      </span>
                      {post.author_handle && (
                        <span className="text-muted-foreground text-sm">
                          @{post.author_handle}
                        </span>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap mt-1">{post.text}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs text-muted-foreground pt-2 border-t">
                  <span className="flex items-center gap-1.5">
                    <Heart className="h-4 w-4 text-red-400" />
                    {post.like_count.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Repeat2 className="h-4 w-4 text-green-400" />
                    {post.retweet_count.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageCircle className="h-4 w-4 text-blue-400" />
                    {post.reply_count.toLocaleString()}
                  </span>
                  {post.impression_count != null && (
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-4 w-4" />
                      {post.impression_count.toLocaleString()}
                    </span>
                  )}
                  {post.tweet_id && (
                    <a
                      href={`https://x.com/i/status/${post.tweet_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 text-blue-500 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      元ツイートを見る
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Generate Section (if no draft yet) */}
            {!draft && (
              <Card className="rounded-xl border-dashed border-purple-500/30">
                <CardContent className="p-4 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm">追加コンテキスト（任意）</Label>
                    <Input
                      placeholder="例：今日の気分、宣伝したいこと、視点など"
                      value={userContext}
                      onChange={(e) => setUserContext(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className={cn("w-full rounded-xl bg-gradient-to-r text-white", 
                      isReply 
                        ? "from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600" 
                        : "from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    )}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        AI生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        {config.generateButton}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Comment Editor (after draft is generated) */}
            {draft && (
              <div className="space-y-4">
                {/* Comment Textarea */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">{config.commentLabel}</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onRegenerate}
                          disabled={isGenerating}
                          className="h-7 rounded-lg text-xs"
                        >
                          {isGenerating ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="h-3 w-3 mr-1" />
                          )}
                          再生成
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>AIで別のコメントを生成</TooltipContent>
                    </Tooltip>
                  </div>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={isReply ? 3 : 4}
                    className="rounded-xl resize-none"
                    placeholder={config.placeholder}
                  />
                  <div className="flex items-center justify-between text-xs">
                    <Badge
                      variant={isOverLimit ? "destructive" : "secondary"}
                      className="rounded-lg"
                    >
                      {charCount}/280
                    </Badge>
                    {isOverLimit && (
                      <span className="text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        文字数オーバー
                      </span>
                    )}
                  </div>
                </div>

                {/* Naturalness Score */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">自然さスコア</span>
                    <span
                      className={cn(
                        "font-medium",
                        estimatedScore >= 80
                          ? "text-green-500"
                          : estimatedScore >= 60
                          ? "text-yellow-500"
                          : "text-red-500"
                      )}
                    >
                      {estimatedScore}/100
                    </span>
                  </div>
                  <Progress
                    value={estimatedScore}
                    className={cn(
                      "h-2",
                      estimatedScore >= 80
                        ? "[&>div]:bg-green-500"
                        : estimatedScore >= 60
                        ? "[&>div]:bg-yellow-500"
                        : "[&>div]:bg-red-500"
                    )}
                  />
                  {estimatedScore >= 80 && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      自然で読みやすいコメントです
                    </p>
                  )}
                </div>

                {/* Preview */}
                <div className="rounded-xl border bg-accent/30 p-4 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">{config.previewLabel}</p>
                  {isReply ? (
                    // Reply preview: show reply target first, then your reply
                    <>
                      <div className="p-3 rounded-lg border bg-card/50">
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {config.previewPrefix} {post.text}
                        </p>
                      </div>
                      <p className="text-sm whitespace-pre-wrap pl-4 border-l-2 border-blue-400">
                        {comment || "（返信なし）"}
                      </p>
                    </>
                  ) : (
                    // Quote RT preview: your comment first, then quoted tweet
                    <>
                      <p className="text-sm whitespace-pre-wrap">{comment || "（コメントなし）"}</p>
                      <div className="p-3 rounded-lg border bg-card/50 mt-2">
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {config.previewPrefix} {post.text}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Schedule Toggle */}
                <div className="flex items-center gap-2">
                  <Button
                    variant={!showSchedule ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "rounded-xl flex-1",
                      !showSchedule && (isReply 
                        ? "bg-gradient-to-r from-blue-500 to-cyan-500" 
                        : "bg-gradient-to-r from-purple-500 to-pink-500")
                    )}
                    onClick={() => setShowSchedule(false)}
                  >
                    <Send className="h-4 w-4 mr-1.5" />
                    今すぐ投稿
                  </Button>
                  <Button
                    variant={showSchedule ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "rounded-xl flex-1",
                      showSchedule && (isReply 
                        ? "bg-gradient-to-r from-blue-500 to-cyan-500" 
                        : "bg-gradient-to-r from-purple-500 to-pink-500")
                    )}
                    onClick={() => setShowSchedule(true)}
                  >
                    <Calendar className="h-4 w-4 mr-1.5" />
                    予約投稿
                  </Button>
                </div>

                {showSchedule && (
                  <div className="space-y-2">
                    <Label className="text-sm">予約日時</Label>
                    <Input
                      type="datetime-local"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      className="rounded-xl"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} className="rounded-xl">
              キャンセル
            </Button>
            {draft && (
              <Button
                onClick={() => {
                  setConfirmAction(showSchedule ? "schedule" : "post")
                  setShowConfirm(true)
                }}
                disabled={isOverLimit || (showSchedule && !isValidSchedule)}
                className={cn("rounded-xl bg-gradient-to-r text-white",
                  isReply 
                    ? "from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                    : "from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                )}
              >
                {showSchedule ? (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    予約する
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    投稿する
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "post" ? config.confirmTitle : config.confirmScheduleTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "post"
                ? config.confirmText
                : `この${isReply ? "返信" : "投稿"}は ${new Date(scheduleDate).toLocaleString("ja-JP")} に自動投稿されます。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePost}
              disabled={isPosting}
              className={cn("rounded-xl bg-gradient-to-r",
                isReply 
                  ? "from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                  : "from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              )}
            >
              {isPosting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : confirmAction === "post" ? (
                "投稿する"
              ) : (
                "予約する"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}

// Simple naturalness score estimator (same logic as server-side)
function estimateNaturalness(text: string): number {
  let score = 85

  if (text.length < 20) score -= 15
  if (text.length > 200) score -= 10

  const emojiCount = (text.match(/[\u{1F600}-\u{1F9FF}]/gu) || []).length
  if (emojiCount > 5) score -= (emojiCount - 5) * 2

  if (text.includes("!!!")) score -= 10
  if (/(.)\1{3,}/.test(text)) score -= 10

  return Math.max(0, Math.min(100, score))
}
