/**
 * 自然さスコア計算ロジック（高度化版）
 * - 複数AI評価平均化
 * - カスタマイズ可能な重み付け
 * - 閾値警告機能
 */

import 'server-only'
import { getAnthropicApiKey, getGrokApiKey } from '../server-only'
import Anthropic from '@anthropic-ai/sdk'

export interface ScoreWeights {
  lengthWeight: number // 文字数スコアの重み (0-1)
  hashtagWeight: number // ハッシュタグスコアの重み (0-1)
  spamWeight: number // スパム指標スコアの重み (0-1)
  readabilityWeight: number // 可読性スコアの重み (0-1)
  aiWeight: number // AI評価スコアの重み (0-1)
}

export interface ScoreConfig {
  weights: ScoreWeights
  threshold: number // 警告閾値 (0-100)
  enableMultiAI: boolean // 複数AI評価平均化を有効化
  aiProviders: ('claude' | 'grok')[] // 使用するAIプロバイダー
}

export interface AdvancedScoreBreakdown {
  factors: {
    lengthScore: number
    hashtagScore: number
    spamIndicatorScore: number
    readabilityScore: number
    aiNaturalnessScore: number
    weightedTotalScore: number // 重み付け後の合計スコア
    totalScore: number // 最終スコア（0-100）
  }
  details: {
    lengthAnalysis: string
    hashtagAnalysis: string
    spamAnalysis: string
    readabilityAnalysis: string
    aiAnalysis: string
    multiAIAnalysis?: string // 複数AI評価の場合
  }
  config: ScoreConfig
  warnings: string[] // 警告メッセージ
}

// デフォルト設定
export const DEFAULT_SCORE_CONFIG: ScoreConfig = {
  weights: {
    lengthWeight: 0.2, // 20%
    hashtagWeight: 0.15, // 15%
    spamWeight: 0.2, // 20%
    readabilityWeight: 0.15, // 15%
    aiWeight: 0.3, // 30%
  },
  threshold: 60, // 60点以下で警告
  enableMultiAI: false,
  aiProviders: ['grok'], // デフォルトはGrokのみ
}

/**
 * 高度化された自然さスコア計算
 */
export async function calculateAdvancedNaturalnessScore(
  text: string,
  hashtags: string[],
  config: Partial<ScoreConfig> = {},
  aiScores?: number[] // 複数AIからのスコア（オプション）
): Promise<AdvancedScoreBreakdown> {
  const finalConfig: ScoreConfig = {
    ...DEFAULT_SCORE_CONFIG,
    ...config,
    weights: {
      ...DEFAULT_SCORE_CONFIG.weights,
      ...config.weights,
    },
  }

  // 1. ルールベーススコア計算（既存ロジックを使用）
  const lengthScore = calculateLengthScore(text)
  const hashtagScore = calculateHashtagScore(hashtags, text)
  const spamIndicatorScore = calculateSpamIndicatorScore(text)
  const readabilityScore = calculateReadabilityScore(text)

  // 2. AI評価スコア（複数AI平均化対応）
  let aiNaturalnessScore = 0
  let aiAnalysis = ''
  let multiAIAnalysis = ''

  if (finalConfig.enableMultiAI && finalConfig.aiProviders.length > 1) {
    // 複数AI評価平均化
    const aiEvaluations = await evaluateWithMultipleAIs(
      text,
      hashtags,
      finalConfig.aiProviders,
      aiScores
    )
    aiNaturalnessScore = aiEvaluations.averageScore
    aiAnalysis = `複数AI評価平均: ${aiNaturalnessScore.toFixed(1)}/30点`
    multiAIAnalysis = aiEvaluations.details
  } else if (aiScores && aiScores.length > 0) {
    // 単一AI評価（提供されたスコアを使用）
    const singleScore = aiScores[0]
    aiNaturalnessScore = Math.min(30, Math.max(0, singleScore * 0.3))
    aiAnalysis = `AI評価: ${singleScore}/100 → ${aiNaturalnessScore.toFixed(1)}/30点に変換`
  } else {
    // AI評価なし（推定）
    aiNaturalnessScore = estimateAIScore(text, hashtags)
    aiAnalysis = `AI評価なし（推定値: ${aiNaturalnessScore.toFixed(1)}/30点）`
  }

  // 3. 重み付けスコア計算
  const weightedScores = {
    length: lengthScore * finalConfig.weights.lengthWeight,
    hashtag: hashtagScore * finalConfig.weights.hashtagWeight,
    spam: spamIndicatorScore * finalConfig.weights.spamWeight,
    readability: readabilityScore * finalConfig.weights.readabilityWeight,
    ai: aiNaturalnessScore * finalConfig.weights.aiWeight,
  }

  const weightedTotalScore = 
    weightedScores.length +
    weightedScores.hashtag +
    weightedScores.spam +
    weightedScores.readability +
    weightedScores.ai

  // 4. 最終スコア（0-100に正規化）
  const totalScore = Math.round(Math.min(100, Math.max(0, weightedTotalScore * (100 / (
    finalConfig.weights.lengthWeight * 20 +
    finalConfig.weights.hashtagWeight * 15 +
    finalConfig.weights.spamWeight * 20 +
    finalConfig.weights.readabilityWeight * 15 +
    finalConfig.weights.aiWeight * 30
  )))))

  // 5. 警告チェック
  const warnings: string[] = []
  if (totalScore < finalConfig.threshold) {
    warnings.push(`自然さスコアが閾値（${finalConfig.threshold}点）を下回っています。スパムリスクが高い可能性があります。`)
  }
  if (spamIndicatorScore < 10) {
    warnings.push('スパム指標が検出されました。内容を確認してください。')
  }
  if (lengthScore < 10) {
    warnings.push('文字数が適切ではありません。')
  }

  return {
    factors: {
      lengthScore,
      hashtagScore,
      spamIndicatorScore,
      readabilityScore,
      aiNaturalnessScore,
      weightedTotalScore,
      totalScore,
    },
    details: {
      lengthAnalysis: analyzeLength(text),
      hashtagAnalysis: analyzeHashtags(hashtags, text),
      spamAnalysis: analyzeSpamIndicators(text),
      readabilityAnalysis: analyzeReadability(text),
      aiAnalysis,
      ...(multiAIAnalysis ? { multiAIAnalysis } : {}),
    },
    config: finalConfig,
    warnings,
  }
}

