/**
 * エンゲージメント予測の型定義
 * クライアント/サーバー両方で使用可能
 */

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
