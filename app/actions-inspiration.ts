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
  source?: "own" | "trending" | "search" // Source of the candidate
}

export interface QuoteRTDraft {
  id: string
  originalPost: InspirationPost
  generatedComment: string
  fullText: string
  naturalnessScore: number
}

export interface QuoteRTCandidate {
  id: string
  post: InspirationPost
  draft?: QuoteRTDraft
  generatedAt?: string
}

// External tweet fetched by URL
export interface ExternalTweet {
  id: string
  tweet_id: string
  text: string
  author_name: string
  author_handle: string
  author_avatar_url?: string
  like_count: number
  retweet_count: number
  reply_count: number
  impression_count: number | null
  created_at: string
  source: "external"
}

// Free tier limits
const FREE_TIER_DAILY_QUOTE_GENERATIONS = 3
const FREE_TIER_DAILY_CANDIDATES_VIEW = 5

/**
 * Extract tweet ID from various X/Twitter URL formats
 * Supports:
 * - https://x.com/username/status/1234567890
 * - https://twitter.com/username/status/1234567890
 * - https://x.com/i/status/1234567890
 * - https://x.com/i/web/status/1234567890
 * - https://mobile.twitter.com/username/status/1234567890
 * - Trailing slash or query params
 * - Just the ID: 1234567890
 */
export async function extractTweetIdFromUrl(urlOrId: string): Promise<string | null> {
  const trimmed = urlOrId.trim()
  if (!trimmed) return null
  
  // If it's just a numeric ID (snowflake: 15–20 digits)
  if (/^\d{15,20}$/.test(trimmed)) {
    return trimmed
  }
  if (/^\d+$/.test(trimmed)) {
    return trimmed
  }
  
  try {
    const url = new URL(trimmed)
    // pathname: /user/status/123 or /i/web/status/123 (no trailing slash in URL spec, but strip for safety)
    const path = url.pathname.replace(/\/+$/, "")
    const match = path.match(/\/status(?:es)?\/(\d+)/)
    if (match) {
      return match[1]
    }
  } catch {
    // Not a valid URL, try regex on raw string
    const match = trimmed.match(/\/status(?:es)?\/(\d+)/)
    if (match) {
      return match[1]
    }
  }
  
  return null
}

/**
 * Fetch an external tweet by URL or ID
 * Returns InspirationPost-compatible object for use with QuoteRTEditor
 */
export async function fetchExternalTweet(
  userId: string,
  urlOrId: string,
  accessToken: string
): Promise<{ success: boolean; tweet?: InspirationPost; error?: string }> {
  try {
    const tweetId = await extractTweetIdFromUrl(urlOrId)
    if (!tweetId) {
      return { success: false, error: "無効なURLまたはツイートIDです。x.com または twitter.com のツイートURLをそのまま貼り付けてください。" }
    }
    
    const { fetchTweetById } = await import("@/lib/x-post")
    let fetched
    try {
      fetched = await fetchTweetById(tweetId, accessToken)
    } catch (apiError) {
      const msg = apiError instanceof Error ? apiError.message : "ツイートの取得に失敗しました。"
      return { success: false, error: `${msg}（ID: ${tweetId}）` }
    }
    
    if (!fetched) {
      return { success: false, error: `ツイートを取得できませんでした。（ID: ${tweetId}）削除・非公開の可能性があります。` }
    }
    
    // Convert to InspirationPost format
    const post: InspirationPost = {
      id: `external-${fetched.id}`,
      text: fetched.text,
      tweet_id: fetched.id,
      like_count: fetched.likeCount,
      retweet_count: fetched.retweetCount,
      reply_count: fetched.replyCount,
      impression_count: fetched.impressionCount,
      engagement_rate: null,
      created_at: fetched.createdAt,
      author_name: fetched.authorName,
      author_handle: fetched.authorUsername,
      source: "search", // Mark as external source
    }
    
    return { success: true, tweet: post }
  } catch (e) {
    console.error("[fetchExternalTweet] Error:", e)
    const errorMsg = e instanceof Error ? e.message : "ツイートの取得に失敗しました"
    return { success: false, error: errorMsg }
  }
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

// Get quote RT generation count for today (free tier tracking)
export async function getQuoteRTGenerationCountToday(userId: string): Promise<number> {
  try {
    const supabase = createServerClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const { data, error } = await supabase
      .from("usage_tracking")
      .select("quote_rt_generation_count")
      .eq("user_id", userId)
      .eq("usage_date", today.toISOString().split("T")[0])
      .single()
    
    if (error && error.code !== "PGRST116") {
      console.error("Error fetching quote RT generation count:", error)
      return 0
    }
    
    return data?.quote_rt_generation_count ?? 0
  } catch (e) {
    console.error("getQuoteRTGenerationCountToday error:", e)
    return 0
  }
}

// Increment quote RT generation count
export async function incrementQuoteRTGenerationCount(userId: string): Promise<number> {
  try {
    const supabase = createServerClient()
    const today = new Date().toISOString().split("T")[0]
    
    // Try to update existing record
    const { data: existing, error: selectError } = await supabase
      .from("usage_tracking")
      .select("id, quote_rt_generation_count")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .single()
    
    if (selectError && selectError.code !== "PGRST116") {
      console.error("Error checking usage_tracking:", selectError)
      return 0
    }
    
    if (existing) {
      const newCount = (existing.quote_rt_generation_count ?? 0) + 1
      await supabase
        .from("usage_tracking")
        .update({ quote_rt_generation_count: newCount, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
      return newCount
    } else {
      // Insert new record
      await supabase
        .from("usage_tracking")
        .insert({
          user_id: userId,
          usage_date: today,
          quote_rt_generation_count: 1,
        })
      return 1
    }
  } catch (e) {
    console.error("incrementQuoteRTGenerationCount error:", e)
    return 0
  }
}

// Check if user can generate quote RT (free tier limits)
export async function canGenerateQuoteRT(userId: string, isPro: boolean): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  if (isPro) {
    return { allowed: true, remaining: Infinity, limit: Infinity }
  }
  
  const count = await getQuoteRTGenerationCountToday(userId)
  const remaining = Math.max(0, FREE_TIER_DAILY_QUOTE_GENERATIONS - count)
  
  return {
    allowed: remaining > 0,
    remaining,
    limit: FREE_TIER_DAILY_QUOTE_GENERATIONS,
  }
}

// Fetch high engagement posts for inspiration
export async function getInspirationPosts(userId: string, limit = 20, isPro = false): Promise<InspirationPost[]> {
  try {
    const supabase = createServerClient()
    
    // Apply free tier limit
    const effectiveLimit = isPro ? limit : Math.min(limit, FREE_TIER_DAILY_CANDIDATES_VIEW)
    
    const { data, error } = await supabase
      .from("post_history")
      .select("id, text, tweet_id, like_count, retweet_count, reply_count, impression_count, engagement_rate, created_at")
      .eq("user_id", userId)
      .eq("status", "posted")
      .not("tweet_id", "is", null)
      .order("like_count", { ascending: false })
      .limit(effectiveLimit)

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
      source: "own" as const,
    }))
  } catch (e) {
    console.error("getInspirationPosts error:", e)
    return []
  }
}

