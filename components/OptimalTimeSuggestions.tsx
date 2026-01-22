"use client"

import * as React from "react"
import { Clock, Zap, TrendingUp, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { OptimalPostingTime } from "@/app/actions"
import { cn } from "@/lib/utils"

interface OptimalTimeSuggestionsProps {
  optimalTimes: OptimalPostingTime[]
  isLoading: boolean
  onSelectTime: (date: Date) => void
  className?: string
}

export function OptimalTimeSuggestions({
  optimalTimes,
  isLoading,
  onSelectTime,
  className,
}: OptimalTimeSuggestionsProps) {
  if (isLoading) {
    return (
      <Card className={cn("border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5" />
            最適投稿時間を分析中...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-gray-900 rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (optimalTimes.length === 0) {
    return (
      <Card className={cn("border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5" />
            最適投稿時間
          </CardTitle>
          <CardDescription>
            投稿データが不足しています。投稿を続けると最適な時間を提案します。
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className={cn("border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5" />
          最適投稿時間の提案
        </CardTitle>
        <CardDescription>
          過去の投稿データから分析した、エンゲージメントが高い投稿時間です
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {optimalTimes.map((time, index) => {
          const isToday = time.date.toDateString() === new Date().toDateString()
          const isPast = time.date < new Date()
          
          return (
            <div
              key={index}
              className={cn(
                "p-4 border border-gray-200 dark:border-gray-800 rounded-xl",
                "hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors",
                isPast && "opacity-50"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">
                      {isToday ? "今日" : time.date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                      {" "}
                      {time.weekdayName}曜日 {time.hour}時
                    </span>
                    {index === 0 && (
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                        おすすめ
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      <span>平均エンゲージ: {time.averageEngagement}</span>
                    </div>
                    {time.averageImpressions > 0 && (
                      <div className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        <span>平均インプ: {time.averageImpressions.toLocaleString('ja-JP')}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>投稿数: {time.postCount}</span>
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {time.reason}
                  </p>
                </div>
                
                <Button
                  onClick={() => onSelectTime(time.date)}
                  disabled={isPast}
                  size="sm"
                  className="rounded-full shrink-0"
                  variant={index === 0 ? "default" : "outline"}
                >
                  この時間に設定
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
