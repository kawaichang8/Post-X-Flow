"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Target, 
  Brain, 
  RefreshCw,
  Calendar,
  Zap,
  AlertCircle
} from "lucide-react"
import { 
  getOptimalPostingTimes, 
  getPredictionAccuracyStats,
  getTimingHistory,
  OptimalTimingResult
} from "@/app/actions-analytics"
import type { EngagementFeatures } from "@/lib/engagement-predictor-types"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

interface AnalyticsDashboardProps {
  userId: string
  features?: EngagementFeatures
}

export function AnalyticsDashboard({ userId, features }: AnalyticsDashboardProps) {
  const { showToast } = useToast()
  const [optimalTimings, setOptimalTimings] = useState<OptimalTimingResult | null>(null)
  const [accuracyStats, setAccuracyStats] = useState<any>(null)
  const [timingHistory, setTimingHistory] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [useExternalData, setUseExternalData] = useState(false)

  useEffect(() => {
    loadAccuracyStats()
    loadTimingHistory()
  }, [userId])

  const loadAccuracyStats = async () => {
    try {
      const stats = await getPredictionAccuracyStats(userId)
      setAccuracyStats(stats)
    } catch (error) {
      console.error("Error loading accuracy stats:", error)
    }
  }

  const loadTimingHistory = async () => {
    try {
      const history = await getTimingHistory(userId)
      setTimingHistory(history)
    } catch (error) {
      console.error("Error loading timing history:", error)
    }
  }

  const handleGetOptimalTimings = async () => {
    if (!features) {
      showToast("投稿内容を入力してください", "warning")
      return
    }

    setIsLoading(true)
    try {
      const result = await getOptimalPostingTimes(userId, features, useExternalData)
      setOptimalTimings(result)
      if (result.error) {
        showToast(result.error, "error")
      } else {
        showToast("最適タイミングを取得しました", "success")
        loadTimingHistory() // 履歴を更新
      }
    } catch (error) {
      console.error("Error getting optimal timings:", error)
      showToast("最適タイミングの取得に失敗しました", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const dayNames = ['日', '月', '火', '水', '木', '金', '土']

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            アナリティクス
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            AI予測とデータ分析で投稿を最適化
          </p>
        </div>
      </div>

      {/* 予測精度統計 */}
      {accuracyStats && (
        <Card className="border border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              予測精度統計
            </CardTitle>
            <CardDescription>
              過去の予測の精度を表示します
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">平均精度</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {accuracyStats.averageAccuracy.toFixed(1)}%
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">総予測数</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {accuracyStats.totalPredictions}
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400">高精度予測</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {accuracyStats.accuratePredictions}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  (70%以上)
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 最適タイミング提案 */}
      <Card className="border border-gray-200 dark:border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                最適投稿タイミング
              </CardTitle>
              <CardDescription>
                過去のデータとAI分析から最適な投稿タイミングを提案
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={useExternalData ? "enabled" : "disabled"}
                onValueChange={(value) => setUseExternalData(value === "enabled")}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">基本</SelectItem>
                  <SelectItem value="enabled">外部API</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleGetOptimalTimings}
                disabled={isLoading || !features}
                size="sm"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                取得
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!features && (
            <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
              投稿内容を入力してから最適タイミングを取得してください
            </div>
          )}

          {optimalTimings && optimalTimings.timings.length > 0 && (
            <div className="space-y-4">
              {optimalTimings.timings.map((timing, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span className="font-semibold">
                          {formatDate(timing.date)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {dayNames[timing.dayOfWeek]}曜日 {timing.hour}時
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {timing.reason}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>予測エンゲージメント: {timing.predictedEngagement}/100</span>
                        <span>信頼度: {Math.round(timing.confidence * 100)}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-2xl font-bold",
                        timing.predictedEngagement >= 80 ? "text-green-600" :
                        timing.predictedEngagement >= 60 ? "text-blue-600" :
                        "text-yellow-600"
                      )}>
                        {timing.predictedEngagement}
                      </div>
                      <div className="text-xs text-gray-500">/100</div>
                    </div>
                  </div>
                </div>
              ))}

              {/* 外部データの推奨事項 */}
              {optimalTimings.externalInsights && 
               optimalTimings.externalInsights.recommendations.length > 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-1">
                        外部データ分析
                      </div>
                      <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                        {optimalTimings.externalInsights.recommendations.map((rec, idx) => (
                          <li key={idx}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {optimalTimings && optimalTimings.timings.length === 0 && (
            <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
              最適タイミングが見つかりませんでした
            </div>
          )}
        </CardContent>
      </Card>

      {/* タイミング履歴 */}
      {timingHistory.length > 0 && (
        <Card className="border border-gray-200 dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              タイミング履歴
            </CardTitle>
            <CardDescription>
              過去に提案された最適タイミング
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {timingHistory.slice(0, 10).map((item, index) => (
                <div
                  key={index}
                  className="p-3 border border-gray-200 dark:border-gray-800 rounded-lg text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">
                        {dayNames[item.dayOfWeek]}曜日 {item.hour}時
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 ml-2">
                        ({formatDate(item.date)})
                      </span>
                    </div>
                    <Badge variant="outline">
                      予測: {item.predictedEngagement}/100
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
