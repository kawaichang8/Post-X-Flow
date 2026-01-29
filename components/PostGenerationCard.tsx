"use client"

import { useState, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { NaturalnessScore } from "@/components/ui/progress"
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip"
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
import { cn } from "@/lib/utils"
import { 
  Info, 
  Edit3, 
  Image as ImageIcon, 
  Play, 
  Plus, 
  Send, 
  Clock, 
  Bookmark,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Flag,
} from "lucide-react"

interface GeneratedPost {
  id: string
  content: string
  mediaUrl?: string
  mediaType?: "image" | "video"
  naturalness_score: number
  fact_score?: number | null
  fact_suggestions?: string[]
  context_used?: boolean
}

interface PostGenerationCardProps {
  post: GeneratedPost
  index: number
  onContentChange: (id: string, content: string) => void
  onPost: (post: GeneratedPost) => void
  onSchedule: (post: GeneratedPost) => void
  onSaveDraft: (post: GeneratedPost) => void
  onAddMedia?: (id: string) => void
  maxCharacters?: number
  isPosting?: boolean
}

export function PostGenerationCard({
  post,
  index,
  onContentChange,
  onPost,
  onSchedule,
  onSaveDraft,
  onAddMedia,
  maxCharacters = 140,
  isPosting = false,
}: PostGenerationCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showOverLimitDialog, setShowOverLimitDialog] = useState(false)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const charCount = post.content.length
  const isOverLimit = charCount > maxCharacters
  const isNearLimit = charCount > maxCharacters * 0.9 && charCount <= maxCharacters

  const getCharCountColor = () => {
    if (isOverLimit) return "char-count-danger"
    if (isNearLimit) return "char-count-warning"
    return "char-count-normal"
  }

  const handleContentChange = (value: string) => {
    onContentChange(post.id, value)
  }

  const handlePostClick = () => {
    if (isOverLimit) {
      setShowOverLimitDialog(true)
    } else {
      onPost(post)
    }
  }

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(post.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [post.content])

  const handleEditToggle = () => {
    setIsEditing(!isEditing)
    if (!isEditing) {
      setTimeout(() => {
        textareaRef.current?.focus()
        textareaRef.current?.setSelectionRange(
          post.content.length,
          post.content.length
        )
      }, 100)
    }
  }

  // Calculate progress percentage for circular indicator
  const charProgress = Math.min((charCount / maxCharacters) * 100, 100)
  const scoreProgress = post.naturalness_score
  
  const getProgressColor = () => {
    if (isOverLimit) return "stroke-red-500"
    if (isNearLimit) return "stroke-yellow-500"
    return "stroke-green-500"
  }

  return (
    <TooltipProvider>
      <Card className="w-full min-w-[300px] max-w-[400px] glass-card border-0 rounded-2xl shadow-soft hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 overflow-hidden group">
        {/* Card Header - Premium */}
        <CardHeader className="pb-3 pt-5 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-green-500/20">
                {index + 1}
              </div>
              <div>
                <span className="text-sm font-semibold text-foreground">
                  投稿案 {index + 1}
                </span>
                <p className="text-xs text-muted-foreground">AI生成</p>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl hover:bg-accent/80"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="rounded-xl">コピー</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-xl",
                      isEditing && "bg-primary/10 text-primary"
                    )}
                    onClick={handleEditToggle}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="rounded-xl">
                  {isEditing ? "編集を終了" : "編集してパーソナライズ"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5 space-y-4">
          {/* Content Area - Premium */}
          <div className="relative">
            {isEditing ? (
              <Textarea
                ref={textareaRef}
                value={post.content}
                onChange={(e) => handleContentChange(e.target.value)}
                className={cn(
                  "min-h-[140px] resize-none rounded-2xl border-2 transition-all duration-300 bg-background/50",
                  isOverLimit 
                    ? "border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-500/20" 
                    : "border-primary/20 focus:border-primary focus:ring-primary/20"
                )}
                placeholder="投稿内容を入力..."
              />
            ) : (
              <div 
                className="min-h-[140px] p-4 bg-gradient-to-br from-muted/30 to-muted/50 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap cursor-pointer hover:from-muted/40 hover:to-muted/60 transition-all duration-300 border border-border/50"
                onClick={handleEditToggle}
              >
                {post.content.split("\n").map((line, i) => (
                  <div key={i} className="flex gap-2 py-0.5">
                    {line.match(/^[0-9０-９]+[.．]/) && (
                      <span className="w-2 h-2 mt-1.5 rounded-full bg-green-500 shrink-0" />
                    )}
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Edit hint - Floating */}
            {!isEditing && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="absolute top-3 right-3 p-1.5 rounded-xl bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-background transition-all duration-200 shadow-sm">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[200px] rounded-xl">
                  <p className="text-xs">
                    クリックして編集できます。あなたの言葉でパーソナライズすると自然さが向上します。
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Media Preview */}
          {post.mediaUrl && (
            <div className="media-preview-container">
              {post.mediaType === "video" ? (
                <div className="relative w-full h-full group">
                  <video
                    src={post.mediaUrl}
                    className="w-full h-full object-cover"
                    controls
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="w-14 h-14 rounded-full bg-black/70 flex items-center justify-center">
                      <Play className="h-6 w-6 text-white ml-1" />
                    </div>
                  </div>
                </div>
              ) : (
                <img
                  src={post.mediaUrl}
                  alt="プレビュー"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          )}

          {/* Stats Row - Circular Progress Indicators */}
          <div className="flex items-center justify-between py-2">
            {/* Character Count - Circular */}
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    className="stroke-muted"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    className={cn("transition-all duration-500", getProgressColor())}
                    strokeWidth="3"
                    strokeDasharray={`${charProgress * 0.94} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={cn(
                    "text-[10px] font-bold",
                    isOverLimit ? "text-red-500" : isNearLimit ? "text-yellow-500" : "text-green-500"
                  )}>
                    {charCount}
                  </span>
                </div>
              </div>
              <div className="text-xs">
                <p className="font-medium text-foreground">文字数</p>
                <p className={cn(
                  "text-muted-foreground",
                  isOverLimit && "text-red-500"
                )}>
                  / {maxCharacters}
                </p>
              </div>
            </div>

            {/* Naturalness Score - Circular */}
            <div className="flex items-center gap-3">
              <div className="text-xs text-right">
                <p className="font-medium text-foreground">自然さ</p>
                <p className={cn(
                  scoreProgress >= 80 ? "text-green-500" : 
                  scoreProgress >= 60 ? "text-yellow-500" : "text-red-500"
                )}>
                  {scoreProgress >= 80 ? "高品質" : scoreProgress >= 60 ? "良好" : "要改善"}
                </p>
              </div>
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    className="stroke-muted"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    className={cn(
                      "transition-all duration-500",
                      scoreProgress >= 80 ? "stroke-green-500" : 
                      scoreProgress >= 60 ? "stroke-yellow-500" : "stroke-red-500"
                    )}
                    strokeWidth="3"
                    strokeDasharray={`${scoreProgress * 0.94} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={cn(
                    "text-[10px] font-bold",
                    scoreProgress >= 80 ? "text-green-500" : 
                    scoreProgress >= 60 ? "text-yellow-500" : "text-red-500"
                  )}>
                    {scoreProgress}
                  </span>
                </div>
              </div>
            </div>

            {/* Fact-check score (when available) */}
            {post.fact_score != null && (
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
                        post.fact_score >= 70
                          ? "bg-green-500/10 text-green-700 dark:text-green-300 hover:bg-green-500/20"
                          : "bg-red-500/10 text-red-700 dark:text-red-300 hover:bg-red-500/20"
                      )}
                    >
                      {post.fact_score >= 70 ? (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      ) : (
                        <Flag className="h-3.5 w-3.5" />
                      )}
                      <span>事実 {post.fact_score}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px] rounded-xl p-3 text-sm" side="top">
                    <p className="font-medium mb-1">事実確認スコア: {post.fact_score}/100</p>
                    {post.fact_suggestions && post.fact_suggestions.length > 0 ? (
                      <ul className="list-disc list-inside text-muted-foreground space-y-0.5 text-xs">
                        {post.fact_suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">特記事項なし</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>

          {/* Action Buttons - Premium */}
          <div className="flex items-center gap-2 pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl h-10 border-2 border-border bg-card text-foreground shadow-sm hover:bg-accent hover:border-green-500/40 dark:bg-card/90"
                  onClick={() => onSaveDraft(post)}
                >
                  <Bookmark className="h-4 w-4 mr-1.5" />
                  下書き
                </Button>
              </TooltipTrigger>
              <TooltipContent className="rounded-xl">後で編集するために保存</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl h-10 border-2 border-border bg-card text-foreground shadow-sm hover:bg-accent hover:border-green-500/40 dark:bg-card/90"
                  onClick={() => onSchedule(post)}
                >
                  <Clock className="h-4 w-4 mr-1.5" />
                  予約
                </Button>
              </TooltipTrigger>
              <TooltipContent className="rounded-xl">投稿日時を設定</TooltipContent>
            </Tooltip>
            <Button
              size="sm"
              className="flex-1 rounded-xl h-10 bg-green-600 hover:bg-green-700 text-white font-medium shadow-md border-2 border-green-700/30 dark:bg-green-600 dark:hover:bg-green-500"
              onClick={handlePostClick}
              disabled={isPosting}
            >
              <Send className="h-4 w-4 mr-1.5" />
              投稿
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Over Limit Dialog */}
      <AlertDialog open={showOverLimitDialog} onOpenChange={setShowOverLimitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              文字数が制限を超えています
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                現在の文字数は{charCount}文字です（上限: {maxCharacters}文字）。
              </p>
              <p>
                このまま投稿するとエラーになる可能性があります。
                スレッド形式に変換しますか？
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>編集に戻る</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // TODO: Implement thread conversion
                setShowOverLimitDialog(false)
              }}
              className="bg-primary hover:bg-primary/90"
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              スレッドに変換
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}

// Grid/Carousel container for multiple cards
interface PostGenerationGridProps {
  posts: GeneratedPost[]
  onContentChange: (id: string, content: string) => void
  onPost: (post: GeneratedPost) => void
  onSchedule: (post: GeneratedPost) => void
  onSaveDraft: (post: GeneratedPost) => void
  onAddMedia?: (id: string) => void
  maxCharacters?: number
  isPosting?: boolean
}

export function PostGenerationGrid({
  posts,
  onContentChange,
  onPost,
  onSchedule,
  onSaveDraft,
  onAddMedia,
  maxCharacters,
  isPosting,
}: PostGenerationGridProps) {
  if (posts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">
            トレンドと目的を入力して、AIに投稿を生成させましょう
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Mobile: Horizontal scroll */}
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:hidden scrollbar-hide">
        {posts.map((post, index) => (
          <div key={post.id} className="snap-center shrink-0">
            <PostGenerationCard
              post={post}
              index={index}
              onContentChange={onContentChange}
              onPost={onPost}
              onSchedule={onSchedule}
              onSaveDraft={onSaveDraft}
              onAddMedia={onAddMedia}
              maxCharacters={maxCharacters}
              isPosting={isPosting}
            />
          </div>
        ))}
      </div>

      {/* Desktop: Grid */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post, index) => (
          <PostGenerationCard
            key={post.id}
            post={post}
            index={index}
            onContentChange={onContentChange}
            onPost={onPost}
            onSchedule={onSchedule}
            onSaveDraft={onSaveDraft}
            onAddMedia={onAddMedia}
            maxCharacters={maxCharacters}
            isPosting={isPosting}
          />
        ))}
      </div>
    </div>
  )
}