/**
 * 複数AIで評価して平均化
 */
async function evaluateWithMultipleAIs(
  text: string,
  hashtags: string[],
  providers: ('claude' | 'grok')[],
  existingScores?: number[]
): Promise<{ averageScore: number; details: string }> {
  const scores: number[] = []
  const details: string[] = []

  // 既存のスコアがある場合は使用
  if (existingScores && existingScores.length > 0) {
    scores.push(...existingScores)
    existingScores.forEach((score, i) => {
      details.push(`既存AI評価${i + 1}: ${score}/100`)
    })
  }

  // 各プロバイダーで評価
  for (const provider of providers) {
    try {
      const score = await evaluateWithAI(text, hashtags, provider)
      if (score !== null) {
        scores.push(score)
        details.push(`${provider === 'claude' ? 'Claude' : 'Grok'}評価: ${score}/100`)
      }
    } catch (error) {
      console.error(`[Score Calculator] Error evaluating with ${provider}:`, error)
      details.push(`${provider === 'claude' ? 'Claude' : 'Grok'}評価: エラー（スキップ）`)
    }
  }

  if (scores.length === 0) {
    // 評価が取得できなかった場合は推定値を使用
    const estimated = estimateAIScore(text, hashtags) / 0.3
    return {
      averageScore: estimated * 0.3,
      details: 'AI評価取得失敗（推定値を使用）',
    }
  }

  // 平均を計算
  const average = scores.reduce((sum, s) => sum + s, 0) / scores.length
  const averageScore = Math.min(30, Math.max(0, average * 0.3)) // 30点満点に変換

  return {
    averageScore,
    details: `${details.join('\n')}\n平均: ${average.toFixed(1)}/100 → ${averageScore.toFixed(1)}/30点`,
  }
}

/**
 * 単一AIで評価
 */
async function evaluateWithAI(
  text: string,
  hashtags: string[],
  provider: 'claude' | 'grok'
): Promise<number | null> {
  const evaluationPrompt = `以下のツイートテキストの自然さ（スパムリスクの低さ）を0-100のスコアで評価してください。

テキスト: ${text}
ハッシュタグ: ${hashtags.join(', ')}

評価基準:
- 100点: 完全に自然で価値のある投稿
- 80-99点: 非常に自然で高品質
- 60-79点: 概ね自然だが改善の余地あり
- 40-59点: スパム的要素がやや見られる
- 0-39点: 明らかにスパム的

JSON形式で返答してください:
{
  "score": 0-100の数値,
  "reason": "評価理由（簡潔に）"
}`

  try {
    if (provider === 'claude') {
      const apiKey = getAnthropicApiKey()
      const anthropic = new Anthropic({ apiKey })
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: evaluationPrompt,
          },
        ],
      })

      const content = message.content[0]
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          return parsed.score || null
        }
      }
    } else if (provider === 'grok') {
      const apiKey = getGrokApiKey()
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'grok-beta',
          messages: [
            {
              role: 'user',
              content: evaluationPrompt,
            },
          ],
          temperature: 0.3, // 評価は低い温度で
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const content = data.choices[0]?.message?.content
        if (content) {
          const jsonMatch = content.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            return parsed.score || null
          }
        }
      }
    }
  } catch (error) {
    console.error(`[Score Calculator] Error evaluating with ${provider}:`, error)
  }

  return null
}

// 既存のスコア計算関数をインポート（簡略化のため、実際には既存の関数を再利用）
function calculateLengthScore(text: string): number {
  const length = text.length
  if (length > 280) return 0
  if (length < 10) return 5
  if (length >= 50 && length <= 200) return 20
  if (length >= 30 && length < 50) return 15
  if (length > 200 && length <= 250) return 15
  if (length >= 250 && length <= 280) return 10
  return 10
}

