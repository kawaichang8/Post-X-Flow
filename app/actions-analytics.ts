"use server"

import { createServerClient } from "@/lib/supabase"
import { classifyError, logErrorToSentry } from "@/lib/error-handler"

export interface AnalyticsPost {
  id: string
  text: string
  impression_count: number | null
  engagement_score: number | null
  like_count: number
  retweet_count: number
  reply_count: number
  engagement_rate: number | null
  created_at: string
  trend: string | null
  purpose: string | null
  tweet_id: string | null
  context_used?: boolean | null
  fact_score?: number | null
}

export interface OptimizationAdvice {
  summary: string
  suggestions: { type: "rewrite" | "media" | "timing"; text: string }[]
  lowPerformersCount: number
}

/**
 * Fetch posts for analytics dashboard (post_history, status=posted)
 */
export async function getAnalyticsPosts(
  userId: string,
  limit: number = 100
): Promise<AnalyticsPost[]> {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("post_history")
      .select("id, text, impression_count, engagement_score, like_count, retweet_count, reply_count, engagement_rate, created_at, trend, purpose, tweet_id, context_used, fact_score")
      .eq("user_id", userId)
      .eq("status", "posted")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data || []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      text: p.text as string,
      impression_count: p.impression_count as number | null,
      engagement_score: p.engagement_score as number | null,
      like_count: (p.like_count as number) ?? 0,
      retweet_count: (p.retweet_count as number) ?? 0,
      reply_count: (p.reply_count as number) ?? 0,
      engagement_rate: p.engagement_rate as number | null,
      created_at: p.created_at as string,
      trend: p.trend as string | null,
      purpose: p.purpose as string | null,
      tweet_id: p.tweet_id as string | null,
      context_used: p.context_used as boolean | null | undefined,
      fact_score: p.fact_score as number | null | undefined,
    }))
  } catch (e) {
    console.error("getAnalyticsPosts error:", e)
    return []
  }
}

export interface ABTestGroup {
  ab_test_id: string
  posts: AnalyticsPost[]
  winnerIndex: number // index in posts with highest impressions (or engagement if tie)
  created_at: string // earliest post in group
}

/**
 * Fetch AB test groups (posted posts with same ab_test_id) for comparison
 */
export async function getABTestGroups(userId: string, limit: number = 50): Promise<ABTestGroup[]> {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("post_history")
      .select("id, text, impression_count, engagement_score, like_count, retweet_count, reply_count, engagement_rate, created_at, trend, purpose, tweet_id, ab_test_id")
      .eq("user_id", userId)
      .eq("status", "posted")
      .not("ab_test_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit * 3)

    if (error || !data || data.length === 0) return []

    const byAbId = new Map<string, AnalyticsPost[]>()
    for (const row of data as Array<Record<string, unknown>>) {
      const abId = row.ab_test_id as string
      if (!byAbId.has(abId)) byAbId.set(abId, [])
      byAbId.get(abId)!.push({
        id: row.id as string,
        text: row.text as string,
        impression_count: row.impression_count as number | null,
        engagement_score: row.engagement_score as number | null,
        like_count: (row.like_count as number) ?? 0,
        retweet_count: (row.retweet_count as number) ?? 0,
        reply_count: (row.reply_count as number) ?? 0,
        engagement_rate: row.engagement_rate as number | null,
        created_at: row.created_at as string,
        trend: row.trend as string | null,
        purpose: row.purpose as string | null,
        tweet_id: row.tweet_id as string | null,
      })
    }

    const groups: ABTestGroup[] = []
    for (const [ab_test_id, posts] of byAbId.entries()) {
      if (posts.length < 2) continue
      const sorted = [...posts].sort((a, b) => (b.impression_count ?? 0) - (a.impression_count ?? 0))
      const winnerIndex = posts.indexOf(sorted[0])
      const created_at = posts.reduce((min, p) => (p.created_at < min ? p.created_at : min), posts[0].created_at)
      groups.push({ ab_test_id, posts, winnerIndex, created_at })
    }
    groups.sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    return groups.slice(0, limit)
  } catch (e) {
    console.error("getABTestGroups error:", e)
    return []
  }
}

/**
 * AI optimization advice for low-performance posts (rewrite, media, timing)
 */
