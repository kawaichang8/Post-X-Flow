import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { classifyError, retryWithBackoff, logErrorToSentry, AppError } from './error-handler'
import { getAnthropicApiKey, getGrokApiKey } from './server-only'
import { calculateNaturalnessScore, ScoreBreakdown } from './security/score-calculator'
import { calculateAdvancedNaturalnessScore, AdvancedScoreBreakdown, ScoreConfig, DEFAULT_SCORE_CONFIG } from './security/score-calculator-advanced'
import { logApiKeyAccess } from './security/audit-log'

export interface PostDraft {
  text: string
  naturalnessScore: number
  hashtags: string[]
  formatType?: string // フォーマットタイプ（見出し型、質問型、リスト型など）
  scoreBreakdown?: ScoreBreakdown | AdvancedScoreBreakdown // スコア計算の詳細（オプション）
}

export interface GeneratePostsParams {
  trend: string
  purpose: string
  aiProvider?: 'grok' | 'claude' // デフォルト: 'grok'
  enableHumor?: boolean // ユーモア注入オプション（Grok専用）
  enableRealtimeKnowledge?: boolean // リアルタイム知識挿入（Grok専用）
  realtimeTrends?: string[] // 最新トレンド情報（オプション）
  scoreConfig?: Partial<ScoreConfig> // スコア計算設定（オプション）
  /** RAG: user's recent posts for coherent theme/intro flow */
  pastPostsContext?: string
}

export interface FactCheckResult {
  score: number // 0-100
  suggestions: string[]
}

// Claude API implementation
// API key is loaded securely via server-only module
let anthropicInstance: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicInstance) {
    anthropicInstance = new Anthropic({
      apiKey: getAnthropicApiKey(),
    })
  }
  return anthropicInstance
}

const PROMPT_TEMPLATE = `現在のトレンド参考: {trend}
投稿目的: {purpose}
{contextSection}

Xでインプレッション（表示回数）が最大化されるテキストフォーマットで、3案の投稿を生成してください。

【インプレッション最大化のフォーマット要件】
1. **冒頭の引き（最初の10-15文字）**: 数字、絵文字、質問、驚きの事実などで即座に注意を引く
   - 例: "🔥 3つの方法で..." / "知ってた？" / "実は..." / "【重要】"

2. **構造化された内容**: 読みやすさと視認性を最大化
   - 箇条書き（・、✓、→など）を効果的に使用
   - 見出し形式（【】、数字付きリストなど）
   - 適度な改行で視認性向上

3. **絵文字の戦略的使用**: 視覚的なインパクトと感情的なつながり
   - 冒頭に1-2個の関連絵文字
   - 箇条書きの各項目に適切な絵文字
   - 過度な使用は避ける（3-5個程度）

4. **エンゲージメント誘発**: コメントやリツイートを促す
   - 質問形式の活用
   - "どう思う？" / "あなたは？" / "シェアして" などの呼びかけ
   - 読者の共感や意見を求める表現

5. **価値提供**: 読者にとって有益な情報を含める
   - 具体的な数字や事実
   - 実用的なアドバイスやヒント
   - トレンドとの自然な関連付け

【基本要件】
- トーン: フレンドリー、正直、押し売り感ゼロ
- 誘導文: ユーザー宣伝設定がある場合は投稿末尾に別途追加される（本プロンプトでは含めない）
- ハッシュタグ: 3-5個以内に自然に配置
- スパム臭/煽りゼロ、自然さ最優先
- 各投稿は280文字以内
- 各案は異なるフォーマットアプローチを使用（見出し型、質問型、リスト型など）

【出力形式（JSON）】:
{
  "drafts": [
    {
      "text": "投稿テキスト（ハッシュタグ含む、インプレッション最大化フォーマット）",
      "naturalnessScore": 0-100の数値（スパムリスク評価、高いほど自然）,
      "hashtags": ["ハッシュタグ1", "ハッシュタグ2", ...],
      "formatType": "見出し型" | "質問型" | "リスト型" | "ストーリー型"
    }
  ]
}`

