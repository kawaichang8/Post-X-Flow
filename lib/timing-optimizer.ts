/**
 * 投稿タイミング最適化モジュール
 * 過去のデータと外部APIを活用して最適な投稿タイミングを提案
 */

import 'server-only'
import { predictEngagementHybrid } from './engagement-predictor'
import type { EngagementFeatures } from './engagement-predictor-types'

export interface OptimalTiming {
  hour: number // 0-23
  dayOfWeek: number // 0=日曜日
  date: Date // 具体的な日時
  predictedEngagement: number // 予測エンゲージメント
  confidence: number // 信頼度
  reason: string // 推奨理由
}

export interface TimingAnalysis {
  optimalTimings: OptimalTiming[]
  averageEngagementByHour: Array<{ hour: number; engagement: number }>
  averageEngagementByDay: Array<{ day: number; engagement: number }>
  recommendations: string[]
}

/**
 * 過去の投稿データから最適なタイミングを分析
 */
export function analyzeHistoricalTiming(
  historicalPosts: Array<{
    engagement: number
    postedAt: string
  }>
): TimingAnalysis {
  // 時間帯別の平均エンゲージメント
  const engagementByHour: Record<number, { total: number; count: number }> = {}
  const engagementByDay: Record<number, { total: number; count: number }> = {}

  historicalPosts.forEach((post) => {
    const date = new Date(post.postedAt)
    const hour = date.getHours()
    const day = date.getDay()

    // 時間帯別
    if (!engagementByHour[hour]) {
      engagementByHour[hour] = { total: 0, count: 0 }
    }
    engagementByHour[hour].total += post.engagement
    engagementByHour[hour].count += 1

    // 曜日別
    if (!engagementByDay[day]) {
      engagementByDay[day] = { total: 0, count: 0 }
    }
    engagementByDay[day].total += post.engagement
    engagementByDay[day].count += 1
  })

  // 平均を計算
  const averageByHour = Object.entries(engagementByHour)
    .map(([hour, data]) => ({
      hour: parseInt(hour),
      engagement: data.count > 0 ? data.total / data.count : 0,
    }))
    .sort((a, b) => b.engagement - a.engagement)

  const averageByDay = Object.entries(engagementByDay)
    .map(([day, data]) => ({
      day: parseInt(day),
      engagement: data.count > 0 ? data.total / data.count : 0,
    }))
    .sort((a, b) => b.engagement - a.engagement)

  // 最適なタイミングを特定（上位3つ）
  const topHours = averageByHour.slice(0, 3)
  const topDays = averageByDay.slice(0, 3)

  // 推奨事項を生成
  const recommendations: string[] = []
  
  if (topHours.length > 0) {
    const bestHour = topHours[0]
    recommendations.push(
      `過去のデータから、${bestHour.hour}時台の投稿が最も高いエンゲージメントを獲得しています（平均: ${bestHour.engagement.toFixed(1)}）`
    )
  }

  if (topDays.length > 0) {
    const bestDay = topDays[0]
    const dayNames = ['日', '月', '火', '水', '木', '金', '土']
    recommendations.push(
      `${dayNames[bestDay.day]}曜日の投稿が最も効果的です（平均: ${bestDay.engagement.toFixed(1)}）`
    )
  }

  return {
    optimalTimings: [], // 後で生成
    averageEngagementByHour: averageByHour,
    averageEngagementByDay: averageByDay,
    recommendations,
  }
}

/**
 * 投稿内容と過去データから最適なタイミングを提案
 */
