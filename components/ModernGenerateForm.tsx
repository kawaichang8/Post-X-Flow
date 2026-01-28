"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { MemoFlowToggle } from "@/components/MemoFlowToggle"
import { cn } from "@/lib/utils"
import {
  Sparkles,
  TrendingUp,
  Target,
  Loader2,
  Info,
  Zap,
  Settings2,
} from "lucide-react"

interface ModernGenerateFormProps {
  onGenerate: (trend: string, purpose: string, aiProvider: string) => Promise<void>
  isLoading?: boolean
  memoFlowEnabled?: boolean
  onMemoFlowToggle?: (enabled: boolean) => void
  promotionUrl?: string
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
  memoFlowEnabled = false,
  onMemoFlowToggle,
  promotionUrl,
}: ModernGenerateFormProps) {
  const [trend, setTrend] = useState("")
  const [purpose, setPurpose] = useState("engagement")
  const [aiProvider, setAiProvider] = useState("grok")
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trend.trim()) return
    await onGenerate(trend, purpose, aiProvider)
  }

  return (
    <TooltipProvider>
      <Card className="rounded-2xl border border-border shadow-soft overflow-hidden">
        {/* Header with gradient */}
        <CardHeader className="bg-gradient-to-r from-green-50 to-white dark:from-green-950/30 dark:to-card border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              投稿を作成
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg text-muted-foreground"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings2 className="h-4 w-4 mr-1.5" />
              詳細設定
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Trend Input */}
            <div className="space-y-2" id="trend-input">
              <div className="flex items-center gap-2">
                <Label htmlFor="trend" className="text-sm font-medium">
                  トレンド・キーワード
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="p-0.5 rounded hover:bg-accent transition-colors">
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px]">
                    <p className="text-xs">
                      投稿に関連するトレンドやキーワードを入力してください。
                      例：「#日曜劇場リブート」「AIトレンド」「ChatGPT活用」
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
                  placeholder="例：#日曜劇場リブート、AIトレンド"
                  className="pl-10 h-11 rounded-xl border-2 border-muted focus:border-primary transition-colors"
                  required
                />
              </div>
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

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-border animate-fade-in">
                {/* AI Provider */}
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

                {/* MemoFlow Toggle */}
                {onMemoFlowToggle && (
                  <MemoFlowToggle
                    enabled={memoFlowEnabled}
                    onToggle={onMemoFlowToggle}
                    promotionUrl={promotionUrl}
                  />
                )}
              </div>
            )}

            {/* Generate Button */}
            <Button
              id="generate-button"
              type="submit"
              disabled={isLoading || !trend.trim()}
              className={cn(
                "w-full h-12 rounded-xl text-base font-medium transition-all",
                "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700",
                "shadow-lg hover:shadow-glow-green"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  AIで投稿を生成
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