export async function getOptimizationAdvice(userId: string): Promise<OptimizationAdvice | null> {
  try {
    const supabase = createServerClient()
    const { data: posts, error } = await supabase
      .from("post_history")
      .select("id, text, impression_count, engagement_score, created_at")
      .eq("user_id", userId)
      .eq("status", "posted")
      .not("engagement_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error || !posts || posts.length === 0) return null

    const withImp = posts.filter((p: { impression_count: number | null }) => p.impression_count != null && p.impression_count > 0)
    const avgImpressions = withImp.length > 0
      ? withImp.reduce((s: number, p: { impression_count: number | null }) => s + (p.impression_count || 0), 0) / withImp.length
      : 0
    const avgEngagement = posts.length > 0
      ? posts.reduce((s: number, p: { engagement_score: number | null }) => s + (p.engagement_score || 0), 0) / posts.length
      : 0

    const lowPerformers = posts.filter((p: { impression_count: number | null; engagement_score: number | null }) => {
      const imp = p.impression_count || 0
      const eng = p.engagement_score || 0
      return (imp > 0 && imp < avgImpressions * 0.7) || eng < avgEngagement * 0.7
    }).slice(0, 10)

    if (lowPerformers.length === 0) {
      return { summary: "低パフォーマンス投稿はありません。", suggestions: [], lowPerformersCount: 0 }
    }

    const { getGrokApiKey, getAnthropicApiKey } = await import("@/lib/server-only")
    let apiKey: string | null = null
    let useGrok = true
    try {
      apiKey = getGrokApiKey()
    } catch {
      try {
        apiKey = getAnthropicApiKey()
        useGrok = false
      } catch {
        return {
          summary: "低パフォーマンス投稿が" + lowPerformers.length + "件あります。冒頭の引きを強くする・メディア追加・投稿時間の見直しを検討してください。",
          suggestions: [
            { type: "rewrite", text: "冒頭10文字で興味を引くフックを入れる" },
            { type: "media", text: "画像や動画を添付してインプレッションを増やす" },
            { type: "timing", text: "アナリティクスの好調時間帯に投稿する" },
          ],
          lowPerformersCount: lowPerformers.length,
        }
      }
    }

    const sampleTexts = lowPerformers.slice(0, 3).map((p: { text: string }) => p.text).join("\n---\n")
    const prompt = `以下のX投稿はインプレッション・エンゲージメントが平均を下回っています。改善アドバイスを3つ以内で簡潔に出力してください（書き換え・メディア追加・投稿タイミング）。日本語で。\n\n【投稿例】\n${sampleTexts}\n\n【出力形式】JSONのみ: { "summary": "要約", "suggestions": [{"type":"rewrite"|"media"|"timing","text":"説明"}] }`

    if (useGrok && apiKey) {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "grok-3-latest",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 500,
        }),
      })
      if (!res.ok) throw new Error("Grok API error")
      const data = await res.json()
      const content = data.choices?.[0]?.message?.content?.trim() || ""
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { summary?: string; suggestions?: { type: string; text: string }[] }
        return {
          summary: parsed.summary || "改善の余地があります。",
          suggestions: (parsed.suggestions || []).map((s) => ({
            type: (s.type === "media" || s.type === "timing" ? s.type : "rewrite") as "rewrite" | "media" | "timing",
            text: s.text,
          })),
          lowPerformersCount: lowPerformers.length,
        }
      }
    } else if (apiKey) {
      const Anthropic = (await import("@anthropic-ai/sdk")).default
      const client = new Anthropic({ apiKey })
      const msg = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      })
      const content = (msg.content[0] as { text?: string })?.text?.trim() || ""
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { summary?: string; suggestions?: { type: string; text: string }[] }
        return {
          summary: parsed.summary || "改善の余地があります。",
          suggestions: (parsed.suggestions || []).map((s) => ({
            type: (s.type === "media" || s.type === "timing" ? s.type : "rewrite") as "rewrite" | "media" | "timing",
            text: s.text,
          })),
          lowPerformersCount: lowPerformers.length,
        }
      }
    }

    return {
      summary: "低パフォーマンス投稿が" + lowPerformers.length + "件あります。",
      suggestions: [
        { type: "rewrite", text: "冒頭の引きを強くする" },
        { type: "media", text: "画像・動画を添付する" },
        { type: "timing", text: "好調時間帯に投稿する" },
      ],
      lowPerformersCount: lowPerformers.length,
    }
  } catch (e) {
    console.error("getOptimizationAdvice error:", e)
    return null
  }
}

export interface OptimizedVersionResult {
  improvedText: string
  expectedImpressionsLiftPercent: number
  reason?: string
}

/**
 * Generate optimized version of a post (AI brush-up) and expected impressions lift (rule-based)
 */
export async function generateOptimizedVersion(
  userId: string,
  postId: string
): Promise<OptimizedVersionResult | null> {
  try {
    const supabase = createServerClient()
    const { data: post, error } = await supabase
      .from("post_history")
      .select("id, text, purpose, impression_count, engagement_score")
      .eq("id", postId)
      .eq("user_id", userId)
      .eq("status", "posted")
      .maybeSingle()

    if (error || !post) return null

    const { improveTweetTextAction } = await import("@/app/actions")
    const result = await improveTweetTextAction(
      post.text as string,
      (post.purpose as string) || undefined,
      "grok",
      { userId, runFactCheck: true }
    )

    if (!result?.improvedText) return null

    // Rule-based expected lift: hook/opening improved → ~10–15%, structure improved → ~5–10%
    const originalLen = (post.text as string).length
    const improvedLen = result.improvedText.length
    const hasMoreStructure = result.improvedText.split("\n").length > (post.text as string).split("\n").length
    const expectedImpressionsLiftPercent = hasMoreStructure ? 12 : originalLen < 50 && improvedLen > originalLen ? 15 : 10

    return {
      improvedText: result.improvedText,
      expectedImpressionsLiftPercent,
      reason: result.reason || undefined,
    }
  } catch (e) {
    console.error("generateOptimizedVersion error:", e)
    return null
  }
}

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
