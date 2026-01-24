"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ProgressBar } from "@/components/ProgressBar"
import { TrendingUp, Brain, BarChart3, AlertCircle, CheckCircle2 } from "lucide-react"
import { predictEngagement, EngagementPredictionResult } from "@/app/actions-analytics"
import { EngagementFeatures } from "@/lib/engagement-predictor"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

interface EngagementPredictorProps {
  features: EngagementFeatures
  userId: string
  postId?: string
  onPredictionComplete?: (prediction: EngagementPredictionResult) => void
}

export function EngagementPredictor({
  features,
  userId,
  postId,
  onPredictionComplete,
}: EngagementPredictorProps) {
  const { showToast } = useToast()
  const [prediction, setPrediction] = useState<EngagementPredictionResult | null>(null)
  const [isPredicting, setIsPredicting] = useState(false)

  const handlePredict = async () => {
    setIsPredicting(true)
    try {
      const result = await predictEngagement(userId, features, postId)
      setPrediction(result)
      if (onPredictionComplete) {
        onPredictionComplete(result)
      }
      if (result.error) {
        showToast(result.error, "error")
      } else {
        showToast("エンゲージメント予測が完了しました", "success")
      }
    } catch (error) {
      console.error("Error predicting engagement:", error)
      showToast("予測に失敗しました", "error")
    } finally {
      setIsPredicting(false)
    }
  }

  const getEngagementColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400"
    if (score >= 60) return "text-blue-600 dark:text-blue-400"
    if (score >= 40) return "text-yellow-600 dark:text-yellow-400"
    return "text-red-600 dark:text-red-400"
  }

  const getEngagementLabel = (score: number) => {
    if (score >= 80) return "非常に高い"
    if (score >= 60) return "高い"
    if (score >= 40) return "中程度"
    return "低い"
  }

  return (
    <Card className="border border-gray-200 dark:border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <CardTitle className="text-lg">エンゲージメント予測</CardTitle>
          </div>
          <Button
            onClick={handlePredict}
            disabled={isPredicting}
            size="sm"
            variant="outline"
          >
            {isPredicting ? "予測中..." : "予測する"}
          </Button>
        </div>
        <CardDescription>
          AIが投稿のエンゲージメントを予測します
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!prediction && !isPredicting && (
          <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400">
            「予測する」ボタンをクリックしてエンゲージメントを予測してください
          </div>
        )}

        {isPredicting && (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">予測中...</p>
          </div>
        )}

        {prediction && prediction.prediction && (
          <div className="space-y-4">
            {/* 予測スコア */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">予測エンゲージメント</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-base font-bold",
                    getEngagementColor(prediction.prediction.predictedEngagement)
                  )}
                >
                  {prediction.prediction.predictedEngagement}/100
                </Badge>
              </div>
              <ProgressBar value={prediction.prediction.predictedEngagement} />
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <TrendingUp className="h-3 w-3" />
                <span>
                  {getEngagementLabel(prediction.prediction.predictedEngagement)}エンゲージメントが期待できます
                </span>
              </div>
            </div>

            {/* 信頼度 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">信頼度</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {Math.round(prediction.prediction.confidence * 100)}%
                </span>
              </div>
              <ProgressBar value={prediction.prediction.confidence * 100} />
            </div>

            {/* 予測要因 */}
            <div className="space-y-2">
              <span className="text-sm font-medium">予測要因</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded">
                  <div className="text-gray-500 dark:text-gray-400">テキスト品質</div>
                  <div className="font-semibold">{prediction.prediction.factors.textQuality}/100</div>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded">
                  <div className="text-gray-500 dark:text-gray-400">タイミング</div>
                  <div className="font-semibold">{prediction.prediction.factors.timingScore}/100</div>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded">
                  <div className="text-gray-500 dark:text-gray-400">ハッシュタグ</div>
                  <div className="font-semibold">{prediction.prediction.factors.hashtagScore}/100</div>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-900 rounded">
                  <div className="text-gray-500 dark:text-gray-400">フォーマット</div>
                  <div className="font-semibold">{prediction.prediction.factors.formatScore}/100</div>
                </div>
              </div>
            </div>

            {/* AI分析（AI予測の場合） */}
            {prediction.prediction.breakdown && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-1">
                      AI分析
                    </div>
                    <p className="text-xs text-blue-800 dark:text-blue-300">
                      {prediction.prediction.breakdown}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 予測方法 */}
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <BarChart3 className="h-3 w-3" />
              <span>
                予測方法: {
                  prediction.prediction.method === 'ai' ? 'AI予測' :
                  prediction.prediction.method === 'hybrid' ? 'ハイブリッド（AI + 回帰）' :
                  prediction.prediction.method === 'regression' ? '回帰モデル' :
                  '回帰モデル'
                }
              </span>
            </div>
          </div>
        )}

        {prediction?.error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{prediction.error}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
