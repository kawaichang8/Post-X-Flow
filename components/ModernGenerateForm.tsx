"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  Sparkles,
  TrendingUp,
  Target,
  Loader2,
  Info,
  Zap,
  Settings2,
  RefreshCw,
  FlaskConical,
  BookOpen,
  ShieldCheck,
} from "lucide-react"
import { getTrendsForUser } from "@/app/actions"

export type TrendItem = { name: string; query?: string; tweetVolume?: number | null }

interface ModernGenerateFormProps {
  onGenerate: (trend: string, purpose: string, aiProvider: string, abMode?: boolean, contextMode?: boolean, factCheck?: boolean) => Promise<void>
  isLoading?: boolean
  /** When set with X connected, shows "トレンドを取得" and trend list */
  userId?: string | null
  selectedAccountId?: string | null
  onTrendsError?: (message: string) => void
  /** Pro: show AB Mode toggle for 2–3 variations comparison */
  isPro?: boolean
}

const purposes = [
  { value: "engagement", label: "エンゲージメント重視", description: "いいね・RTを増やす" },
  { value: "information", label: "情報発信", description: "価値ある情報を届ける" },
  { value: "promotion", label: "プロモーション", description: "商品・サービスの宣伝" },
  { value: "community", label: "コミュニティ向け", description: "ファンとの交流" },
  { value: "viral", label: "バズ狙い", description: "拡散を意識した投稿" },
]

const aiProviders = [
  { value: "grok", label: "Grok", description: "X公式AI" },
  { value: "claude", label: "Claude", description: "Anthropic AI" },
]

