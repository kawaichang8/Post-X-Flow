"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Quote,
  Heart,
  Repeat2,
  MessageCircle,
  Eye,
  RefreshCw,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react"
import type { InspirationPost } from "@/app/actions-inspiration"

interface InspirationListProps {
  posts: InspirationPost[]
  loading?: boolean
  isPro: boolean
  onRefresh: () => void
  onAutoRetweet: (post: InspirationPost) => void
  onGenerateQuote?: (post: InspirationPost) => void
  generatingForId?: string | null
  className?: string
}

export function InspirationList({
  posts,
  loading = false,
  isPro,
  onRefresh,
  onAutoRetweet,
  onGenerateQuote,
  generatingForId = null,
  className,
}: InspirationListProps) {
  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <Card className={cn("rounded-2xl border-dashed", className)}>
        <CardContent className="py-12 text-center">
          <Quote className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            まだ投稿がありません。ダッシュボードから投稿を作成してください。
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          人気の投稿
          <Badge variant="secondary" className="ml-2">
            {posts.length}件
          </Badge>
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="rounded-xl"
        >
          <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
          更新
        </Button>
      </div>

      <div className="space-y-4">
        {posts.map((post) => (
          <Card
            key={post.id}
            className="rounded-2xl border-0 shadow-md bg-card/80 backdrop-blur-sm transition-all hover:shadow-lg"
          >
            <CardContent className="p-4">
              <p className="text-sm whitespace-pre-wrap mb-4">{post.text}</p>

              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
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

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => onAutoRetweet(post)}
                  disabled={!isPro}
                  className={cn(
                    "flex-1 rounded-xl transition-transform hover:scale-[1.02]",
                    isPro
                      ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                      : "opacity-70"
                  )}
                >
                  {!isPro ? (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Pro限定
                    </>
                  ) : (
                    <>
                      <Repeat2 className="h-4 w-4 mr-2" />
                      自動リツイート
                    </>
                  )}
                </Button>
                {onGenerateQuote && (
                  <Button
                    onClick={() => onGenerateQuote(post)}
                    disabled={generatingForId === post.id || !isPro}
                    variant="outline"
                    className="flex-1 rounded-xl border-purple-500/50 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
                  >
                    {generatingForId === post.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : !isPro ? (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Pro限定
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        引用RTを生成
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