export async function generatePosts({ 
  trend, 
  purpose, 
  aiProvider = 'grok', // デフォルトをGrokに変更
  enableHumor = false,
  enableRealtimeKnowledge = false,
  realtimeTrends = [],
  scoreConfig,
  pastPostsContext
}: GeneratePostsParams): Promise<PostDraft[]> {
  try {
    // Grokをデフォルトに、明示的にClaudeが指定された場合のみClaudeを使用
    if (aiProvider === 'claude') {
      try {
        getAnthropicApiKey() // Check if key exists
        return await generateWithClaude(trend, purpose, scoreConfig, pastPostsContext)
      } catch {
        // Claude APIキーがない場合はGrokにフォールバック
        console.log('[AI Generator] Claude API key not found, falling back to Grok')
        return await generateWithGrok(trend, purpose, enableHumor, enableRealtimeKnowledge, realtimeTrends, scoreConfig, pastPostsContext)
      }
    } else {
      // デフォルト: Grok
      try {
        getGrokApiKey() // Check if key exists
        return await generateWithGrok(trend, purpose, enableHumor, enableRealtimeKnowledge, realtimeTrends, scoreConfig, pastPostsContext)
      } catch {
        // Grok APIキーがない場合はClaudeにフォールバック
        console.log('[AI Generator] Grok API key not found, falling back to Claude')
        try {
          getAnthropicApiKey()
          return await generateWithClaude(trend, purpose, scoreConfig, pastPostsContext)
        } catch {
          throw new Error('No AI API key configured. Please set GROK_API_KEY (recommended) or ANTHROPIC_API_KEY in Vercel environment variables.')
        }
      }
    }
  } catch (error) {
    console.error('Error generating posts:', error)
    // より詳細なエラーメッセージを提供
    if (error instanceof Error) {
      throw new Error(`Failed to generate posts: ${error.message}`)
    }
    throw new Error('Failed to generate posts. Please try again.')
  }
}

async function generateWithClaude(trend: string, purpose: string, scoreConfig?: Partial<ScoreConfig>, pastPostsContext?: string): Promise<PostDraft[]> {
  const contextSection = pastPostsContext?.trim()
    ? `【ユーザーの直近投稿（流れを踏まえる）】\n${pastPostsContext}\n\n上記の投稿の流れ・テーマを踏まえ、自然につながる投稿案を生成してください。前回の締めやテーマから続く導入を検討すること。\n\n`
    : ''
  const trendLabel = trend.trim() || '（トレンド指定なし・目的に沿った通常投稿）'
  const prompt = PROMPT_TEMPLATE
    .replace('{trend}', trendLabel)
    .replace('{purpose}', purpose)
    .replace('{contextSection}', contextSection)

  // Prefer Claude Sonnet 4.5 (current); fallback to 3.5 if 4.5 is unavailable
  const modelNames = [
    'claude-sonnet-4-5',          // Current model (avoid 404 from deprecated IDs)
    'claude-3-5-sonnet-20241022', // Fallback
  ]

  let lastError: AppError | null = null

  for (const modelName of modelNames) {
    try {
      console.log(`[Claude API] Trying model: ${modelName}`)
      
      // 監査ログ: APIキーアクセスを記録
      await logApiKeyAccess('anthropic', undefined, undefined).catch(() => {
        // ログ記録失敗は無視（アプリケーションの動作を妨げない）
      })
      
      const message = await retryWithBackoff(
        async () => {
          return await getAnthropicClient().messages.create({
            model: modelName,
            max_tokens: 2000,
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ]
          })
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          onRetry: (attempt, error) => {
            console.log(`[Claude API] Retry attempt ${attempt} for model ${modelName}`)
            logErrorToSentry(error, { action: 'generateWithClaude', model: modelName, attempt })
          },
        }
      )

      const content = message.content[0]
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude')
      }

      // Parse JSON response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response')
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      if (!parsed.drafts || !Array.isArray(parsed.drafts)) {
        throw new Error('Invalid response format from Claude')
      }

      console.log(`[Claude API] Successfully generated posts with model: ${modelName}`)
      
      // 高度化されたスコア計算を適用（設定がある場合）
      const draftPromises = parsed.drafts.map(async (draft: any) => {
        const aiScore = draft.naturalnessScore || 0
        
        // 高度化設定がある場合は高度化版を使用
        if (scoreConfig) {
          const advancedBreakdown = await calculateAdvancedNaturalnessScore(
            draft.text || '',
            draft.hashtags || [],
            scoreConfig,
            [aiScore]
          )
          
          return {
            text: draft.text || '',
            naturalnessScore: advancedBreakdown.factors.totalScore,
            hashtags: draft.hashtags || [],
            formatType: draft.formatType || undefined,
            scoreBreakdown: advancedBreakdown,
          }
        }
        
        // デフォルトのスコア計算
        const scoreBreakdown = calculateNaturalnessScore(
          draft.text || '',
          draft.hashtags || [],
          aiScore
        )
        
        return {
          text: draft.text || '',
          naturalnessScore: scoreBreakdown.factors.totalScore,
          hashtags: draft.hashtags || [],
          formatType: draft.formatType || undefined,
          scoreBreakdown: scoreBreakdown,
        }
      })
      
      return await Promise.all(draftPromises)
    } catch (error) {
      console.error(`[Claude API] Error with model ${modelName}:`, error)
      const appError = classifyError(error)
      lastError = appError
      logErrorToSentry(appError, { action: 'generateWithClaude', model: modelName })
      // Continue to next model
      continue
    }
  }

  // If all models failed, throw the last error
  if (lastError) {
    throw lastError
  }
  throw new Error('Claude API error: All models failed. Unknown error.')
}

