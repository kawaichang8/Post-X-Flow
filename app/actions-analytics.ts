"use server"

import { createServerClient } from "@/lib/supabase"
import { classifyError, logErrorToSentry } from "@/lib/error-handler"
import { predictEngagementHybrid } from "@/lib/engagement-predictor"
import type { EngagementFeatures, EngagementPrediction } from "@/lib/engagement-predictor-types"
import { 
  suggestOptimalTimings, 
  OptimalTiming,
  analyzeHistoricalTiming,
  optimizeTimingWithExternalData
} from "@/lib/timing-optimizer"
import { 
  getExternalInsights, 
  ExternalDataConfig 
} from "@/lib/external-apis"

export interface EngagementPredictionResult {
  prediction: EngagementPrediction
  predictionId?: string
  error?: string
}

export interface OptimalTimingResult {
  timings: OptimalTiming[]
  externalInsights?: {
    marketInsight?: any
    newsInsight?: any
    recommendations: string[]
  }
  error?: string
}

/**
 * エンゲージメントを予測
 */
export async function predictEngagement(
  userId: string,
  features: EngagementFeatures,
  postId?: string
): Promise<EngagementPredictionResult> {
  try {
    const supabaseAdmin = createServerClient()

    // 過去の投稿データを取得（予測精度向上のため）
    const { data: historicalPosts } = await supabaseAdmin
      .from("post_history")
      .select("text, engagement_score, created_at")
      .eq("user_id", userId)
      .eq("status", "posted")
      .not("engagement_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(50)

    const historicalData = historicalPosts?.map((post: { text: string; engagement_score: number | null; created_at: string }) => ({
      text: post.text,
      engagement: post.engagement_score || 0,
      postedAt: post.created_at,
    })) || []

    // エンゲージメント予測
    const prediction = await predictEngagementHybrid(
      features,
      historicalData.length > 0 ? historicalData : undefined,
      true // AI予測を使用
    )

    // 予測結果をデータベースに保存
    const { data: savedPrediction, error: saveError } = await supabaseAdmin
      .from("engagement_predictions")
      .insert({
        user_id: userId,
        post_id: postId || null,
        predicted_engagement: prediction.predictedEngagement,
        confidence: prediction.confidence,
        method: prediction.method,
        factors: {
          textQuality: prediction.factors.textQuality,
          timingScore: prediction.factors.timingScore,
          hashtagScore: prediction.factors.hashtagScore,
          formatScore: prediction.factors.formatScore,
        },
        breakdown: prediction.breakdown || null,
      })
      .select()
      .single()

    if (saveError) {
      console.error("Error saving prediction:", saveError)
      // 予測は成功しているので、保存エラーは無視
    }

    return {
      prediction,
      predictionId: savedPrediction?.id,
    }
  } catch (error) {
    const appError = classifyError(error)
    logErrorToSentry(appError, {
      action: "predictEngagement",
      userId,
    })
    return {
      prediction: {
        predictedEngagement: 50,
        confidence: 0.5,
        factors: {
          textQuality: 50,
          timingScore: 50,
          hashtagScore: 50,
          formatScore: 50,
        },
        method: 'regression',
      },
      error: "エンゲージメント予測に失敗しました",
    }
  }
}

/**
 * 最適な投稿タイミングを提案
 */
export async function getOptimalPostingTimes(
  userId: string,
  features: EngagementFeatures,
  useExternalData: boolean = false
): Promise<OptimalTimingResult> {
  try {
    const supabaseAdmin = createServerClient()

    // 過去の投稿データを取得
    const { data: historicalPosts } = await supabaseAdmin
      .from("post_history")
      .select("text, engagement_score, created_at")
      .eq("user_id", userId)
      .eq("status", "posted")
      .not("engagement_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(100)

    const historicalData = historicalPosts?.map((post: { text: string; engagement_score: number | null; created_at: string }) => ({
      text: post.text,
      engagement: post.engagement_score || 0,
      postedAt: post.created_at,
    })) || []

    // 外部データの設定
    const externalConfig: ExternalDataConfig = {
      polygonEnabled: useExternalData && !!process.env.POLYGON_API_KEY,
      polygonApiKey: process.env.POLYGON_API_KEY,
      newsApiEnabled: useExternalData && !!process.env.NEWS_API_KEY,
      newsApiKey: process.env.NEWS_API_KEY,
      twitterTrendsEnabled: false, // 将来実装
    }

    // 外部データを取得
    let externalInsights
    if (useExternalData) {
      externalInsights = await getExternalInsights(externalConfig)
    }

    // 最適タイミングを提案
    const timings = await optimizeTimingWithExternalData(
      features,
      useExternalData
    )

    // タイミング履歴を保存
    for (const timing of timings.slice(0, 3)) { // 上位3つを保存
      await supabaseAdmin
        .from("optimal_timing_history")
        .insert({
          user_id: userId,
          suggested_hour: timing.hour,
          suggested_day_of_week: timing.dayOfWeek,
          suggested_date: timing.date.toISOString(),
          predicted_engagement: timing.predictedEngagement,
          confidence: timing.confidence,
          reason: timing.reason,
        })
        .catch((error: unknown) => {
          console.error("Error saving timing history:", error)
          // 保存エラーは無視
        })
    }

    return {
      timings,
      externalInsights,
    }
  } catch (error) {
    const appError = classifyError(error)
    logErrorToSentry(appError, {
      action: "getOptimalPostingTimes",
      userId,
    })
    return {
      timings: [],
      error: "最適タイミングの取得に失敗しました",
    }
  }
}

/**
 * 予測精度を評価（実際のエンゲージメントと予測を比較）
 */
export async function evaluatePredictionAccuracy(
  userId: string,
  predictionId: string,
  actualEngagement: number
): Promise<{ success: boolean; accuracy?: number; error?: string }> {
  try {
    const supabaseAdmin = createServerClient()

    // 予測結果を取得
    const { data: prediction, error: fetchError } = await supabaseAdmin
      .from("engagement_predictions")
      .select("predicted_engagement")
      .eq("id", predictionId)
      .eq("user_id", userId)
      .single()

    if (fetchError || !prediction) {
      return {
        success: false,
        error: "予測結果が見つかりません",
      }
    }

    // 精度を計算（予測値と実際の値の差）
    const difference = Math.abs(prediction.predicted_engagement - actualEngagement)
    const accuracy = Math.max(0, 100 - difference) // 0-100の精度スコア

    // 予測結果を更新
    await supabaseAdmin
      .from("engagement_predictions")
      .update({
        actual_engagement: actualEngagement,
      })
      .eq("id", predictionId)

    return {
      success: true,
      accuracy,
    }
  } catch (error) {
    const appError = classifyError(error)
    logErrorToSentry(appError, {
      action: "evaluatePredictionAccuracy",
      userId,
      predictionId,
    })
    return {
      success: false,
      error: "精度評価に失敗しました",
    }
  }
}

/**
 * 過去の予測精度を取得
 */
export async function getPredictionAccuracyStats(
  userId: string
): Promise<{
  averageAccuracy: number
  totalPredictions: number
  accuratePredictions: number
  methodBreakdown: Record<string, { count: number; avgAccuracy: number }>
}> {
  try {
    const supabaseAdmin = createServerClient()

    const { data: predictions, error } = await supabaseAdmin
      .from("engagement_predictions")
      .select("predicted_engagement, actual_engagement, method")
      .eq("user_id", userId)
      .not("actual_engagement", "is", null)

    if (error || !predictions || predictions.length === 0) {
      return {
        averageAccuracy: 0,
        totalPredictions: 0,
        accuratePredictions: 0,
        methodBreakdown: {},
      }
    }

    // 精度を計算
    const accuracies = predictions.map((p: { predicted_engagement: number; actual_engagement: number | null }) => {
      const difference = Math.abs(p.predicted_engagement - (p.actual_engagement || 0))
      return Math.max(0, 100 - difference)
    })

    const averageAccuracy = accuracies.reduce((sum: number, a: number) => sum + a, 0) / accuracies.length
    const accuratePredictions = accuracies.filter((a: number) => a >= 70).length // 70%以上の精度

    // 方法別の統計
    const methodBreakdown: Record<string, { count: number; totalAccuracy: number }> = {}
    predictions.forEach((p: { method: string | null }, index: number) => {
      const method = p.method || 'unknown'
      if (!methodBreakdown[method]) {
        methodBreakdown[method] = { count: 0, totalAccuracy: 0 }
      }
      methodBreakdown[method].count += 1
      methodBreakdown[method].totalAccuracy += accuracies[index]
    })

    const methodStats: Record<string, { count: number; avgAccuracy: number }> = {}
    Object.entries(methodBreakdown).forEach(([method, data]) => {
      methodStats[method] = {
        count: data.count,
        avgAccuracy: data.totalAccuracy / data.count,
      }
    })

    return {
      averageAccuracy: Math.round(averageAccuracy * 10) / 10,
      totalPredictions: predictions.length,
      accuratePredictions,
      methodBreakdown: methodStats,
    }
  } catch (error) {
    const appError = classifyError(error)
    logErrorToSentry(appError, {
      action: "getPredictionAccuracyStats",
      userId,
    })
    return {
      averageAccuracy: 0,
      totalPredictions: 0,
      accuratePredictions: 0,
      methodBreakdown: {},
    }
  }
}

/**
 * タイミング履歴を取得
 */
export async function getTimingHistory(
  userId: string,
  limit: number = 20
): Promise<OptimalTiming[]> {
  try {
    const supabaseAdmin = createServerClient()

    const { data: history, error } = await supabaseAdmin
      .from("optimal_timing_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error || !history) {
      return []
    }

    return history.map((item: { suggested_hour: number; suggested_day_of_week: number; suggested_date: string; predicted_engagement: number; confidence: number; reason: string | null }) => ({
      hour: item.suggested_hour,
      dayOfWeek: item.suggested_day_of_week,
      date: new Date(item.suggested_date),
      predictedEngagement: item.predicted_engagement,
      confidence: item.confidence,
      reason: item.reason || '',
    }))
  } catch (error) {
    const appError = classifyError(error)
    logErrorToSentry(appError, {
      action: "getTimingHistory",
      userId,
    })
    return []
  }
}
