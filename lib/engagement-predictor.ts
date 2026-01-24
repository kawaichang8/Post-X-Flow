/**
 * エンゲージメント予測モジュール
 * シンプル回帰モデルまたはGrok APIを使用してエンゲージメントを予測
 */

import 'server-only'
import { getGrokApiKey, getAnthropicApiKey } from './server-only'

export interface EngagementFeatures {
  text: string
  hashtags: string[]
  naturalnessScore: number
  textLength: number
  hashtagCount: number
  hasQuestion: boolean
  hasEmoji: boolean
  hasNumber: boolean
  formatType?: string
  hourOfDay?: number // 投稿時刻（0-23）
  dayOfWeek?: number // 曜日（0=日曜日）
  historicalAvgEngagement?: number // 過去の平均エンゲージメント
}

export interface EngagementPrediction {
  predictedEngagement: number // 予測エンゲージメントスコア
  confidence: number // 信頼度（0-1）
  factors: {
    textQuality: number // テキスト品質スコア
    timingScore: number // タイミングスコア
    hashtagScore: number // ハッシュタグスコア
    formatScore: number // フォーマットスコア
  }
  method: 'regression' | 'ai' | 'hybrid' // 使用した予測方法
  breakdown?: string // AI予測の場合の詳細説明
}

/**
 * シンプル回帰モデルによるエンゲージメント予測
 */
export function predictEngagementWithRegression(
  features: EngagementFeatures
): EngagementPrediction {
  // 重み付け係数（過去のデータから学習した値、または経験則）
  const weights = {
    textQuality: 0.3, // テキスト品質の重み
    timingScore: 0.25, // タイミングの重み
    hashtagScore: 0.2, // ハッシュタグの重み
    formatScore: 0.15, // フォーマットの重み
    historical: 0.1, // 過去データの重み
  }

  // 1. テキスト品質スコア（0-100）
  const textQuality = calculateTextQualityScore(features)

  // 2. タイミングスコア（0-100）
  const timingScore = calculateTimingScore(features.hourOfDay, features.dayOfWeek)

  // 3. ハッシュタグスコア（0-100）
  const hashtagScore = calculateHashtagScore(features.hashtagCount, features.textLength)

  // 4. フォーマットスコア（0-100）
  const formatScore = calculateFormatScore(features)

  // 5. 過去データの影響
  const historicalScore = features.historicalAvgEngagement 
    ? Math.min(100, features.historicalAvgEngagement * 0.1) 
    : 50 // デフォルト値

  // 重み付け合計
  const predictedEngagement = Math.round(
    textQuality * weights.textQuality +
    timingScore * weights.timingScore +
    hashtagScore * weights.hashtagScore +
    formatScore * weights.formatScore +
    historicalScore * weights.historical
  )

  // 信頼度の計算（データが揃っているほど高い）
  const confidence = calculateConfidence(features)

  return {
    predictedEngagement: Math.max(0, Math.min(100, predictedEngagement)),
    confidence,
    factors: {
      textQuality,
      timingScore,
      hashtagScore,
      formatScore,
    },
    method: 'regression',
  }
}

/**
 * Grok APIを使用したAI予測
 */