// Grok専用プロンプトテンプレート（ユーモア・リアルタイム知識対応）
const GROK_PROMPT_TEMPLATE = `現在のトレンド参考: {trend}
投稿目的: {purpose}
{contextSection}
{realtimeKnowledge}

Xでインプレッション（表示回数）が最大化されるテキストフォーマットで、3案の投稿を生成してください。

【Grokの強みを活かす要件】
{humorRequirement}
{realtimeRequirement}

【インプレッション最大化のフォーマット要件】
1. **冒頭の引き（最初の10-15文字）**: 数字、絵文字、質問、驚きの事実などで即座に注意を引く
   - 例: "🔥 3つの方法で..." / "知ってた？" / "実は..." / "【重要】"

2. **構造化された内容**: 読みやすさと視認性を最大化
   - 箇条書き（・、✓、→など）を効果的に使用
   - 見出し形式（【】、数字付きリストなど）
   - 適度な改行で視認性向上

3. **絵文字の戦略的使用**: 視覚的なインパクトと感情的なつながり
   - 冒頭に1-2個の関連絵文字
   - 箇条書きの各項目に適切な絵文字
   - 過度な使用は避ける（3-5個程度）

4. **エンゲージメント誘発**: コメントやリツイートを促す
   - 質問形式の活用
   - "どう思う？" / "あなたは？" / "シェアして" などの呼びかけ
   - 読者の共感や意見を求める表現

5. **価値提供**: 読者にとって有益な情報を含める
   - 具体的な数字や事実
   - 実用的なアドバイスやヒント
   - トレンドとの自然な関連付け

【基本要件】
- トーン: フレンドリー、正直、押し売り感ゼロ
- 誘導文: ユーザー宣伝設定がある場合は投稿末尾に別途追加される（本プロンプトでは含めない）
- ハッシュタグ: 3-5個以内に自然に配置
- スパム臭/煽りゼロ、自然さ最優先
- 各投稿は280文字以内
- 各案は異なるフォーマットアプローチを使用（見出し型、質問型、リスト型など）

【出力形式（JSON）】:
{
  "drafts": [
    {
      "text": "投稿テキスト（ハッシュタグ含む、インプレッション最大化フォーマット）",
      "naturalnessScore": 0-100の数値（スパムリスク評価、高いほど自然）,
      "hashtags": ["ハッシュタグ1", "ハッシュタグ2", ...],
      "formatType": "見出し型" | "質問型" | "リスト型" | "ストーリー型"
    }
  ]
}`

