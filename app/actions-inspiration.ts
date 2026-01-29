"use server"

import { createServerClient } from "@/lib/supabase"
import { getPromotionSettingsForGeneration } from "@/app/actions-promotion"

export interface InspirationPost {
  id: string
  text: string
  tweet_id: string | null
  like_count: number
  retweet_count: number
  reply_count: number
  impression_count: number | null
  engagement_rate: number | null
  created_at: string
  author_name?: string
  author_handle?: string
}

export interface QuoteRTDraft {
  id: string
  originalPost: InspirationPost
  generatedComment: string
  fullText: string
  naturalnessScore: number
}

const PROMOTION_NATURALNESS_PENALTY = 3

// Simple naturalness score estimator
function estimateNaturalnessScore(text: string): number {
  let score = 85 // Base score
  
  // Penalize too short or too long
  if (text.length < 20) score -= 15
  if (text.length > 200) score -= 10
  
  // Penalize excessive emojis
  const emojiCount = (text.match(/[\u{1F600}-\u{1F9FF}]/gu) || []).length
  if (emojiCount > 5) score -= (emojiCount - 5) * 2
  
  // Penalize spam patterns
  if (text.includes("!!!")) score -= 10
  if (/(.)\1{3,}/.test(text)) score -= 10 // Repeated chars
  
  return Math.max(0, Math.min(100, score))
}

// Fetch high engagement posts for inspiration
export async function getInspirationPosts(userId: string, limit = 20): Promise<InspirationPost[]> {
  try {
    const supabase = createServerClient()
    
    const { data, error } = await supabase
      .from("post_history")
      .select("id, text, tweet_id, like_count, retweet_count, reply_count, impression_count, engagement_rate, created_at")
      .eq("user_id", userId)
      .eq("status", "posted")
      .not("tweet_id", "is", null)
      .order("like_count", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("Error fetching inspiration posts:", error)
      return []
    }

    return (data || []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      text: p.text as string,
      tweet_id: p.tweet_id as string | null,
      like_count: (p.like_count as number) ?? 0,
      retweet_count: (p.retweet_count as number) ?? 0,
      reply_count: (p.reply_count as number) ?? 0,
      impression_count: p.impression_count as number | null,
      engagement_rate: p.engagement_rate as number | null,
      created_at: p.created_at as string,
    }))
  } catch (e) {
    console.error("getInspirationPosts error:", e)
    return []
  }
}

// Generate AI comment for quote RT
export async function generateQuoteRTDraft(
  userId: string,
  originalPost: InspirationPost,
  userContext?: string
): Promise<QuoteRTDraft | null> {
  try {
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
        console.error("No AI API key available")
        return null
      }
    }

    const prompt = `以下の元ツイートに対して、引用RTで追加するコメントを生成してください。

【元ツイート】
${originalPost.text}

【要件】
- 元ツイートの内容に対する自分の意見・感想・補足を50〜100文字程度で
- 自然で人間らしいトーン（押し売り感ゼロ）
- 共感、学び、質問、補足情報のいずれかのアプローチ
${userContext ? `- ユーザーの追加コンテキスト: ${userContext}` : ""}

【出力形式】
コメントテキストのみ（ハッシュタグ不要、改行可）`

    let generatedComment = ""

    if (useGrok) {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-3-latest",
          messages: [
            { role: "system", content: "あなたは日本語のソーシャルメディア専門家です。自然で魅力的な引用ツイートのコメントを生成します。" },
            { role: "user", content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 200,
        }),
      })

      if (!response.ok) {
        throw new Error(`Grok API error: ${response.status}`)
      }

      const data = await response.json()
      generatedComment = data.choices?.[0]?.message?.content?.trim() || ""
    } else {
      const Anthropic = (await import("@anthropic-ai/sdk")).default
      const anthropic = new Anthropic({ apiKey })
      
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      })

      generatedComment = (message.content[0] as { text: string })?.text?.trim() || ""
    }

    if (!generatedComment) {
      return null
    }

    // Apply promotion settings if enabled
    const promo = await getPromotionSettingsForGeneration(userId)
    let fullText = generatedComment
    
    // Simple naturalness score estimation (0-100)
    let naturalnessScore = estimateNaturalnessScore(generatedComment)

    if (promo?.enabled && promo.link_url) {
      const suffix = promo.template.replace(/\[link\]/g, promo.link_url).trim()
      fullText = `${generatedComment}\n\n${suffix}`
      naturalnessScore = Math.max(0, naturalnessScore - PROMOTION_NATURALNESS_PENALTY)
    }

    return {
      id: `quote-${Date.now()}`,
      originalPost,
      generatedComment,
      fullText,
      naturalnessScore,
    }
  } catch (e) {
    console.error("generateQuoteRTDraft error:", e)
    return null
  }
}

// Safety: max auto-retweets per 24h to avoid spam risk
const MAX_RETWEETS_PER_24H = 10

export async function getRetweetCountLast24h(userId: string): Promise<number> {
  try {
    const supabase = createServerClient()
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count, error } = await supabase
      .from("post_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("original_tweet_id", "is", null)
      .gte("created_at", since)
    if (error) return 0
    return count ?? 0
  } catch {
    return 0
  }
}

