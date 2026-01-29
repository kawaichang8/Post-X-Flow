"use client"

import { useState, useEffect, useCallback } from "react"
import { getImprovementSuggestions, ImprovementSuggestion } from "@/app/actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { Zap, TrendingUp, RefreshCw, Copy, Sparkles } from "lucide-react"

interface ImprovementSuggestionsCardProps {
  userId: string
  onUseImprovement: (improvedText: string) => void
  limit?: number
}

export function ImprovementSuggestionsCard({
  userId,
  onUseImprovement,
  limit = 5,
}: ImprovementSuggestionsCardProps) {
  const { showToast } = useToast()
  const [suggestions, setSuggestions] = useState<ImprovementSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await getImprovementSuggestions(userId, limit)
      setSuggestions(data)
    } catch (e) {
      console.error("Failed to load improvement suggestions:", e)
      showToast("改善提案の取得に失敗しました", "error")
    } finally {
      setLoading(false)
    }
  }, [userId, limit, showToast])

  useEffect(() => {
    if (userId && !loaded) {
      setLoaded(true)
      load()
    }
  }, [userId, loaded, load])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast("改善案をコピーしました", "success")
  }

  return (
    <Card className="rounded-2xl border-0 shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 flex items-center justify-center border border-indigo-500/30">
              <Zap className="h-5 w-5 text-indigo-500" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                自動改善提案
              </CardTitle>
              <CardDescription>
                AIが低パフォーマンス投稿を分析して改善案を提案
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="rounded-xl"
          >
            <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
            更新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center gap-3 py-8 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-sm">改善提案を生成中...</span>
          </div>
        )}

        {!loading && suggestions.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            分析対象の投稿が少ないか、低パフォーマンス投稿がありません。投稿を増やしてから再度お試しください。
          </p>
        )}

        {!loading && suggestions.length > 0 && (
          <div className="space-y-4">
            {suggestions.map((s) => (
              <SuggestionItem
                key={s.postId}
                suggestion={s}
                onUse={() => onUseImprovement(s.improvedText)}
                onCopy={() => handleCopy(s.improvedText)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SuggestionItem({
  suggestion,
  onUse,
  onCopy,
}: {
  suggestion: ImprovementSuggestion
  onUse: () => void
  onCopy: () => void
}) {
  return (
    <div className="p-4 rounded-2xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors space-y-4">
      <div className="rounded-xl border bg-background/80 p-3">
        <p className="text-xs font-medium text-muted-foreground mb-1.5">元の投稿</p>
        <p className="text-sm text-foreground line-clamp-2">{suggestion.originalText}</p>
      </div>
      <div className="flex justify-center">
        <div className="p-2 rounded-full bg-green-500/10 border border-green-500/20">
          <TrendingUp className="h-4 w-4 text-green-500" />
        </div>
      </div>
      <div className="rounded-xl border-2 border-green-500/20 bg-green-500/5 p-4">
        <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">改善案</p>
        <p className="text-sm text-foreground font-medium">{suggestion.improvedText}</p>
      </div>
      {suggestion.changes.length > 0 && (
        <div className="rounded-xl border bg-blue-500/5 p-3">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">変更点</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            {suggestion.changes.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-green-500">✓</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium">
          <TrendingUp className="h-3 w-3" />
          +{suggestion.expectedImprovement.engagement}% エンゲージメント
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
          <Zap className="h-3 w-3" />
          +{suggestion.expectedImprovement.impressions}% インプレッション
        </span>
      </div>
      <p className="text-xs text-muted-foreground italic">💡 {suggestion.reason}</p>
      <div className="flex gap-2 pt-2 border-t border-border">
        <Button
          size="sm"
          onClick={onUse}
          className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white"
        >
          <Sparkles className="h-4 w-4 mr-1.5" />
          改善版で作成
        </Button>
        <Button variant="outline" size="sm" onClick={onCopy} className="rounded-xl shrink-0">
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