function calculateHashtagScore(hashtags: string[], text: string): number {
  const textHashtags = (text.match(/#\w+/g) || []).length
  const totalHashtags = hashtags.length + textHashtags
  if (totalHashtags === 0) return 10
  if (totalHashtags >= 3 && totalHashtags <= 5) return 15
  if (totalHashtags === 1 || totalHashtags === 2) return 12
  if (totalHashtags >= 6 && totalHashtags <= 8) return 8
  if (totalHashtags > 8) return 5
  return 10
}

function calculateSpamIndicatorScore(text: string): number {
  let score = 20
  const spamPatterns = [
    /(今すぐ|すぐに|今だけ|限定|無料|0円|激安|格安)/gi,
    /(フォロー|いいね|RT|リツイート).*(お願い|してください|して)/gi,
    /(クリック|リンク|URL).*(こちら|ここ)/gi,
    /(当選|プレゼント|抽選|キャンペーン)/gi,
    /(【|】)/g,
  ]
  for (const pattern of spamPatterns) {
    const matches = text.match(pattern)
    if (matches) {
      score -= matches.length * 3
    }
  }
  const excessiveEmojis = (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length > 10
  const excessiveExclamation = (text.match(/!/g) || []).length > 3
  const excessiveQuestion = (text.match(/\?/g) || []).length > 3
  if (excessiveEmojis) score -= 5
  if (excessiveExclamation) score -= 3
  if (excessiveQuestion) score -= 3
  return Math.max(0, score)
}

function calculateReadabilityScore(text: string): number {
  let score = 15
  const hasLineBreaks = text.includes('\n') || text.includes('\\n')
  if (!hasLineBreaks && text.length > 100) score -= 3
  const punctuationCount = (text.match(/[。、！？]/g) || []).length
  const sentenceCount = (text.match(/[。！？]/g) || []).length
  if (sentenceCount > 0 && punctuationCount / sentenceCount < 0.5) score -= 2
  const sentences = text.split(/[。！？]/)
  const longSentences = sentences.filter(s => s.length > 100).length
  if (longSentences > 0) score -= longSentences * 2
  return Math.max(0, score)
}

function estimateAIScore(text: string, hashtags: string[]): number {
  let baseScore = 20
  if (text.length >= 50 && text.length <= 200) baseScore += 5
  if (text.length < 30 || text.length > 250) baseScore -= 5
  if (hashtags.length >= 3 && hashtags.length <= 5) baseScore += 3
  if (hashtags.length > 8) baseScore -= 3
  return Math.min(30, Math.max(0, baseScore))
}

function analyzeLength(text: string): string {
  const length = text.length
  if (length > 280) return `文字数超過（${length}文字）: 280文字以内に収めてください`
  if (length < 10) return `文字数不足（${length}文字）: もう少し詳しく書いてください`
  if (length >= 50 && length <= 200) return `最適な文字数（${length}文字）: 読みやすく、情報量も適切です`
  return `文字数: ${length}文字（280文字以内）`
}

function analyzeHashtags(hashtags: string[], text: string): string {
  const textHashtags = (text.match(/#\w+/g) || []).length
  const total = hashtags.length + textHashtags
  if (total === 0) return 'ハッシュタグなし'
  if (total >= 3 && total <= 5) return `ハッシュタグ数: ${total}個（最適）`
  if (total > 5) return `ハッシュタグ数: ${total}個（やや多い）`
  return `ハッシュタグ数: ${total}個`
}

function analyzeSpamIndicators(text: string): string {
  const issues: string[] = []
  const spamPatterns = [
    { pattern: /(今すぐ|すぐに|今だけ|限定|無料|0円|激安|格安)/gi, name: '過度な宣伝表現' },
    { pattern: /(フォロー|いいね|RT|リツイート).*(お願い|してください|して)/gi, name: 'エンゲージメント誘導' },
    { pattern: /(クリック|リンク|URL).*(こちら|ここ)/gi, name: 'リンク誘導' },
  ]
  for (const { pattern, name } of spamPatterns) {
    if (pattern.test(text)) {
      issues.push(name)
    }
  }
  const emojiCount = (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length
  if (emojiCount > 10) issues.push('絵文字過多')
  if (issues.length === 0) {
    return 'スパム指標なし: 自然な表現です'
  }
  return `検出された問題: ${issues.join(', ')}`
}

function analyzeReadability(text: string): string {
  const hasLineBreaks = text.includes('\n') || text.includes('\\n')
  const punctuationCount = (text.match(/[。、！？]/g) || []).length
  const issues: string[] = []
  if (!hasLineBreaks && text.length > 100) {
    issues.push('改行が少ない')
  }
  if (punctuationCount < 2) {
    issues.push('句読点が少ない')
  }
  if (issues.length === 0) {
    return '可読性: 良好'
  }
  return `可読性の改善点: ${issues.join(', ')}`
}