export async function predictEngagementWithAI(
  features: EngagementFeatures,
  historicalData?: Array<{
    text: string
    engagement: number
    postedAt: string
  }>
): Promise<EngagementPrediction> {
  try {
    const grokApiKey = getGrokApiKey()
    
    // Grok APIを使用（OpenAI互換）
    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({
      apiKey: grokApiKey,
      baseURL: 'https://api.x.ai/v1',
    })

    // 過去データのサマリー
    const historicalSummary = historicalData && historicalData.length > 0
      ? `過去の投稿データ:
${historicalData.slice(0, 10).map((d, i) => 
  `${i + 1}. エンゲージメント: ${d.engagement}, 投稿時刻: ${new Date(d.postedAt).toLocaleString('ja-JP')}`
).join('\n')}
平均エンゲージメント: ${historicalData.reduce((sum, d) => sum + d.engagement, 0) / historicalData.length}`
      : '過去の投稿データなし'

    const prompt = `以下のX投稿のエンゲージメント（いいね、リツイート、返信、引用ツイートの合計）を予測してください。

【投稿内容】
${features.text}

【特徴】
- 文字数: ${features.textLength}
- ハッシュタグ数: ${features.hashtagCount}
- ハッシュタグ: ${features.hashtags.join(', ')}
- 自然さスコア: ${features.naturalnessScore}/100
- 質問を含む: ${features.hasQuestion ? 'はい' : 'いいえ'}
- 絵文字を含む: ${features.hasEmoji ? 'はい' : 'いいえ'}
- 数字を含む: ${features.hasNumber ? 'はい' : 'いいえ'}
- フォーマットタイプ: ${features.formatType || '標準'}
${features.hourOfDay !== undefined ? `- 投稿時刻: ${features.hourOfDay}時` : ''}
${features.dayOfWeek !== undefined ? `- 曜日: ${['日', '月', '火', '水', '木', '金', '土'][features.dayOfWeek]}` : ''}

${historicalSummary}

【出力形式（JSON）】
{
  "predictedEngagement": 0-100の数値（予測エンゲージメントスコア）,
  "confidence": 0-1の数値（信頼度）,
  "factors": {
    "textQuality": 0-100（テキスト品質スコア）,
    "timingScore": 0-100（タイミングスコア）,
    "hashtagScore": 0-100（ハッシュタグスコア）,
    "formatScore": 0-100（フォーマットスコア）
  },
  "breakdown": "予測の根拠と改善提案（日本語で）"
}

【注意】
- エンゲージメントスコアは0-100の範囲で予測してください
- 過去のデータがある場合は、それを参考にしてください
- タイミングが指定されている場合は、その時刻の効果を考慮してください
- 具体的で実用的な改善提案を含めてください`

    const response = await openai.chat.completions.create({
      model: 'grok-4.1-fast',
      messages: [
        {
          role: 'system',
          content: 'あなたはX（Twitter）のエンゲージメント分析の専門家です。過去のデータと投稿内容を分析して、正確なエンゲージメント予測を行います。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // より一貫性のある予測のため
      max_tokens: 1000,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('AIからの応答がありません')
    }

    // JSONを抽出
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AI応答からJSONが見つかりません')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      predictedEngagement: Math.max(0, Math.min(100, parsed.predictedEngagement || 50)),
      confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
      factors: {
        textQuality: parsed.factors?.textQuality || 50,
        timingScore: parsed.factors?.timingScore || 50,
        hashtagScore: parsed.factors?.hashtagScore || 50,
        formatScore: parsed.factors?.formatScore || 50,
      },
      method: 'ai',
      breakdown: parsed.breakdown,
    }
  } catch (error) {
    console.error('Error predicting engagement with AI:', error)
    // AI予測に失敗した場合は回帰モデルにフォールバック
    return predictEngagementWithRegression(features)
  }
}

/**
 * ハイブリッド予測（回帰 + AI）
 */
export async function predictEngagementHybrid(
  features: EngagementFeatures,
  historicalData?: Array<{
    text: string
    engagement: number
    postedAt: string
  }>,
  useAI: boolean = true
): Promise<EngagementPrediction> {
  // 回帰モデルで予測
  const regressionPrediction = predictEngagementWithRegression(features)

  if (!useAI) {
    return regressionPrediction
  }

  try {
    // AIで予測
    const aiPrediction = await predictEngagementWithAI(features, historicalData)

    // 重み付け平均（AI: 60%, 回帰: 40%）
    const hybridEngagement = Math.round(
      aiPrediction.predictedEngagement * 0.6 + regressionPrediction.predictedEngagement * 0.4
    )

    // 信頼度は両方の平均
    const hybridConfidence = (aiPrediction.confidence + regressionPrediction.confidence) / 2

    return {
      predictedEngagement: Math.max(0, Math.min(100, hybridEngagement)),
      confidence: hybridConfidence,
      factors: {
        textQuality: Math.round(
          (aiPrediction.factors.textQuality + regressionPrediction.factors.textQuality) / 2
        ),
        timingScore: Math.round(
          (aiPrediction.factors.timingScore + regressionPrediction.factors.timingScore) / 2
        ),
        hashtagScore: Math.round(
          (aiPrediction.factors.hashtagScore + regressionPrediction.factors.hashtagScore) / 2
        ),
        formatScore: Math.round(
          (aiPrediction.factors.formatScore + regressionPrediction.factors.formatScore) / 2
        ),
      },
      method: 'hybrid', // ハイブリッド予測
      breakdown: aiPrediction.breakdown,
    }
  } catch (error) {
    console.error('Error in hybrid prediction, falling back to regression:', error)
    return regressionPrediction
  }
}

// ヘルパー関数

function calculateTextQualityScore(features: EngagementFeatures): number {
  let score = 50 // ベーススコア

  // 自然さスコアの影響
  score += (features.naturalnessScore - 50) * 0.4

  // 質問を含む場合は+10
  if (features.hasQuestion) score += 10

  // 絵文字を含む場合は+5
  if (features.hasEmoji) score += 5

  // 数字を含む場合は+5
  if (features.hasNumber) score += 5

  // 文字数が適切な範囲（50-200文字）の場合は+10
  if (features.textLength >= 50 && features.textLength <= 200) {
    score += 10
  } else if (features.textLength < 30) {
    score -= 10 // 短すぎる場合は減点
  }

  return Math.max(0, Math.min(100, score))
}

function calculateTimingScore(hourOfDay?: number, dayOfWeek?: number): number {
  if (hourOfDay === undefined) return 50 // デフォルト値

  // 最適な投稿時刻（日本時間）
  // 朝: 7-9時（+20点）
  // 昼: 12-14時（+25点）
  // 夕方: 18-20時（+30点）
  // 夜: 21-23時（+15点）
  let score = 50

  if (hourOfDay >= 7 && hourOfDay <= 9) {
    score += 20
  } else if (hourOfDay >= 12 && hourOfDay <= 14) {
    score += 25
  } else if (hourOfDay >= 18 && hourOfDay <= 20) {
    score += 30
  } else if (hourOfDay >= 21 && hourOfDay <= 23) {
    score += 15
  } else if (hourOfDay >= 0 && hourOfDay <= 6) {
    score -= 20 // 深夜は減点
  }

  // 曜日の影響（平日の方が良い）
  if (dayOfWeek !== undefined) {
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      score += 10 // 平日
    } else {
      score -= 5 // 週末
    }
  }

  return Math.max(0, Math.min(100, score))
}

function calculateHashtagScore(hashtagCount: number, textLength: number): number {
  // 最適なハッシュタグ数: 3-5個
  if (hashtagCount >= 3 && hashtagCount <= 5) {
    return 100
  } else if (hashtagCount === 0) {
    return 30 // ハッシュタグなしは減点
  } else if (hashtagCount === 1 || hashtagCount === 2) {
    return 70
  } else if (hashtagCount >= 6 && hashtagCount <= 8) {
    return 60 // 多すぎる
  } else {
    return 20 // 非常に多い
  }
}

function calculateFormatScore(features: EngagementFeatures): number {
  let score = 50

  // フォーマットタイプによる加点
  const formatScores: Record<string, number> = {
    '見出し型': 80,
    '質問型': 85,
    'リスト型': 75,
    'ストーリー型': 70,
  }

  if (features.formatType && formatScores[features.formatType]) {
    score = formatScores[features.formatType]
  }

  return score
}

function calculateConfidence(features: EngagementFeatures): number {
  let confidence = 0.5 // ベース信頼度

  // データが揃っているほど信頼度が高い
  if (features.hourOfDay !== undefined) confidence += 0.1
  if (features.dayOfWeek !== undefined) confidence += 0.1
  if (features.historicalAvgEngagement !== undefined) confidence += 0.2
  if (features.formatType) confidence += 0.1

  return Math.max(0, Math.min(1, confidence))
}
