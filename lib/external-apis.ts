/**
 * 外部API連携モジュール
 * Polygon、その他の外部データソースとの連携
 */

import 'server-only'

export interface ExternalDataConfig {
  polygonEnabled: boolean
  polygonApiKey?: string
  newsApiEnabled: boolean
  newsApiKey?: string
  twitterTrendsEnabled: boolean
}

export interface MarketInsight {
  marketStatus: 'open' | 'closed' | 'pre-market' | 'after-hours'
  activityLevel: number // 0-100
  trendingStocks?: string[]
  marketSentiment?: 'bullish' | 'bearish' | 'neutral'
  volatility: number // 0-100
}

export interface NewsInsight {
  trendingTopics: string[]
  breakingNews?: string[]
  categoryTrends: Record<string, number> // カテゴリ別のトレンド度
}

/**
 * Polygon APIから市場データを取得
 */
export async function fetchPolygonMarketData(
  apiKey: string
): Promise<MarketInsight | null> {
  try {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 86400000) // 24時間前

    // S&P 500のデータを取得
    const response = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/SPY/range/1/hour/${yesterday.toISOString().split('T')[0]}/${now.toISOString().split('T')[0]}?apiKey=${apiKey}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error('Polygon API error:', response.statusText)
      return null
    }

    const data = await response.json()

    if (!data.results || data.results.length === 0) {
      return null
    }

    // 市場の活動度を計算
    const volumes = data.results.map((r: any) => r.v || 0)
    const avgVolume = volumes.reduce((sum: number, v: number) => sum + v, 0) / volumes.length
    const maxVolume = Math.max(...volumes)
    const activityLevel = Math.min(100, Math.round((avgVolume / maxVolume) * 100))

    // ボラティリティを計算
    const prices = data.results.map((r: any) => r.c || 0)
    const changes = []
    for (let i = 1; i < prices.length; i++) {
      const change = Math.abs((prices[i] - prices[i - 1]) / prices[i - 1])
      changes.push(change)
    }
    const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length
    const volatility = Math.min(100, Math.round(avgChange * 10000))

    // 市場センチメントを判定
    const latestPrice = prices[prices.length - 1]
    const firstPrice = prices[0]
    const priceChange = (latestPrice - firstPrice) / firstPrice
    let marketSentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral'
    if (priceChange > 0.01) {
      marketSentiment = 'bullish'
    } else if (priceChange < -0.01) {
      marketSentiment = 'bearish'
    }

    // 市場の状態を判定
    const usTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const hour = usTime.getHours()
    const day = usTime.getDay()
    let marketStatus: 'open' | 'closed' | 'pre-market' | 'after-hours' = 'closed'
    
    if (day >= 1 && day <= 5) {
      if (hour >= 9 && hour < 16) {
        marketStatus = 'open'
      } else if (hour >= 4 && hour < 9) {
        marketStatus = 'pre-market'
      } else if (hour >= 16 && hour < 20) {
        marketStatus = 'after-hours'
      }
    }

    return {
      marketStatus,
      activityLevel,
      marketSentiment,
      volatility,
    }
  } catch (error) {
    console.error('Error fetching Polygon market data:', error)
    return null
  }
}

/**
 * News APIからトレンドニュースを取得
 */
export async function fetchNewsTrends(
  apiKey: string,
  country: string = 'jp'
): Promise<NewsInsight | null> {
  try {
    const response = await fetch(
      `https://newsapi.org/v2/top-headlines?country=${country}&apiKey=${apiKey}&pageSize=20`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error('News API error:', response.statusText)
      return null
    }

    const data = await response.json()

    if (!data.articles || data.articles.length === 0) {
      return null
    }

    // トレンドトピックを抽出
    const trendingTopics = data.articles
      .slice(0, 10)
      .map((article: any) => article.title)
      .filter((title: string) => title && title.length > 0)

    // カテゴリ別のトレンド度を計算
    const categoryTrends: Record<string, number> = {}
    data.articles.forEach((article: any) => {
      const category = article.category || 'general'
      categoryTrends[category] = (categoryTrends[category] || 0) + 1
    })

    // 重要度でソート
    const sortedCategories = Object.entries(categoryTrends)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .reduce((acc, [key, value]) => {
        acc[key] = value
        return acc
      }, {} as Record<string, number>)

    return {
      trendingTopics,
      categoryTrends: sortedCategories,
    }
  } catch (error) {
    console.error('Error fetching news trends:', error)
    return null
  }
}

/**
 * 外部データを統合して投稿タイミングの最適化に活用
 */
export async function getExternalInsights(
  config: ExternalDataConfig
): Promise<{
  marketInsight?: MarketInsight
  newsInsight?: NewsInsight
  recommendations: string[]
}> {
  const recommendations: string[] = []

  let marketInsight: MarketInsight | null = null
  if (config.polygonEnabled && config.polygonApiKey) {
    marketInsight = await fetchPolygonMarketData(config.polygonApiKey)
    if (marketInsight) {
      if (marketInsight.marketStatus === 'open' && marketInsight.activityLevel > 70) {
        recommendations.push(
          '市場が活発な時間帯です。金融・経済関連の投稿に最適なタイミングです'
        )
      }
      if (marketInsight.marketSentiment === 'bullish') {
        recommendations.push('市場センチメントが強気です。ポジティブな投稿が効果的です')
      }
    }
  }

  let newsInsight: NewsInsight | null = null
  if (config.newsApiEnabled && config.newsApiKey) {
    newsInsight = await fetchNewsTrends(config.newsApiKey)
    if (newsInsight && newsInsight.trendingTopics.length > 0) {
      recommendations.push(
        `現在のトレンドトピック: ${newsInsight.trendingTopics.slice(0, 3).join(', ')}`
      )
    }
  }

  return {
    marketInsight: marketInsight || undefined,
    newsInsight: newsInsight || undefined,
    recommendations,
  }
}
