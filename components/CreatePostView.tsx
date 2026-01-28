"use client"

import { useState, useCallback } from "react"
import { ModernGenerateForm } from "@/components/ModernGenerateForm"
import { PostGenerationGrid } from "@/components/PostGenerationCard"
import { OptimalTimeSuggestions } from "@/components/OptimalTimeSuggestions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  Clock,
  TrendingUp,
  Sparkles,
  Info,
  RefreshCw,
} from "lucide-react"

interface GeneratedPost {
  id: string
  content: string
  mediaUrl?: string
  mediaType?: "image" | "video"
  naturalness_score: number
}

interface CreatePostViewProps {
  onGenerate: (trend: string, purpose: string, aiProvider: string) => Promise<void>
  onPost: (post: GeneratedPost) => void
  onSchedule: (post: GeneratedPost) => void
  onSaveDraft: (post: GeneratedPost) => void
  onAddMedia?: (id: string) => void
  generatedPosts: GeneratedPost[]
  onContentChange: (id: string, content: string) => void
  isGenerating?: boolean
  isPosting?: boolean
  optimalTimes?: Array<{
    time: Date
    score: number
    reason: string
  }>
  onSelectOptimalTime?: (time: Date) => void
  highEngagementPosts?: Array<{
    id: string
    content: string
    engagement_score: number | null
    like_count: number
    retweet_count: number
  }>
  memoFlowEnabled?: boolean
  onMemoFlowToggle?: (enabled: boolean) => void
  promotionUrl?: string
}

export function CreatePostView({
  onGenerate,
  onPost,
  onSchedule,
  onSaveDraft,
  onAddMedia,
  generatedPosts,
  onContentChange,
  isGenerating = false,
  isPosting = false,
  optimalTimes = [],
  onSelectOptimalTime,
  highEngagementPosts = [],
  memoFlowEnabled = false,
  onMemoFlowToggle,
  promotionUrl,
}: CreatePostViewProps) {
  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">投稿を作成</h1>
            <p className="text-sm text-muted-foreground mt-1">
              AIを活用して魅力的な投稿を生成しましょう
            </p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Generate Form */}
          <div className="xl:col-span-2 space-y-6">
            {/* Generation Form */}
            <ModernGenerateForm
              onGenerate={onGenerate}
              isLoading={isGenerating}
              memoFlowEnabled={memoFlowEnabled}
              onMemoFlowToggle={onMemoFlowToggle}
              promotionUrl={promotionUrl}
            />

            {/* Generated Posts */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  生成された投稿
                </h2>
                {generatedPosts.length > 0 && (
                  <Badge variant="secondary" className="rounded-lg">
                    {generatedPosts.length}件
                  </Badge>
                )}
              </div>
              <PostGenerationGrid
                posts={generatedPosts}
                onContentChange={onContentChange}
                onPost={onPost}
                onSchedule={onSchedule}
                onSaveDraft={onSaveDraft}
                onAddMedia={onAddMedia}
                maxCharacters={140}
                isPosting={isPosting}
              />
            </div>
          </div>

          {/* Right Column - Tips & Optimal Times */}
          <div className="space-y-6">
            {/* Optimal Posting Times */}
            {optimalTimes.length > 0 && (
              <Card className="rounded-2xl border border-border shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4 text-primary" />
                    最適な投稿時間
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-0.5 rounded hover:bg-accent transition-colors">
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[220px]">
                        <p className="text-xs">
                          過去の投稿データから分析した、エンゲージメントが高くなる時間帯です。
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {optimalTimes.slice(0, 5).map((time, index) => (
                    <button
                      key={index}
                      onClick={() => onSelectOptimalTime?.(time.time)}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-xl transition-all",
                        "bg-muted/50 hover:bg-accent hover:scale-[1.02]"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-medium text-sm">
                          {index + 1}
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-sm">
                            {time.time.toLocaleTimeString("ja-JP", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                            {time.reason}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "rounded-lg text-xs",
                          time.score >= 80
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : time.score >= 60
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : ""
                        )}
                      >
                        {time.score}点
                      </Badge>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* High Engagement Posts for Reference */}
            {highEngagementPosts.length > 0 && (
              <Card className="rounded-2xl border border-border shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    高パフォーマンス投稿
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-0.5 rounded hover:bg-accent transition-colors">
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[220px]">
                        <p className="text-xs">
                          過去に高いエンゲージメントを獲得した投稿です。参考にしてみてください。
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {highEngagementPosts.slice(0, 3).map((post) => (
                    <div
                      key={post.id}
                      className="p-3 bg-muted/50 rounded-xl space-y-2"
                    >
                      <p className="text-sm line-clamp-2">{post.content}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          ❤️ {post.like_count}
                        </span>
                        <span className="flex items-center gap-1">
                          🔄 {post.retweet_count}
                        </span>
                        {post.engagement_score && (
                          <Badge variant="secondary" className="rounded-lg text-xs ml-auto">
                            スコア: {post.engagement_score}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Tips Card */}
            <Card className="rounded-2xl border border-border shadow-soft bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-primary" />
                  投稿のコツ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <TipItem
                  title="トレンドを活用"
                  description="#ハッシュタグを使って話題に乗りましょう"
                />
                <TipItem
                  title="短く簡潔に"
                  description="140文字以内で核心を伝えましょう"
                />
                <TipItem
                  title="画像を追加"
                  description="ビジュアルでエンゲージメント2倍に"
                />
                <TipItem
                  title="時間を選ぶ"
                  description="最適な時間に投稿してリーチを最大化"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

function TipItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <div className="w-2 h-2 rounded-full bg-primary" />
      </div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
