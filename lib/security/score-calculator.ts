/**
 * 自然さスコア計算ロジック（透明化）
 * AIバイアスを排除し、ルールベース + AI評価のハイブリッド方式
 */

import 'server-only'

export interface ScoreFactors {
  // ルールベース指標（客観的）
  lengthScore: number // 文字数適切性 (0-20)
  hashtagScore: number // ハッシュタグ適切性 (0-15)
  spamIndicatorScore: number // スパム指標チェック (0-20)
  readabilityScore: number // 可読性 (0-15)
  
  // AI評価（主観的だが透明化）
  aiNaturalnessScore: number // AI評価 (0-30)
  
  // 合計スコア
  totalScore: number // 0-100
}

export interface ScoreBreakdown {
  factors: ScoreFactors
  details: {
    lengthAnalysis: string
    hashtagAnalysis: string
    spamAnalysis: string
    readabilityAnalysis: string
    aiAnalysis: string
  }
}

/**
 * 自然さスコアを計算（透明化されたロジック）
 */
export function calculateNaturalnessScore(
  text: string,
  hashtags: string[],
  aiScore?: number // AIが提供したスコア（オプション）
): ScoreBreakdown {
  // 1. 文字数スコア (0-20点)
  const lengthScore = calculateLengthScore(text)
  const lengthAnalysis = analyzeLength(text)

  // 2. ハッシュタグスコア (0-15点)
  const hashtagScore = calculateHashtagScore(hashtags, text)
  const hashtagAnalysis = analyzeHashtags(hashtags, text)

  // 3. スパム指標スコア (0-20点)
  const spamIndicatorScore = calculateSpamIndicatorScore(text)
  const spamAnalysis = analyzeSpamIndicators(text)

  // 4. 可読性スコア (0-15点)
  const readabilityScore = calculateReadabilityScore(text)
  const readabilityAnalysis = analyzeReadability(text)

  // 5. AI評価スコア (0-30点) - AIが提供した場合は使用、なければ推定
  const aiNaturalnessScore = aiScore !== undefined 
    ? Math.min(30, Math.max(0, aiScore * 0.3)) // AIスコアを30点満点に変換
    : estimateAIScore(text, hashtags) // AIスコアがない場合は推定
  const aiAnalysis = aiScore !== undefined
    ? `AI評価: ${aiScore}/100 → ${aiNaturalnessScore.toFixed(1)}/30点に変換`
    : `AI評価なし（推定値: ${aiNaturalnessScore.toFixed(1)}/30点）`

  const totalScore = Math.round(
    lengthScore + hashtagScore + spamIndicatorScore + readabilityScore + aiNaturalnessScore
  )

  return {
    factors: {
      lengthScore,
      hashtagScore,
      spamIndicatorScore,
      readabilityScore,
      aiNaturalnessScore,
      totalScore,
    },
    details: {
      lengthAnalysis,
      hashtagAnalysis,
      spamAnalysis,
      readabilityAnalysis,
      aiAnalysis,
    },
  }
}

/**
 * 文字数スコア (0-20点)
 * 280文字以内で、適切な長さ（50-200文字）を推奨
 */
function calculateLengthScore(text: string): number {
  const length = text.length
  
  if (length > 280) return 0 // 280文字超過は0点
  if (length < 10) return 5 // 短すぎる
  if (length >= 50 && length <= 200) return 20 // 最適範囲
  if (length >= 30 && length < 50) return 15 // やや短い
  if (length > 200 && length <= 250) return 15 // やや長い
  if (length >= 250 && length <= 280) return 10 // 長いが許容範囲
  return 10 // その他
}

function analyzeLength(text: string): string {
  const length = text.length
  if (length > 280) {
    return `文字数超過（${length}文字）: 280文字以内に収めてください`
  }
  if (length < 10) {
    return `文字数不足（${length}文字）: もう少し詳しく書いてください`
  }
  if (length >= 50 && length <= 200) {
    return `最適な文字数（${length}文字）: 読みやすく、情報量も適切です`
  }
  return `文字数: ${length}文字（280文字以内）`
}

/**
 * ハッシュタグスコア (0-15点)
 * 3-5個が最適、過多は減点
 */