export async function suggestOptimalTimings(
  features: EngagementFeatures,
  historicalPosts?: Array<{
    text: string
    engagement: number
    postedAt: string
  }>,
  daysAhead: number = 7
): Promise<OptimalTiming[]> {
  const suggestions: OptimalTiming[] = []
  const now = new Date()

  // 過去データがある場合は分析
  let historicalAnalysis: TimingAnalysis | null = null
  if (historicalPosts && historicalPosts.length > 0) {
    historicalAnalysis = analyzeHistoricalTiming(historicalPosts)
  }

  // 次の7日間の各時間帯を評価
  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const date = new Date(now)
    date.setDate(date.getDate() + dayOffset)
    date.setMinutes(0)
    date.setSeconds(0)
    date.setMilliseconds(0)

    // 最適な時間帯を評価（朝、昼、夕方、夜）
    const candidateHours = [8, 12, 18, 21] // 朝、昼、夕方、夜

    for (const hour of candidateHours) {
      const candidateDate = new Date(date)
      candidateDate.setHours(hour)

      // 過去のデータがある場合は、その時間帯の平均エンゲージメントを考慮
      let historicalBonus = 0
      if (historicalAnalysis) {
        const hourData = historicalAnalysis.averageEngagementByHour.find(
          (h) => h.hour === hour
        )
        if (hourData) {
          historicalBonus = hourData.engagement * 0.3 // 過去データの30%を考慮
        }
      }

      // エンゲージメント予測
      const prediction = await predictEngagementHybrid(
        {
          ...features,
          hourOfDay: hour,
          dayOfWeek: candidateDate.getDay(),
        },
        historicalPosts,
        true // AI予測を使用
      )

      // 過去データのボーナスを追加
      const finalEngagement = Math.min(
        100,
        prediction.predictedEngagement + historicalBonus
      )

      // 推奨理由を生成
      const reason = generateTimingReason(
        hour,
        candidateDate.getDay(),
        finalEngagement,
        historicalAnalysis
      )

      suggestions.push({
        hour,
        dayOfWeek: candidateDate.getDay(),
        date: candidateDate,
        predictedEngagement: finalEngagement,
        confidence: prediction.confidence,
        reason,
      })
    }
  }

  // 予測エンゲージメントでソート（降順）
  suggestions.sort((a, b) => b.predictedEngagement - a.predictedEngagement)

  // 上位5つを返す
  return suggestions.slice(0, 5)
}

function generateTimingReason(
  hour: number,
  dayOfWeek: number,
  engagement: number,
  historicalAnalysis: TimingAnalysis | null
): string {
  const dayNames = ['日', '月', '火', '水', '木', '金', '土']
  const reasons: string[] = []

  // 時間帯による理由
  if (hour >= 7 && hour <= 9) {
    reasons.push('朝の時間帯は多くのユーザーがアクティブです')
  } else if (hour >= 12 && hour <= 14) {
    reasons.push('昼休みの時間帯は閲覧数が増加します')
  } else if (hour >= 18 && hour <= 20) {
    reasons.push('夕方の時間帯は最もエンゲージメントが高い傾向があります')
  } else if (hour >= 21 && hour <= 23) {
    reasons.push('夜の時間帯はリラックスして閲覧するユーザーが多いです')
  }

  // 曜日による理由
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    reasons.push(`${dayNames[dayOfWeek]}曜日は平日でアクティブユーザーが多いです`)
  } else {
    reasons.push(`${dayNames[dayOfWeek]}曜日は週末で閲覧時間が長くなる傾向があります`)
  }

  // 過去データがある場合
  if (historicalAnalysis) {
    const hourData = historicalAnalysis.averageEngagementByHour.find((h) => h.hour === hour)
    if (hourData && hourData.engagement > 50) {
      reasons.push(`過去のデータではこの時間帯の平均エンゲージメントが${hourData.engagement.toFixed(1)}でした`)
    }
  }

  // 予測エンゲージメントによる理由
  if (engagement >= 80) {
    reasons.push('非常に高いエンゲージメントが期待できます')
  } else if (engagement >= 60) {
    reasons.push('良好なエンゲージメントが期待できます')
  }

  return reasons.join('。') || 'この時間帯が推奨されます'
}

/**
 * 外部API（Polygonなど）から市場データを取得してタイミングを最適化
 */