export async function scheduleRetweet(
  userId: string,
  originalTweetId: string,
  type: "simple" | "quote",
  options: {
    comment?: string
    scheduledFor?: Date
    twitterAccountId?: string
  }
): Promise<{ success: boolean; postHistoryId?: string; error?: string }> {
  try {
    const count = await getRetweetCountLast24h(userId)
    if (count >= MAX_RETWEETS_PER_24H) {
      return {
        success: false,
        error: `24時間あたりの自動リツイート上限（${MAX_RETWEETS_PER_24H}回）に達しています。しばらくしてからお試しください。`,
      }
    }

    const supabase = createServerClient()
    const scheduledFor = options.scheduledFor ?? new Date()
    const text = type === "quote" ? (options.comment?.trim() || "👍") : ""
    const { data: row, error } = await supabase
      .from("post_history")
      .insert({
        user_id: userId,
        text,
        hashtags: [],
        naturalness_score: null,
        trend: null,
        purpose: null,
        status: "scheduled",
        scheduled_for: scheduledFor.toISOString(),
        original_tweet_id: originalTweetId,
        retweet_type: type,
      })
      .select("id")
      .single()

    if (error) {
      console.error("scheduleRetweet insert error:", error)
      return { success: false, error: "予約の保存に失敗しました。" }
    }
    return { success: true, postHistoryId: row.id }
  } catch (e) {
    console.error("scheduleRetweet error:", e)
    return {
      success: false,
      error: e instanceof Error ? e.message : "自動リツイートの予約に失敗しました。",
    }
  }
}

// Post simple retweet immediately (no comment)
export async function postSimpleRetweet(
  userId: string,
  targetTweetId: string,
  accessToken: string,
  twitterAccountId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const count = await getRetweetCountLast24h(userId)
    if (count >= MAX_RETWEETS_PER_24H) {
      return {
        success: false,
        error: `24時間あたりの自動リツイート上限（${MAX_RETWEETS_PER_24H}回）に達しています。`,
      }
    }
    const { postRetweet, refreshTwitterAccessToken } = await import("@/lib/x-post")
    const supabase = createServerClient()
    let currentAccessToken = accessToken
    try {
      await postRetweet(targetTweetId, currentAccessToken)
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && (err as { code?: number }).code === 401) {
        const { data: tokenData } = await supabase
          .from("user_twitter_tokens")
          .select("refresh_token")
          .eq("user_id", userId)
          .single()
        if (!tokenData?.refresh_token) {
          return { success: false, error: "Twitter認証エラー。再連携してください。" }
        }
        const { accessToken: newToken, refreshToken: newRefresh } = await refreshTwitterAccessToken(tokenData.refresh_token)
        await supabase
          .from("user_twitter_tokens")
          .update({ access_token: newToken, refresh_token: newRefresh, updated_at: new Date().toISOString() })
          .eq("user_id", userId)
        currentAccessToken = newToken
        await postRetweet(targetTweetId, currentAccessToken)
      } else {
        throw err
      }
    }
    await supabase.from("post_history").insert({
      user_id: userId,
      text: "",
      status: "posted",
      tweet_id: null,
      twitter_account_id: twitterAccountId || null,
      original_tweet_id: targetTweetId,
      retweet_type: "simple",
    })
    return { success: true }
  } catch (e: unknown) {
    console.error("postSimpleRetweet error:", e)
    return {
      success: false,
      error: e instanceof Error ? e.message : "リツイートに失敗しました。",
    }
  }
}

// Post quote RT
export async function postQuoteRT(
  userId: string,
  text: string,
  quoteTweetId: string,
  accessToken: string,
  twitterAccountId?: string
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  try {
    const { postTweet, refreshTwitterAccessToken } = await import("@/lib/x-post")
    const supabase = createServerClient()

    let currentAccessToken = accessToken
    let tweet

    try {
      tweet = await postTweet(text, currentAccessToken, { quoteTweetId })
    } catch (error: any) {
      if (error?.code === 401) {
        // Refresh token
        const { data: tokenData } = await supabase
          .from("user_twitter_tokens")
          .select("refresh_token")
          .eq("user_id", userId)
          .single()

        if (!tokenData?.refresh_token) {
          return { success: false, error: "Twitter認証エラー。再連携してください。" }
        }

        const { accessToken: newToken, refreshToken: newRefresh } = await refreshTwitterAccessToken(tokenData.refresh_token)

        await supabase
          .from("user_twitter_tokens")
          .update({ access_token: newToken, refresh_token: newRefresh, updated_at: new Date().toISOString() })
          .eq("user_id", userId)

        currentAccessToken = newToken
        tweet = await postTweet(text, currentAccessToken, { quoteTweetId })
      } else {
        throw error
      }
    }

    // Save to history
    await supabase.from("post_history").insert({
      user_id: userId,
      text,
      status: "posted",
      tweet_id: tweet.id,
      twitter_account_id: twitterAccountId || null,
    })

    return { success: true, tweetId: tweet.id }
  } catch (e: any) {
    console.error("postQuoteRT error:", e)
    return { success: false, error: e.message || "引用RTの投稿に失敗しました" }
  }
}