async function generateWithGrok(
  trend: string, 
  purpose: string,
  enableHumor: boolean = false,
  enableRealtimeKnowledge: boolean = false,
  realtimeTrends: string[] = [],
  scoreConfig?: Partial<ScoreConfig>,
  pastPostsContext?: string
): Promise<PostDraft[]> {
  const grokApiKey = getGrokApiKey()
  
  const contextSection = pastPostsContext?.trim()
    ? `【ユーザーの直近投稿（流れを踏まえる）】\n${pastPostsContext}\n\n上記の投稿の流れ・テーマを踏まえ、自然につながる投稿案を生成してください。前回の締めやテーマから続く導入を検討すること。\n\n`
    : ''
  
  // リアルタイム知識セクションを構築
  let realtimeKnowledgeSection = ''
  if (enableRealtimeKnowledge && realtimeTrends.length > 0) {
    realtimeKnowledgeSection = `\n【最新トレンド情報（リアルタイム）】\n${realtimeTrends.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nこれらの最新トレンドを自然に反映させてください。`
  }
  
  // ユーモア要件セクションを構築
  const humorRequirement = enableHumor 
    ? `- **ユーモア注入**: Grokの特徴的な風刺的視点や軽いユーモアを適度に注入（過度にならないよう注意）\n- **トーン**: 親しみやすく、時には軽い皮肉やウィットを含む（ただし攻撃的にならない）`
    : ''
  
  // リアルタイム要件セクションを構築
  const realtimeRequirement = enableRealtimeKnowledge
    ? `- **最新知識の活用**: 上記の最新トレンド情報を活用し、時事性の高い内容を含める\n- **リアルタイム性**: 最新の情報や話題を自然に織り交ぜる`
    : ''
  
  const trendLabel = trend.trim() || '（トレンド指定なし・目的に沿った通常投稿）'
  const prompt = GROK_PROMPT_TEMPLATE
    .replace('{trend}', trendLabel)
    .replace('{purpose}', purpose)
    .replace('{contextSection}', contextSection)
    .replace('{realtimeKnowledge}', realtimeKnowledgeSection)
    .replace('{humorRequirement}', humorRequirement || '- **トーン**: フレンドリー、正直、押し売り感ゼロ')
    .replace('{realtimeRequirement}', realtimeRequirement || '')

  // 監査ログ: APIキーアクセスを記録
  await logApiKeyAccess('grok', undefined, undefined).catch(() => {
    // ログ記録失敗は無視
  })

  return retryWithBackoff(
    async () => {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${grokApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'grok-4.1-fast',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const error: any = new Error(`Grok API error: ${response.statusText}`)
        error.status = response.status
        error.response = { headers: Object.fromEntries(response.headers.entries()) }
        error.data = errorData
        throw error
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content

      if (!content) {
        throw new Error('No content in Grok response')
      }

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in Grok response')
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      if (!parsed.drafts || !Array.isArray(parsed.drafts)) {
        throw new Error('Invalid response format from Grok')
      }

      // 高度化されたスコア計算を適用（設定がある場合）
      const draftPromises = parsed.drafts.map(async (draft: any) => {
        const aiScore = draft.naturalnessScore || 0
        
        // 高度化設定がある場合は高度化版を使用
        if (scoreConfig) {
          const advancedBreakdown = await calculateAdvancedNaturalnessScore(
            draft.text || '',
            draft.hashtags || [],
            scoreConfig,
            [aiScore]
          )
          
          return {
            text: draft.text || '',
            naturalnessScore: advancedBreakdown.factors.totalScore,
            hashtags: draft.hashtags || [],
            formatType: draft.formatType || undefined,
            scoreBreakdown: advancedBreakdown,
          }
        }
        
        // デフォルトのスコア計算
        const scoreBreakdown = calculateNaturalnessScore(
          draft.text || '',
          draft.hashtags || [],
          aiScore
        )
        
        return {
          text: draft.text || '',
          naturalnessScore: scoreBreakdown.factors.totalScore,
          hashtags: draft.hashtags || [],
          formatType: draft.formatType || undefined,
          scoreBreakdown: scoreBreakdown,
        }
      })
      
      return await Promise.all(draftPromises)
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      onRetry: (attempt, error) => {
        console.log(`[Grok API] Retry attempt ${attempt}`)
        logErrorToSentry(error, { action: 'generateWithGrok', attempt })
      },
    }
  ).catch((error) => {
    const appError = classifyError(error)
    logErrorToSentry(appError, { action: 'generateWithGrok' })
    throw appError
  })
}

export interface ImprovedText {
  improvedText: string
  improvements: string[]
  naturalnessScore: number
  explanation: string
  factScore?: number
  factSuggestions?: string[]
}

export interface ImproveTextParams {
  originalText: string
  purpose?: string
  aiProvider?: 'grok' | 'claude'
  /** RAG: user's recent posts for coherent flow */
  pastPostsContext?: string
  /** Run fact-check on improved text and attach score/suggestions */
  runFactCheck?: boolean
}

/**
 * 手動で入力したツイートテキストを改善・成形する
 */
export async function improveTweetText({
  originalText,
  purpose,
  aiProvider = 'grok',
  pastPostsContext,
  runFactCheck = false
}: ImproveTextParams): Promise<ImprovedText> {
  try {
    let result: ImprovedText
    if (aiProvider === 'claude') {
      try {
        getAnthropicApiKey()
        result = await improveWithClaude(originalText, purpose, pastPostsContext)
      } catch {
        console.log('[AI Generator] Claude API key not found, falling back to Grok')
        result = await improveWithGrok(originalText, purpose, pastPostsContext)
      }
    } else {
      try {
        getGrokApiKey()
        result = await improveWithGrok(originalText, purpose, pastPostsContext)
      } catch {
        console.log('[AI Generator] Grok API key not found, falling back to Claude')
        try {
          getAnthropicApiKey()
          result = await improveWithClaude(originalText, purpose, pastPostsContext)
        } catch {
          throw new Error('No AI API key configured. Please set GROK_API_KEY (recommended) or ANTHROPIC_API_KEY in Vercel environment variables.')
        }
      }
    }
    if (runFactCheck && result.improvedText) {
      const fc = await factCheckDraft(result.improvedText, aiProvider)
      result.factScore = fc.score
      result.factSuggestions = fc.suggestions
    }
    return result
  } catch (error) {
    console.error('Error improving tweet text:', error)
    if (error instanceof Error) {
      throw new Error(`Failed to improve tweet text: ${error.message}`)
    }
    throw new Error('Failed to improve tweet text. Please try again.')
  }
}

async function improveWithClaude(originalText: string, purpose?: string, pastPostsContext?: string): Promise<ImprovedText> {
  const contextBlock = pastPostsContext?.trim()
    ? `【ユーザーの直近投稿（流れを踏まえる）】\n${pastPostsContext}\n\n上記の流れ・テーマに自然につながる改善を心がけてください。\n\n`
    : ''
  const prompt = `以下のツイートテキストを改善・成形してください。
${contextBlock}
【元のテキスト】
${originalText}

${purpose ? `【投稿目的】\n${purpose}\n` : ''}

【改善要件】
1. **読みやすさの向上**: 適切な改行、箇条書き、構造化
2. **エンゲージメント向上**: 質問、呼びかけ、共感を誘う表現を追加
3. **視覚的インパクト**: 冒頭の引き、絵文字の戦略的使用（3-5個程度）
4. **自然さの確保**: スパム臭を避け、自然で読みやすい表現に
5. **文字数最適化**: 280文字以内に収めつつ、情報量を保持

【出力形式（JSON）】:
{
  "improvedText": "改善された投稿テキスト（280文字以内）",
  "improvements": ["改善点1", "改善点2", "改善点3"],
  "naturalnessScore": 0-100の数値（スパムリスク評価、高いほど自然）,
  "explanation": "改善内容の説明（50文字程度）"
}

【注意】
- 元のテキストの意味や意図は必ず保持する
- 過度な装飾や変更は避ける
- 自然で読みやすい改善を心がける`

  const anthropic = getAnthropicClient()
  const modelNames = [
    'claude-sonnet-4-5',
    'claude-3-5-sonnet-20241022',
  ]

  let lastError: AppError | null = null

  for (const modelName of modelNames) {
    try {
      console.log(`[Claude API] Improving text with model: ${modelName}`)
      
      await logApiKeyAccess('anthropic', undefined, undefined).catch(() => {})

      const message = await anthropic.messages.create({
        model: modelName,
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })

      const content = message.content[0]
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude')
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response')
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      return {
        improvedText: parsed.improvedText || originalText,
        improvements: parsed.improvements || [],
        naturalnessScore: parsed.naturalnessScore || 70,
        explanation: parsed.explanation || 'テキストを改善しました'
      }
    } catch (error) {
      const appError = classifyError(error)
      lastError = appError
      console.error(`[Claude API] Model ${modelName} failed:`, appError.message)
      
      if (modelName === modelNames[modelNames.length - 1]) {
        break
      }
    }
  }

  if (lastError) {
    throw lastError
  }
  throw new Error('Claude API error: All models failed.')
}

async function improveWithGrok(originalText: string, purpose?: string, pastPostsContext?: string): Promise<ImprovedText> {
  const grokApiKey = getGrokApiKey()
  const contextBlock = pastPostsContext?.trim()
    ? `【ユーザーの直近投稿（流れを踏まえる）】\n${pastPostsContext}\n\n上記の流れ・テーマに自然につながる改善を心がけてください。\n\n`
    : ''
  const prompt = `以下のツイートテキストを改善・成形してください。
${contextBlock}
【元のテキスト】
${originalText}

${purpose ? `【投稿目的】\n${purpose}\n` : ''}

【改善要件】
1. **読みやすさの向上**: 適切な改行、箇条書き、構造化
2. **エンゲージメント向上**: 質問、呼びかけ、共感を誘う表現を追加
3. **視覚的インパクト**: 冒頭の引き、絵文字の戦略的使用（3-5個程度）
4. **自然さの確保**: スパム臭を避け、自然で読みやすい表現に
5. **文字数最適化**: 280文字以内に収めつつ、情報量を保持
6. **Grokの強み**: 軽いユーモアや風刺的視点を適度に注入（過度にならないよう注意）

【出力形式（JSON）】:
{
  "improvedText": "改善された投稿テキスト（280文字以内）",
  "improvements": ["改善点1", "改善点2", "改善点3"],
  "naturalnessScore": 0-100の数値（スパムリスク評価、高いほど自然）,
  "explanation": "改善内容の説明（50文字程度）"
}

【注意】
- 元のテキストの意味や意図は必ず保持する
- 過度な装飾や変更は避ける
- 自然で読みやすい改善を心がける`

  await logApiKeyAccess('grok', undefined, undefined).catch(() => {})

  const response = await retryWithBackoff(
    async () => {
      const OpenAI = (await import('openai')).default
      const openai = new OpenAI({
        apiKey: grokApiKey,
        baseURL: 'https://api.x.ai/v1',
      })

      const completion = await openai.chat.completions.create({
        model: 'grok-4.1-fast',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('Empty response from Grok')
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in Grok response')
      }

      const parsed = JSON.parse(jsonMatch[0])
      
      return {
        improvedText: parsed.improvedText || originalText,
        improvements: parsed.improvements || [],
        naturalnessScore: parsed.naturalnessScore || 70,
        explanation: parsed.explanation || 'テキストを改善しました'
      }
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      onRetry: (attempt, error) => {
        console.log(`[Grok API] Retry attempt ${attempt}`)
        logErrorToSentry(error, { action: 'improveWithGrok', attempt })
      },
    }
  ).catch((error) => {
    const appError = classifyError(error)
    logErrorToSentry(appError, { action: 'improveWithGrok' })
    throw appError
  })

  return response
}

const FACT_CHECK_PROMPT = `以下のX投稿案の事実関係を確認してください。具体的な数字・日付・固有名詞・主張に誤りがないかチェックし、修正提案があれば簡潔に挙げてください。

【投稿案】
{draft}

【出力形式（JSONのみ）】
{
  "score": 0-100の数値（事実正確性スコア。100=問題なし、70未満=要確認）、
  "suggestions": ["修正提案1", "修正提案2", ...]（問題なければ空配列）
}`

/** Build user-facing suggestion when fact-check fails (for logging + UI) */
function factCheckFailureSuggestion(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/not set|API key|API_KEY|configure.*environment/i.test(msg))
    return '事実確認に必要なAPIキーが設定されていません。設定でClaudeまたはGrokのキーを設定してください。'
  if (/rate|limit|429|quota/i.test(msg))
    return 'APIの利用制限に達した可能性があります。しばらく時間をおいてから再度お試しください。'
  if (/Grok fact-check API error|Anthropic|claude/i.test(msg))
    return 'AIの事実確認APIでエラーが発生しました。内容を手動で確認してください。'
  return '事実確認の取得に失敗しました。内容を手動で確認してください。'
}

/**
 * AI fact-check: verify factual claims in draft, return score (0-100) and correction suggestions.
 * Failure paths: API key missing → fallback (Claude→Grok) or return 50 + message; API error/network → 50 + message.
 */
export async function factCheckDraft(
  text: string,
  aiProvider: 'grok' | 'claude' = 'grok'
): Promise<FactCheckResult> {
  const prompt = FACT_CHECK_PROMPT.replace('{draft}', text.slice(0, 800))
  try {
    if (aiProvider === 'claude') {
      try {
        getAnthropicApiKey()
        return await factCheckWithClaude(prompt)
      } catch (e) {
        console.warn('[factCheck] Claude failed, falling back to Grok:', e instanceof Error ? e.message : e)
        try {
          getGrokApiKey()
          return await factCheckWithGrok(prompt)
        } catch (grokErr) {
          const suggestion = factCheckFailureSuggestion(grokErr)
          return { score: 50, suggestions: [suggestion] }
        }
      }
    }
    // aiProvider === 'grok': try Grok first, fall back to Claude if Grok key missing or API error
    try {
      getGrokApiKey()
      return await factCheckWithGrok(prompt)
    } catch (e) {
      console.warn('[factCheck] Grok failed, falling back to Claude:', e instanceof Error ? e.message : e)
      try {
        getAnthropicApiKey()
        return await factCheckWithClaude(prompt)
      } catch (claudeErr) {
        const suggestion = factCheckFailureSuggestion(claudeErr)
        return { score: 50, suggestions: [suggestion] }
      }
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    const errStack = e instanceof Error ? e.stack : undefined
    console.error('[factCheck] factCheckDraft failed. provider=', aiProvider, 'error=', errMsg, errStack ?? '')
    const suggestion = factCheckFailureSuggestion(e)
    return { score: 50, suggestions: [suggestion] }
  }
}

async function factCheckWithClaude(prompt: string): Promise<FactCheckResult> {
  const client = getAnthropicClient()
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })
  const content = (msg.content[0] as { text?: string })?.text?.trim() || ''
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { score: 70, suggestions: [] }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { score?: number; suggestions?: string[] }
    return {
      score: Math.min(100, Math.max(0, Number(parsed.score) ?? 70)),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    }
  } catch {
    return { score: 70, suggestions: [] }
  }
}

async function factCheckWithGrok(prompt: string): Promise<FactCheckResult> {
  const grokApiKey = getGrokApiKey()
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${grokApiKey}` },
    body: JSON.stringify({
      model: 'grok-3-latest',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 500,
    }),
  })
  const rawText = await res.text()
  const data = (() => {
    try {
      return rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  })()
  if (!res.ok) {
    const errMsg = (data as { error?: { message?: string } })?.error?.message || res.statusText
    console.error('[factCheck] Grok API error:', res.status, errMsg, 'body:', rawText.slice(0, 500))
    throw new Error(`Grok fact-check API error: ${res.status} ${errMsg}`)
  }
  const content = (data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content?.trim() || ''
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { score: 70, suggestions: [] }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { score?: number; suggestions?: string[] }
    return {
      score: Math.min(100, Math.max(0, Number(parsed.score) ?? 70)),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    }
  } catch {
    return { score: 70, suggestions: [] }
  }
}
