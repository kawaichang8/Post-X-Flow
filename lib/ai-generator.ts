import Anthropic from '@anthropic-ai/sdk'

export interface PostDraft {
  text: string
  naturalnessScore: number
  hashtags: string[]
  formatType?: string // フォーマットタイプ（見出し型、質問型、リスト型など）
}

export interface GeneratePostsParams {
  trend: string
  purpose: string
}

// Claude API implementation
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const PROMPT_TEMPLATE = `現在のトレンド参考: {trend}
投稿目的: {purpose}

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
- 誘導文: 控えめ（例: 「速くメモ取るならMF MemoFlow試してみて」）
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

export async function generatePosts({ trend, purpose }: GeneratePostsParams): Promise<PostDraft[]> {
  try {
    // Use Claude API if available, otherwise fallback to Grok
    if (process.env.ANTHROPIC_API_KEY) {
      return await generateWithClaude(trend, purpose)
    } else if (process.env.GROK_API_KEY) {
      return await generateWithGrok(trend, purpose)
    } else {
      throw new Error('No AI API key configured. Please set ANTHROPIC_API_KEY or GROK_API_KEY')
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

async function generateWithClaude(trend: string, purpose: string): Promise<PostDraft[]> {
  const prompt = PROMPT_TEMPLATE
    .replace('{trend}', trend)
    .replace('{purpose}', purpose)

  // Try different model names in order of preference
  const modelNames = [
    'claude-3-5-sonnet-20241022', // Latest 3.5 Sonnet (stable)
    'claude-sonnet-4-20250514',   // Newer Sonnet 4 (if available)
    'claude-3-opus-20240229',     // Fallback to Opus
  ]

  let lastError: Error | null = null

  for (const modelName of modelNames) {
    try {
      console.log(`[Claude API] Trying model: ${modelName}`)
      const message = await anthropic.messages.create({
        model: modelName,
        max_tokens: 2000,
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
      return parsed.drafts.map((draft: any) => ({
        text: draft.text || '',
        naturalnessScore: draft.naturalnessScore || 0,
        hashtags: draft.hashtags || [],
        formatType: draft.formatType || undefined // フォーマットタイプ（オプショナル）
      }))
    } catch (error) {
      console.error(`[Claude API] Error with model ${modelName}:`, error)
      lastError = error instanceof Error ? error : new Error(String(error))
      // Continue to next model
      continue
    }
  }

  // If all models failed, throw the last error
  throw new Error(`Claude API error: All models failed. Last error: ${lastError?.message || 'Unknown error'}`)
}

async function generateWithGrok(trend: string, purpose: string): Promise<PostDraft[]> {
  // Grok API implementation (placeholder - adjust based on actual Grok API)
  const grokApiKey = process.env.GROK_API_KEY!
  const prompt = PROMPT_TEMPLATE
    .replace('{trend}', trend)
    .replace('{purpose}', purpose)

  // Note: Adjust this based on actual Grok API endpoint and format
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${grokApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'grok-beta',
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
    throw new Error(`Grok API error: ${response.statusText}`)
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

  return parsed.drafts.map((draft: any) => ({
    text: draft.text || '',
    naturalnessScore: draft.naturalnessScore || 0,
    hashtags: draft.hashtags || [],
    formatType: draft.formatType || undefined // フォーマットタイプ（オプショナル）
  }))
}