export async function optimizeTimingWithExternalData(
  features: EngagementFeatures,
  externalApiEnabled: boolean = false
): Promise<OptimalTiming[]> {
  // デフォルトの最適タイミングを取得
  const defaultTimings = await suggestOptimalTimings(features)

  if (!externalApiEnabled) {
    return defaultTimings
  }

  try {
    // Polygon APIから市場データを取得（例：S&P 500の動き）
    // 市場が活発な時間帯はSNSも活発になる傾向がある
    const marketData = await fetchMarketData()

    if (marketData) {
      // 市場データを考慮してタイミングを調整
      return adjustTimingsWithMarketData(defaultTimings, marketData)
    }
  } catch (error) {
    console.error('Error fetching external data:', error)
    // エラーが発生してもデフォルトのタイミングを返す
  }

  return defaultTimings
}

interface MarketData {
  isMarketOpen: boolean
  marketActivity: number // 0-100
  volatility: number // 0-100
  trendingTopics?: string[]
}

async function fetchMarketData(): Promise<MarketData | null> {
  try {
    const polygonApiKey = process.env.POLYGON_API_KEY
    if (!polygonApiKey) {
      return null
    }

    // Polygon APIから市場データを取得
    // 実際の実装では、Polygon APIのエンドポイントを使用
    // ここでは簡易的な実装
    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/SPY/range/1/hour/${new Date(Date.now() - 86400000).toISOString().split('T')[0]}/${new Date().toISOString().split('T')[0]}?apiKey=${polygonApiKey}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    // 市場の活動度を計算（取引量などから）
    const marketActivity = calculateMarketActivity(data)
    const isMarketOpen = isUSMarketOpen()

    return {
      isMarketOpen,
      marketActivity,
      volatility: calculateVolatility(data),
    }
  } catch (error) {
    console.error('Error fetching market data:', error)
    return null
  }
}

function calculateMarketActivity(data: any): number {
  // 簡易的な実装：取引量から活動度を計算
  if (!data.results || data.results.length === 0) {
    return 50 // デフォルト値
  }

  const volumes = data.results.map((r: any) => r.v || 0)
  const avgVolume = volumes.reduce((sum: number, v: number) => sum + v, 0) / volumes.length
  const maxVolume = Math.max(...volumes)

  // 0-100のスコアに変換
  return Math.min(100, Math.round((avgVolume / maxVolume) * 100))
}

function calculateVolatility(data: any): number {
  // 簡易的な実装：価格変動からボラティリティを計算
  if (!data.results || data.results.length < 2) {
    return 50
  }

  const prices = data.results.map((r: any) => r.c || 0)
  const changes = []
  for (let i = 1; i < prices.length; i++) {
    const change = Math.abs((prices[i] - prices[i - 1]) / prices[i - 1])
    changes.push(change)
  }

  const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length
  return Math.min(100, Math.round(avgChange * 10000)) // パーセンテージを100倍
}

function isUSMarketOpen(): boolean {
  const now = new Date()
  const usTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const hour = usTime.getHours()
  const day = usTime.getDay()

  // 米国市場の営業時間: 月-金 9:30-16:00 ET
  if (day === 0 || day === 6) return false // 週末
  if (hour < 9 || hour >= 16) return false // 営業時間外

  return true
}

function adjustTimingsWithMarketData(
  timings: OptimalTiming[],
  marketData: MarketData
): OptimalTiming[] {
  // 市場が開いている時間帯はエンゲージメントが高くなる傾向がある
  // 日本時間で市場が開いている時間帯を特定（ET + 14時間 = JST）
  const adjustedTimings = timings.map((timing) => {
    let adjustedEngagement = timing.predictedEngagement

    // 市場が開いている時間帯の場合は+5点
    if (marketData.isMarketOpen) {
      const usTime = new Date(timing.date)
      usTime.setHours(usTime.getHours() - 14) // JST to ET
      const usHour = usTime.getHours()
      if (usHour >= 9 && usHour < 16) {
        adjustedEngagement += 5
      }
    }

    // 市場の活動度が高い場合は+3点
    if (marketData.marketActivity > 70) {
      adjustedEngagement += 3
    }

    return {
      ...timing,
      predictedEngagement: Math.min(100, adjustedEngagement),
      reason: `${timing.reason}（市場データを考慮）`,
    }
  })

  // 再度ソート
  adjustedTimings.sort((a, b) => b.predictedEngagement - a.predictedEngagement)

  return adjustedTimings
}