export function ModernGenerateForm({
  onGenerate,
  isLoading = false,
  userId,
  selectedAccountId,
  onTrendsError,
  isPro = false,
}: ModernGenerateFormProps) {
  const [trend, setTrend] = useState("")
  const [purpose, setPurpose] = useState("engagement")
  const [aiProvider, setAiProvider] = useState("grok")
  const [abMode, setAbMode] = useState(false)
  const [contextMode, setContextMode] = useState(true)
  const [factCheck, setFactCheck] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [trends, setTrends] = useState<TrendItem[]>([])
  const [isLoadingTrends, setIsLoadingTrends] = useState(false)

  const loadTrends = useCallback(async () => {
    if (!userId) return
    setIsLoadingTrends(true)
    setTrends([])
    try {
      const result = await getTrendsForUser(userId, selectedAccountId ?? undefined)
      setTrends(result.trends)
      if (result.error && onTrendsError) {
        onTrendsError(result.error)
      } else if (result.trends.length === 0 && onTrendsError) {
        onTrendsError("トレンドを取得できませんでした。X連携とアカウントを確認するか、手動で入力してください。")
      }
    } catch (e) {
      if (onTrendsError) onTrendsError("トレンドの取得に失敗しました。しばらくしてから再度お試しください。")
    } finally {
      setIsLoadingTrends(false)
    }
  }, [userId, selectedAccountId, onTrendsError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!purpose.trim()) return
    await onGenerate(trend.trim(), purpose, aiProvider, isPro ? abMode : false, contextMode, factCheck)
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Inline header with advanced toggle */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">投稿設定</h3>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-8 border-2 text-foreground"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Settings2 className="h-4 w-4 mr-1.5" />
            詳細設定
          </Button>
        </div>

        <div>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Trend Input */}
            <div className="space-y-2" id="trend-input">
              <div className="flex items-center gap-2">
                <Label htmlFor="trend" className="text-sm font-medium">
                  トレンド・キーワード（任意）
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="p-0.5 rounded hover:bg-accent transition-colors">
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px]">
                    <p className="text-xs">
                      投稿に関連するトレンドやキーワードを入力。空欄の場合は目的のみで通常投稿を生成します。
                      例：「#日曜劇場リブート」「AIトレンド」
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="relative">
                <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="trend"
                  value={trend}
                  onChange={(e) => setTrend(e.target.value)}
                  placeholder="空欄で通常投稿（目的のみで生成）"
                  className="pl-10 h-11 rounded-xl border-2 border-muted focus:border-primary transition-colors"
                />
              </div>
              {userId && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl h-8"
                    onClick={loadTrends}
                    disabled={isLoadingTrends}
                  >
                    {isLoadingTrends ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    )}
                    トレンドを取得
                  </Button>
                  {trends.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      日本トレンド {trends.length}件 — クリックで入力
                    </span>
                  )}
                </div>
              )}
              {trends.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {trends.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setTrend(t.name)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-sm border transition-colors",
                        trend === t.name
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 border-border hover:bg-muted"
                      )}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Purpose Select */}
            <div className="space-y-2" id="purpose-select">
              <div className="flex items-center gap-2">
                <Label htmlFor="purpose" className="text-sm font-medium">
                  投稿の目的
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="p-0.5 rounded hover:bg-accent transition-colors">
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[250px]">
                    <p className="text-xs">
                      目的に応じて、AIが最適な文体やトーンで投稿を生成します。
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger className="h-11 rounded-xl border-2 border-muted focus:border-primary">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {purposes.map((p) => (
                    <SelectItem key={p.value} value={p.value} className="rounded-lg">
                      <div className="flex flex-col">
                        <span className="font-medium">{p.label}</span>
                        <span className="text-xs text-muted-foreground">{p.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* AI Provider: Grok / Claude */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">AIプロバイダー</Label>
              <div className="flex gap-2">
                {aiProviders.map((provider) => (
                  <button
                    key={provider.value}
                    type="button"
                    onClick={() => setAiProvider(provider.value)}
                    className={cn(
                      "flex-1 p-3 rounded-xl border-2 transition-all",
                      aiProvider === provider.value
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className={cn(
                        "h-4 w-4",
                        aiProvider === provider.value ? "text-primary" : "text-muted-foreground"
                      )} />
                      <div className="text-left">
                        <p className="font-medium text-sm">{provider.label}</p>
                        <p className="text-xs text-muted-foreground">{provider.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Context Mode: use past posts as RAG for coherent flow */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-green-500" />
                <div>
                  <Label className="text-sm font-medium">コンテキストを考慮</Label>
                  <p className="text-xs text-muted-foreground">直近投稿の流れ・テーマを踏まえて生成</p>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Switch checked={contextMode} onCheckedChange={setContextMode} />
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[240px]">
                  <p className="text-xs">ONにするとあなたの直近5〜8件の投稿を参照し、前回の締めやテーマから自然につながる案を生成します。</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Fact Check: AI verify factual claims */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <div>
                  <Label className="text-sm font-medium">事実確認</Label>
                  <p className="text-xs text-muted-foreground">数字・固有名詞などをAIでチェック</p>
                </div>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Switch checked={factCheck} onCheckedChange={setFactCheck} />
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[240px]">
                  <p className="text-xs">ONにすると生成後に事実関係をチェックし、スコアと修正提案を表示します。70未満の場合は投稿前に警告が出ます。</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* AB Mode (Pro): generate 2–3 variations for comparison */}
            {isPro && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-green-500" />
                  <div>
                    <Label className="text-sm font-medium">ABモード</Label>
                    <p className="text-xs text-muted-foreground">2〜3案を同時投稿して分析で比較</p>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Switch checked={abMode} onCheckedChange={setAbMode} />
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[240px]">
                    <p className="text-xs">ONにすると同じトレンドで複数案を生成。投稿時に同じテストIDで記録し、分析ページでインプレッション差を比較できます。</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}

            {/* Advanced Settings (other options if any in future) */}
            {showAdvanced && (
              <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-border animate-fade-in">
                <p className="text-sm text-muted-foreground">追加オプションはここに表示されます。</p>
              </div>
            )}

            {/* Generate Button - Premium */}
            <Button
              id="generate-button"
              type="submit"
              disabled={isLoading || !purpose.trim()}
              className={cn(
                "w-full h-14 rounded-2xl text-base font-semibold transition-all duration-300",
                "btn-gradient-premium text-white",
                "shadow-xl shadow-green-500/25 hover:shadow-green-500/40",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  AIが生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  生成する
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </TooltipProvider>
  )
}
