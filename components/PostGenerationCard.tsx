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
  Sparkles
} from "lucide-react"

interface GeneratedPost {
  id: string
  content: string
  mediaUrl?: string
  mediaType?: "image" | "video"
  naturalness_score: number
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

  return (
    <TooltipProvider>
      <Card className="w-full min-w-[320px] max-w-[400px] bg-card border border-border rounded-2xl shadow-soft hover:shadow-soft-lg transition-all duration-300 card-hover overflow-hidden">
        {/* Card Header */}
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                {index + 1}
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                投稿案 {index + 1}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>コピー</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-lg",
                      isEditing && "bg-primary/10 text-primary"
                    )}
                    onClick={handleEditToggle}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isEditing ? "編集を終了" : "編集する（パーソナライズにおすすめ）"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-4 space-y-4">
          {/* Content Area */}
          <div className="relative">
            {isEditing ? (
              <Textarea
                ref={textareaRef}
                value={post.content}
                onChange={(e) => handleContentChange(e.target.value)}
                className={cn(
                  "min-h-[120px] resize-none rounded-xl border-2 transition-colors",
                  isOverLimit 
                    ? "border-red-300 dark:border-red-800 focus:border-red-500" 
                    : "border-primary/30 focus:border-primary"
                )}
                placeholder="投稿内容を入力..."
              />
            ) : (
              <div 
                className="min-h-[120px] p-3 bg-muted/50 rounded-xl text-sm leading-relaxed whitespace-pre-wrap cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={handleEditToggle}
              >
                {post.content.split("\n").map((line, i) => (
                  <div key={i} className="flex gap-2">
                    {line.match(/^[0-9０-９]+[.．]/) && (
                      <span className="text-green-500 font-medium">•</span>
                    )}
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Edit hint tooltip */}
            {!isEditing && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="absolute top-2 right-2 p-1 rounded-lg bg-accent/80 hover:bg-accent transition-colors">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[200px]">
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

          {/* Character Count & Naturalness Score */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge 
                variant="secondary" 
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium",
                  getCharCountColor()
                )}
              >
                {charCount}/{maxCharacters}
                {isOverLimit && (
                  <AlertTriangle className="h-3 w-3 ml-1 inline" />
                )}
              </Badge>
              {onAddMedia && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg text-muted-foreground"
                      onClick={() => onAddMedia(post.id)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      <ImageIcon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>画像/動画を追加</TooltipContent>
                </Tooltip>
              )}
            </div>

            <NaturalnessScore score={post.naturalness_score} size="md" />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-xl h-9"
              onClick={() => onSaveDraft(post)}
            >
              <Bookmark className="h-3.5 w-3.5 mr-1.5" />
              下書き
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 rounded-xl h-9"
              onClick={() => onSchedule(post)}
            >
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              予約
            </Button>
            <Button
              size="sm"
              className="flex-1 rounded-xl h-9 bg-primary hover:bg-primary/90"
              onClick={handlePostClick}
              disabled={isPosting}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
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
