"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { 
  Sparkles, 
  Crown, 
  Zap, 
  Infinity,
  BarChart3,
  Image as ImageIcon,
  RefreshCw,
  X,
  Loader2,
  Clock
} from "lucide-react"

interface UpgradeBannerProps {
  trialDaysRemaining?: number
  generationsRemaining?: number
  generationsLimit?: number
  onUpgrade: () => Promise<void>
  className?: string
  variant?: "default" | "compact" | "sidebar"
  dismissible?: boolean
}

const features = [
  { icon: Infinity, label: "無制限の生成" },
  { icon: RefreshCw, label: "再投稿提案" },
  { icon: ImageIcon, label: "無制限メディア" },
  { icon: BarChart3, label: "高度な分析" },
]

export function UpgradeBanner({
  trialDaysRemaining = 0,
  generationsRemaining = 3,
  generationsLimit = 3,
  onUpgrade,
  className,
  variant = "default",
  dismissible = true,
}: UpgradeBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  if (isDismissed) return null

  const handleUpgrade = async () => {
    setIsLoading(true)
    try {
      await onUpgrade()
    } catch (error) {
      console.error("Upgrade error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Compact variant for sidebar
  if (variant === "sidebar") {
    return (
      <div className={cn(
        "p-3 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20",
        className
      )}>
        <div className="flex items-center gap-2 mb-2">
          <Crown className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            PRO
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {trialDaysRemaining > 0 
            ? `トライアル残り${trialDaysRemaining}日`
            : `本日残り${generationsRemaining}回`
          }
        </p>
        <Button
          onClick={handleUpgrade}
          disabled={isLoading}
          size="sm"
          className="w-full h-8 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-medium"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Zap className="h-3 w-3 mr-1" />
              アップグレード
            </>
          )}
        </Button>
      </div>
    )
  }

  // Compact variant
  if (variant === "compact") {
    return (
      <div className={cn(
        "flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20",
        className
      )}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-medium text-sm">
              {trialDaysRemaining > 0 
                ? `トライアル期間: 残り${trialDaysRemaining}日`
                : "無料プラン"
              }
            </p>
            <p className="text-xs text-muted-foreground">
              本日の生成: {generationsRemaining}/{generationsLimit}回
            </p>
          </div>
        </div>
        <Button
          onClick={handleUpgrade}
          disabled={isLoading}
          size="sm"
          className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Zap className="h-4 w-4 mr-1.5" />
              PRO
            </>
          )}
        </Button>
      </div>
    )
  }

  // Default full banner
  return (
    <Card className={cn(
      "relative overflow-hidden border-0 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-rose-500/10",
      className
    )}>
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-500/20 rounded-full blur-3xl" />
      
      {dismissible && (
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-black/10 transition-colors z-10"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      <CardContent className="relative p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Left content */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Crown className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  postXflow Pro
                  {trialDaysRemaining > 0 && (
                    <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                      <Clock className="h-3 w-3 mr-1" />
                      残り{trialDaysRemaining}日
                    </Badge>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">
                  すべての機能を無制限に使用
                </p>
              </div>
            </div>

            {/* Usage indicator */}
            {Number.isFinite(generationsLimit) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">本日の生成回数</span>
                  <span className="font-medium">
                    {generationsRemaining}/{generationsLimit}回
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      generationsRemaining === 0 
                        ? "bg-red-500" 
                        : generationsRemaining <= 1 
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    )}
                    style={{ width: `${(generationsRemaining / generationsLimit) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Features */}
            <div className="flex flex-wrap gap-2">
              {features.map((feature) => (
                <div
                  key={feature.label}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background/50 text-xs font-medium"
                >
                  <feature.icon className="h-3.5 w-3.5 text-amber-500" />
                  {feature.label}
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-2">
            <Button
              onClick={handleUpgrade}
              disabled={isLoading}
              size="lg"
              className="w-full md:w-auto px-8 h-12 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/30 transition-all duration-300 hover:shadow-amber-500/50"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Proにアップグレード
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              いつでもキャンセル可能
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Small inline upgrade prompt
export function InlineUpgradePrompt({ 
  feature, 
  onUpgrade 
}: { 
  feature: string
  onUpgrade: () => Promise<void> 
}) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    setIsLoading(true)
    try {
      await onUpgrade()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
      <Crown className="h-4 w-4 text-amber-500 shrink-0" />
      <p className="text-xs text-amber-700 dark:text-amber-300 flex-1">
        <span className="font-medium">{feature}</span>はProプランで利用可能
      </p>
      <Button
        onClick={handleClick}
        disabled={isLoading}
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50"
      >
        {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "アップグレード"}
      </Button>
    </div>
  )
}
