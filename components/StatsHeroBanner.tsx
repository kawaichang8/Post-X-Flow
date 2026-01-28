"use client"

import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { 
  TrendingUp, 
  Calendar, 
  BarChart3, 
  Zap,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react"

interface StatItem {
  label: string
  value: string | number
  change?: number
  changeLabel?: string
  icon: typeof TrendingUp
  color: "green" | "blue" | "purple" | "orange"
}

interface StatsHeroBannerProps {
  stats?: {
    postsToday?: number
    scheduledCount?: number
    totalEngagement?: number
    avgScore?: number
  }
  className?: string
}

const colorClasses = {
  green: {
    bg: "from-green-500/10 to-emerald-500/5 dark:from-green-500/20 dark:to-emerald-500/10",
    icon: "bg-green-500/10 text-green-600 dark:text-green-400",
    text: "text-green-600 dark:text-green-400"
  },
  blue: {
    bg: "from-blue-500/10 to-cyan-500/5 dark:from-blue-500/20 dark:to-cyan-500/10",
    icon: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    text: "text-blue-600 dark:text-blue-400"
  },
  purple: {
    bg: "from-purple-500/10 to-pink-500/5 dark:from-purple-500/20 dark:to-pink-500/10",
    icon: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    text: "text-purple-600 dark:text-purple-400"
  },
  orange: {
    bg: "from-orange-500/10 to-amber-500/5 dark:from-orange-500/20 dark:to-amber-500/10",
    icon: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    text: "text-orange-600 dark:text-orange-400"
  }
}

export function StatsHeroBanner({ stats, className }: StatsHeroBannerProps) {
  const statItems: StatItem[] = [
    {
      label: "今日の投稿",
      value: stats?.postsToday ?? 0,
      change: 12,
      changeLabel: "昨日比",
      icon: Zap,
      color: "green"
    },
    {
      label: "予約投稿",
      value: stats?.scheduledCount ?? 0,
      icon: Calendar,
      color: "blue"
    },
    {
      label: "エンゲージメント",
      value: stats?.totalEngagement ?? 0,
      change: 8,
      changeLabel: "週比",
      icon: TrendingUp,
      color: "purple"
    },
    {
      label: "平均スコア",
      value: stats?.avgScore ? `${stats.avgScore}点` : "---",
      icon: BarChart3,
      color: "orange"
    }
  ]

  return (
    <div className={cn("grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4", className)}>
      {statItems.map((stat, index) => {
        const Icon = stat.icon
        const colors = colorClasses[stat.color]
        
        return (
          <Card 
            key={index}
            className={cn(
              "relative overflow-hidden border-0 bg-gradient-to-br transition-all duration-300 hover:scale-[1.02] hover:shadow-soft-lg",
              colors.bg
            )}
          >
            <div className="p-4 md:p-5">
              <div className="flex items-start justify-between">
                <div className={cn("p-2 md:p-2.5 rounded-xl", colors.icon)}>
                  <Icon className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                {stat.change !== undefined && (
                  <div className={cn(
                    "flex items-center gap-0.5 text-xs font-medium",
                    stat.change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
                  )}>
                    {stat.change >= 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {Math.abs(stat.change)}%
                  </div>
                )}
              </div>
              <div className="mt-3 md:mt-4">
                <p className="text-2xl md:text-3xl font-bold tracking-tight">
                  {stat.value}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                  {stat.label}
                </p>
              </div>
            </div>
            {/* Decorative gradient orb */}
            <div className={cn(
              "absolute -right-6 -bottom-6 w-20 h-20 rounded-full opacity-20 blur-2xl",
              stat.color === "green" && "bg-green-500",
              stat.color === "blue" && "bg-blue-500",
              stat.color === "purple" && "bg-purple-500",
              stat.color === "orange" && "bg-orange-500"
            )} />
          </Card>
        )
      })}
    </div>
  )
}
