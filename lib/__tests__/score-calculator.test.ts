import { calculateNaturalnessScore } from '../security/score-calculator'

describe('calculateNaturalnessScore', () => {
  it('calculates high score for natural text', () => {
    const text = '今日は良い天気ですね。散歩に行きました。'
    const hashtags = ['天気', '散歩']
    
    const result = calculateNaturalnessScore(text, hashtags, 90)
    
    expect(result.factors.totalScore).toBeGreaterThan(70)
    expect(result.factors.lengthScore).toBeGreaterThan(15)
    expect(result.factors.hashtagScore).toBeGreaterThan(10)
  })

  it('calculates low score for spam-like text', () => {
    const text = '無料無料無料！今すぐクリック！限定セール！'
    const hashtags = ['無料', 'セール', '限定', '今すぐ', 'クリック', 'お得']
    
    const result = calculateNaturalnessScore(text, hashtags)
    
    expect(result.factors.totalScore).toBeLessThan(50)
    expect(result.factors.spamIndicatorScore).toBeLessThan(10)
  })

  it('penalizes excessive hashtags', () => {
    const text = 'テストツイート'
    const hashtags = ['ハッシュタグ1', 'ハッシュタグ2', 'ハッシュタグ3', 'ハッシュタグ4', 'ハッシュタグ5', 'ハッシュタグ6', 'ハッシュタグ7', 'ハッシュタグ8']
    
    const result = calculateNaturalnessScore(text, hashtags)
    
    expect(result.factors.hashtagScore).toBeLessThan(10)
  })

  it('rewards appropriate text length', () => {
    const text = 'これは適切な長さのツイートです。280文字以内で、読みやすく、自然な文章になっています。'
    const hashtags = ['テスト']
    
    const result = calculateNaturalnessScore(text, hashtags)
    
    expect(result.factors.lengthScore).toBeGreaterThan(15)
  })

  it('penalizes very short text', () => {
    const text = '短い'
    const hashtags: string[] = []
    
    const result = calculateNaturalnessScore(text, hashtags)
    
    expect(result.factors.lengthScore).toBeLessThan(10)
  })

  it('penalizes very long text', () => {
    const text = 'あ'.repeat(300) // 300文字の長いテキスト
    const hashtags: string[] = []
    
    const result = calculateNaturalnessScore(text, hashtags)
    
    expect(result.factors.lengthScore).toBeLessThan(15)
  })

  it('detects spam indicators', () => {
    const text = '今すぐ無料で登録！限定セール！お得な情報！'
    const hashtags: string[] = []
    
    const result = calculateNaturalnessScore(text, hashtags)
    
    expect(result.factors.spamIndicatorScore).toBeLessThan(10)
    expect(result.details.spamAnalysis).toContain('スパム')
  })

  it('calculates readability score', () => {
    const text = 'これは読みやすい文章です。適切な句読点と改行があります。'
    const hashtags: string[] = []
    
    const result = calculateNaturalnessScore(text, hashtags)
    
    expect(result.factors.readabilityScore).toBeGreaterThan(10)
  })

  it('uses AI score when provided', () => {
    const text = 'テストツイート'
    const hashtags = ['テスト']
    const aiScore = 85
    
    const result = calculateNaturalnessScore(text, hashtags, aiScore)
    
    // AIスコアは0-30の範囲に変換される
    expect(result.factors.aiNaturalnessScore).toBeGreaterThan(20)
    expect(result.factors.aiNaturalnessScore).toBeLessThanOrEqual(30)
  })

  it('estimates AI score when not provided', () => {
    const text = 'テストツイート'
    const hashtags = ['テスト']
    
    const result = calculateNaturalnessScore(text, hashtags)
    
    // AIスコアが推定される
    expect(result.factors.aiNaturalnessScore).toBeGreaterThan(0)
    expect(result.factors.aiNaturalnessScore).toBeLessThanOrEqual(30)
  })

  it('provides detailed breakdown', () => {
    const text = 'これはテストツイートです。'
    const hashtags = ['テスト']
    
    const result = calculateNaturalnessScore(text, hashtags)
    
    expect(result.details).toHaveProperty('lengthAnalysis')
    expect(result.details).toHaveProperty('hashtagAnalysis')
    expect(result.details).toHaveProperty('spamAnalysis')
    expect(result.details).toHaveProperty('readabilityAnalysis')
    expect(result.details).toHaveProperty('aiAnalysis')
  })

  it('handles empty text', () => {
    const text = ''
    const hashtags: string[] = []
    
    const result = calculateNaturalnessScore(text, hashtags)
    
    expect(result.factors.totalScore).toBeLessThan(30)
    expect(result.factors.lengthScore).toBe(0)
  })

  it('handles empty hashtags', () => {
    const text = 'ハッシュタグなしのツイート'
    const hashtags: string[] = []
    
    const result = calculateNaturalnessScore(text, hashtags)
    
    expect(result.factors.hashtagScore).toBeGreaterThan(0) // ハッシュタグなしは減点されない
  })

  it('calculates total score correctly', () => {
    const text = '適切な長さの自然なツイートです。'
    const hashtags = ['テスト', 'ツイート']
    
    const result = calculateNaturalnessScore(text, hashtags, 80)
    
    const expectedTotal = 
      result.factors.lengthScore +
      result.factors.hashtagScore +
      result.factors.spamIndicatorScore +
      result.factors.readabilityScore +
      result.factors.aiNaturalnessScore
    
    expect(result.factors.totalScore).toBe(expectedTotal)
    expect(result.factors.totalScore).toBeLessThanOrEqual(100)
    expect(result.factors.totalScore).toBeGreaterThanOrEqual(0)
  })
})