// Get quote RT candidates including external tweets (Pro feature)
export async function getQuoteRTCandidates(
  userId: string,
  isPro: boolean,
  options?: { includeTrending?: boolean; searchQuery?: string }
): Promise<{ candidates: InspirationPost[]; hasMore: boolean }> {
  try {
    // Get user's own high-engagement posts
    const ownPosts = await getInspirationPosts(userId, isPro ? 20 : FREE_TIER_DAILY_CANDIDATES_VIEW, isPro)
    
    // For now, we only return own posts
    // External tweet fetching would require X API Premium access
    // Future enhancement: Add trending/search candidates for Pro users
    
    return {
      candidates: ownPosts,
      hasMore: !isPro && ownPosts.length >= FREE_TIER_DAILY_CANDIDATES_VIEW,
    }
  } catch (e) {
    console.error("getQuoteRTCandidates error:", e)
    return { candidates: [], hasMore: false }
  }
}

// Generate AI comment for quote RT
export async function generateQuoteRTDraft(
  userId: string,
  originalPost: InspirationPost,
  userContext?: string,
  isPro = false
): Promise<QuoteRTDraft | null> {
  try {
    // Check free tier limits
    if (!isPro) {
      const { allowed, remaining } = await canGenerateQuoteRT(userId, false)
      if (!allowed) {
        console.warn(`[generateQuoteRTDraft] Free tier limit reached for user ${userId}. Remaining: ${remaining}`)
        return null
      }
    }
    
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
${originalPost.author_handle ? `（投稿者: @${originalPost.author_handle}）` : ""}

【重要：プロフィール訪問率10倍を狙うコメントの条件】
しょうもない反応（「これ面白いです！」「参考になります」等）は絶対NG。
以下のいずれかの"読む価値のある中身"を必ず含めること：

1. **追加の視点** - 元ツイートにない別角度からの見方
   例：「〇〇の観点から見ると…」「△△業界だと逆に…」

2. **具体例** - 自分の経験や知っている事例
   例：「実際に□□でも同じことが…」「先日〇〇で体験したけど…」

3. **一段深いインサイト** - 本質を突く要約や気づき
   例：「これって要するに『□□』ってこと」「裏を返せば〇〇ということ」

【要件】
- 50〜120文字程度（短すぎず、読み応えあり）
- 自然で人間らしいトーン（押し売り感ゼロ）
- 元投稿者や読者が「おっ」と思う内容
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
    
    // Increment usage count for free tier
    if (!isPro) {
      await incrementQuoteRTGenerationCount(userId)
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

// ============================================
// REPLY FUNCTIONS
// ============================================

export interface ReplyDraft {
  id: string
  originalPost: InspirationPost
  generatedReply: string
  naturalnessScore: number
}

// Generate AI reply (shorter, more conversational than quote RT)
export async function generateReplyDraft(
  userId: string,
  originalPost: InspirationPost,
  userContext?: string,
  isPro = false
): Promise<ReplyDraft | null> {
  try {
    // Check free tier limits (shares limit with quote RT)
    if (!isPro) {
      const { allowed, remaining } = await canGenerateQuoteRT(userId, false)
      if (!allowed) {
        console.warn(`[generateReplyDraft] Free tier limit reached for user ${userId}. Remaining: ${remaining}`)
        return null
      }
    }
    
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

    const prompt = `以下のツイートに対して、リプライ（返信）を生成してください。

【元ツイート】
${originalPost.text}
${originalPost.author_handle ? `（投稿者: @${originalPost.author_handle}）` : ""}

【重要：プロフィール訪問率を上げるリプライの条件】
しょうもない反応（「いいですね！」「同感です」等）は絶対NG。
以下のいずれかを含めること：

1. **追加の視点・情報** - 相手が知らなそうな関連情報
   例：「ちなみに〇〇では△△らしいですよ」

2. **具体的な質問** - 会話が発展する質問
   例：「これって□□の場合はどうなりますか？」

3. **自分の体験・事例** - 共感を示しつつ価値を追加
   例：「先日〇〇で同じ経験しました。△△がポイントでした」

【要件】
- 30〜80文字程度（リプライは短めが効果的）
- 会話調で自然なトーン
- 相手への敬意を忘れずに
${userContext ? `- ユーザーの追加コンテキスト: ${userContext}` : ""}

【出力形式】
リプライテキストのみ（@メンション不要、ハッシュタグ不要）`

    let generatedReply = ""

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
            { role: "system", content: "あなたは日本語のソーシャルメディア専門家です。自然で会話的なリプライを生成します。短く、価値のある返信を心がけてください。" },
            { role: "user", content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 150,
        }),
      })

      if (!response.ok) {
        throw new Error(`Grok API error: ${response.status}`)
      }

      const data = await response.json()
      generatedReply = data.choices?.[0]?.message?.content?.trim() || ""
    } else {
      const Anthropic = (await import("@anthropic-ai/sdk")).default
      const anthropic = new Anthropic({ apiKey })
      
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      })

      generatedReply = (message.content[0] as { text: string })?.text?.trim() || ""
    }

    if (!generatedReply) {
      return null
    }
    
    // Increment usage count for free tier
    if (!isPro) {
      await incrementQuoteRTGenerationCount(userId)
    }

    // Estimate naturalness score
    const naturalnessScore = Math.min(95, Math.max(60, 
      80 + 
      (generatedReply.length > 20 && generatedReply.length < 100 ? 10 : 0) +
      (generatedReply.includes("？") ? 5 : 0) +
      Math.floor(Math.random() * 10) - 5
    ))

    return {
      id: `reply-${Date.now()}`,
      originalPost,
      generatedReply,
      naturalnessScore,
    }
  } catch (e) {
    console.error("generateReplyDraft error:", e)
    return null
  }
}

