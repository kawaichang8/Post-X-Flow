"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  Crown,
  Check,
  ArrowRight,
  Loader2,
  AlertCircle,
  Infinity,
  RefreshCw,
  Image as ImageIcon,
  BarChart3,
  Megaphone,
  FlaskConical,
} from "lucide-react"

export interface ProCardConfig {
  /** 残り枠数（限定枠の表示用、デフォルト 5） */
  spotsLeft?: number
  /** 総枠数（progress 用、デフォルト 5） */
  spotsTotal?: number
  /** 旧価格（打ち消し線表示、例: "¥66,000"） */
  oldPrice?: string
  /** 新価格（例: "¥44,800" または "¥1,480/月"） */
  price?: string
  /** 価格単位（例: "/月" または "/3ヶ月"） */
  priceUnit?: string
  /** PRO利用者数バッジ（例: "90人がPRO利用中"） */
  userCountLabel?: string
  /** 現在のプラン表示（例: "Free"） */
  currentPlan?: string
}

const DEFAULT_CONFIG: Required<ProCardConfig> = {
  spotsLeft: 5,
  spotsTotal: 5,
  oldPrice: "¥66,000",
  price: "¥44,800",
  priceUnit: "/3ヶ月",
  userCountLabel: "90人がPRO利用中",
  currentPlan: "Free",
}

const PRO_FEATURES = [
  { icon: Infinity, label: "無制限の生成" },
  { icon: RefreshCw, label: "再投稿提案" },
  { icon: ImageIcon, label: "無制限メディア" },
  { icon: BarChart3, label: "高度な分析" },
  { icon: Megaphone, label: "カスタム宣伝" },
  { icon: FlaskConical, label: "ABテスト" },
]

export interface ProCardProps {
  config?: ProCardConfig
  onUpgrade: () => Promise<void>
  className?: string
  /** コンパクト表示（サイドバー等） */
  variant?: "default" | "compact"
  /** 非PROユーザー向けに表示するか（現在のプラン表示を変える） */
  showAsUpgrade?: boolean
}

export function ProCard({
  config: configProp,
  onUpgrade,
  className,
  variant = "default",
  showAsUpgrade = true,
}: ProCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const config = { ...DEFAULT_CONFIG, ...configProp }
  const spotsLeft = Math.max(0, config.spotsLeft)
  const spotsTotal = Math.max(1, config.spotsTotal)
  const spotsPercent = Math.min(100, (spotsLeft / spotsTotal) * 100)

  const handleUpgrade = async () => {
    setIsLoading(true)
    try {
      await onUpgrade()
    } catch (e) {
      console.error("ProCard upgrade error:", e)
    } finally {
      setIsLoading(false)
    }
  }

  if (variant === "compact") {
    return (
      <Card
        className={cn(
          "overflow-hidden border-0 bg-gradient-to-br from-orange-500/15 via-red-500/10 to-amber-500/15 rounded-xl shadow-lg shadow-orange-500/10",
          "hover:shadow-orange-500/20 transition-shadow",
          className
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">PRO</span>
            <Badge
              variant="destructive"
              className="ml-auto rounded-full bg-orange-500/90 text-white border-0 text-[10px] px-1.5 py-0 animate-pulse"
            >
              <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
              残り{spotsLeft}枠
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {config.price}
            {config.priceUnit}
          </p>
          <Button
            onClick={handleUpgrade}
            disabled={isLoading}
            size="sm"
            className={cn(
              "w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700",
              "text-white font-medium transition-transform hover:scale-105"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                今すぐPROを始める
                <ArrowRight className="h-3 w-3 ml-1" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-0 rounded-xl",
        "bg-gradient-to-r from-orange-500/20 via-red-500/15 to-amber-500/20",
        "shadow-xl shadow-orange-500/10 dark:shadow-orange-900/20",
        "ring-1 ring-orange-500/20 dark:ring-orange-500/10",
        className
      )}
    >
      {/* Decorative glow */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-red-500/15 rounded-full blur-3xl pointer-events-none" />

      <CardHeader className="pb-2 pt-6 px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Crown className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">postXflow PRO</h3>
              {showAsUpgrade && (
                <p className="text-sm text-muted-foreground">
                  現在のプラン: <span className="font-medium text-foreground">{config.currentPlan}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="destructive"
              className={cn(
                "rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 px-3 py-1",
                "animate-pulse"
              )}
            >
              <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
              限定特別価格 残り{spotsLeft}枠
            </Badge>
            {config.userCountLabel && (
              <Badge variant="secondary" className="rounded-full bg-background/80">
                {config.userCountLabel}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6 space-y-6">
        {/* Price */}
        <div className="flex flex-wrap items-baseline gap-2">
          {config.oldPrice && (
            <span className="text-sm text-muted-foreground line-through">{config.oldPrice}</span>
          )}
          <span className="text-2xl font-bold text-foreground">
            {config.price}
            <span className="text-base font-normal text-muted-foreground">{config.priceUnit}</span>
          </span>
        </div>

        {/* Spots progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">残り枠</span>
            <span className={cn(
              "font-medium",
              spotsPercent <= 20 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
            )}>
              残り{spotsLeft}/{spotsTotal}
            </span>
          </div>
          <Progress
            value={spotsPercent}
            className="h-2 bg-muted"
            indicatorClassName={cn(
              "rounded-full transition-all",
              spotsPercent <= 20 ? "bg-red-500" : "bg-green-500"
            )}
          />
        </div>

        {/* Features */}
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRO_FEATURES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 text-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
                <Check className="h-3 w-3" />
              </span>
              <span className="text-foreground">{label}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
          <Button
            onClick={handleUpgrade}
            disabled={isLoading}
            size="lg"
            className={cn(
              "w-full sm:w-auto rounded-xl h-12 px-8",
              "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700",
              "text-white font-semibold shadow-lg shadow-green-500/30",
              "transition-all duration-300 hover:scale-105 hover:shadow-green-500/40"
            )}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                今すぐPROを始める
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            いつでもキャンセルOK
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