function calculateHashtagScore(hashtags: string[], text: string): number {
  const hashtagCount = hashtags.length
  const textHashtags = (text.match(/#\w+/g) || []).length
  
  // テキスト内のハッシュタグもカウント
  const totalHashtags = hashtags.length + textHashtags

  if (totalHashtags === 0) return 10 // ハッシュタグなしでもOK
  if (totalHashtags >= 3 && totalHashtags <= 5) return 15 // 最適
  if (totalHashtags === 1 || totalHashtags === 2) return 12 // やや少ない
  if (totalHashtags >= 6 && totalHashtags <= 8) return 8 // やや多い
  if (totalHashtags > 8) return 5 // 多すぎる
  return 10
}

function analyzeHashtags(hashtags: string[], text: string): string {
  const textHashtags = (text.match(/#\w+/g) || []).length
  const total = hashtags.length + textHashtags
  
  if (total === 0) return 'ハッシュタグなし'
  if (total >= 3 && total <= 5) return `ハッシュタグ数: ${total}個（最適）`
  if (total > 5) return `ハッシュタグ数: ${total}個（やや多い）`
  return `ハッシュタグ数: ${total}個`
}

/**
 * スパム指標スコア (0-20点)
 * スパム的な表現を検出
 */
function calculateSpamIndicatorScore(text: string): number {
  let score = 20 // 満点から開始
  
  // スパム指標パターン
  const spamPatterns = [
    /(今すぐ|すぐに|今だけ|限定|無料|0円|激安|格安)/gi, // 過度な宣伝表現
    /(フォロー|いいね|RT|リツイート).*(お願い|してください|して)/gi, // エンゲージメント誘導
    /(クリック|リンク|URL).*(こちら|ここ)/gi, // リンク誘導
    /(当選|プレゼント|抽選|キャンペーン)/gi, // キャンペーン系
    /(【|】)/g, // 過度な見出し記号（1-2個はOK）
  ]
  
  const excessiveEmojis = (text.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length > 10 // 絵文字多すぎ
  const excessiveExclamation = (text.match(/!/g) || []).length > 3 // 感嘆符多すぎ
  const excessiveQuestion = (text.match(/\?/g) || []).length > 3 // 疑問符多すぎ
  
  // スパムパターンの検出
  for (const pattern of spamPatterns) {
    const matches = text.match(pattern)
    if (matches) {
      score -= matches.length * 3 // 1つにつき3点減点
    }
  }
  
  // 過度な記号・絵文字の減点
  if (excessiveEmojis) score -= 5
  if (excessiveExclamation) score -= 3
  if (excessiveQuestion) score -= 3
  
  return Math.max(0, score)
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

/**
 * 可読性スコア (0-15点)
 * 改行、句読点、構造の適切性
 */
function calculateReadabilityScore(text: string): number {
  let score = 15
  
  // 改行の有無
  const hasLineBreaks = text.includes('\n') || text.includes('\\n')
  if (!hasLineBreaks && text.length > 100) score -= 3 // 長文で改行なしは減点
  
  // 句読点の適切性
  const punctuationCount = (text.match(/[。、！？]/g) || []).length
  const sentenceCount = (text.match(/[。！？]/g) || []).length
  if (sentenceCount > 0 && punctuationCount / sentenceCount < 0.5) score -= 2 // 句読点が少ない
  
  // 長すぎる文（100文字以上）
  const sentences = text.split(/[。！？]/)
  const longSentences = sentences.filter(s => s.length > 100).length
  if (longSentences > 0) score -= longSentences * 2
  
  return Math.max(0, score)
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

/**
 * AIスコアの推定（AIスコアがない場合）
 */
function estimateAIScore(text: string, hashtags: string[]): number {
  // 簡易的な推定（実際のAI評価がない場合のフォールバック）
  // 実際のAI評価がある場合は、その値を使用する
  let baseScore = 20 // ベーススコア
  
  // 文字数による調整
  if (text.length >= 50 && text.length <= 200) baseScore += 5
  if (text.length < 30 || text.length > 250) baseScore -= 5
  
  // ハッシュタグによる調整
  if (hashtags.length >= 3 && hashtags.length <= 5) baseScore += 3
  if (hashtags.length > 8) baseScore -= 3
  
  return Math.min(30, Math.max(0, baseScore))
}