// Post reply immediately
export async function postReply(
  userId: string,
  text: string,
  replyToTweetId: string,
  accessToken: string,
  twitterAccountId?: string
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  try {
    const { postTweet, refreshTwitterAccessToken } = await import("@/lib/x-post")
    const supabase = createServerClient()

    let currentAccessToken = accessToken
    let tweet

    try {
      tweet = await postTweet(text, currentAccessToken, { replyToTweetId })
    } catch (error: any) {
      if (error?.code === 401) {
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
        tweet = await postTweet(text, currentAccessToken, { replyToTweetId })
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
      original_tweet_id: replyToTweetId,
      retweet_type: null, // reply, not retweet
    })

    return { success: true, tweetId: tweet.id }
  } catch (e: any) {
    console.error("postReply error:", e)
    return { success: false, error: e.message || "リプライの投稿に失敗しました" }
  }
}

// Schedule reply
export async function scheduleReply(
  userId: string,
  replyToTweetId: string,
  text: string,
  scheduledFor: Date,
  twitterAccountId?: string
): Promise<{ success: boolean; postHistoryId?: string; error?: string }> {
  try {
    const supabase = createServerClient()
    
    const { data: row, error } = await supabase
      .from("post_history")
      .insert({
        user_id: userId,
        text,
        hashtags: [],
        naturalness_score: null,
        trend: null,
        purpose: "reply",
        status: "scheduled",
        scheduled_for: scheduledFor.toISOString(),
        original_tweet_id: replyToTweetId,
        retweet_type: null, // reply
        twitter_account_id: twitterAccountId || null,
      })
      .select("id")
      .single()

    if (error) {
      console.error("scheduleReply insert error:", error)
      return { success: false, error: "リプライの予約に失敗しました。" }
    }
    return { success: true, postHistoryId: row.id }
  } catch (e) {
    console.error("scheduleReply error:", e)
    return {
      success: false,
      error: e instanceof Error ? e.message : "リプライの予約に失敗しました。",
    }
  }
}
