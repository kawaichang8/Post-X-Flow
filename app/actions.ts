"use server"

import { generatePosts, PostDraft, improveTweetText, ImprovedText, factCheckDraft } from "@/lib/ai-generator"
import { createServerClient } from "@/lib/supabase"
import { getPromotionSettingsForGeneration } from "@/app/actions-promotion"
import { postTweet, getTweetEngagement, getTrendingTopics, Trend, refreshTwitterAccessToken, uploadMedia, searchPlaces, Place, getAppOnlyBearerToken, getPersonalizedTrends } from "@/lib/x-post"
import { generateEyeCatchImage, generateImageVariations, downloadImageAsBuffer, GeneratedImage } from "@/lib/image-generator"
import { fetchNewsTrends } from "@/lib/external-apis"
import { classifyError, logErrorToSentry, AppError, ErrorType } from "@/lib/error-handler"

interface PostHistoryItem {
  id: string
  text: string
  hashtags: string[]
  naturalness_score: number
  trend: string | null
  purpose: string | null
  status: 'draft' | 'posted' | 'scheduled' | 'deleted'
  tweet_id: string | null
  scheduled_for: string | null
  engagement_score: number | null
  impression_count: number | null
  reach_count: number | null
  engagement_rate: number | null
  like_count: number
  retweet_count: number
  reply_count: number
  quote_count: number
  created_at: string
  twitter_account_id: string | null
  twitter_account?: {
    username: string | null
    display_name: string | null
    account_name: string | null
  } | null
}

const PROMOTION_NATURALNESS_PENALTY = 3

/** Extended draft with optional fact-check result (for UI and analytics) */
export type PostDraftWithMeta = PostDraft & { factScore?: number; factSuggestions?: string[] }

/**
 * Fetch user's recent posts for RAG context (theme/intro flow)
 */
export async function getRecentPostsForContext(userId: string, limit: number = 8): Promise<string> {
  try {
    const supabaseAdmin = createServerClient()
    const { data, error } = await supabaseAdmin
      .from("post_history")
      .select("text, created_at")
      .eq("user_id", userId)
      .in("status", ["posted", "draft"])
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error || !data?.length) return ""
    return data
      .map((row: { text: string; created_at: string }, i: number) => {
        const d = new Date(row.created_at)
        const dateStr = d.toLocaleDateString("ja-JP", { month: "short", day: "numeric" })
        return `${i + 1}. (${dateStr}) ${(row.text || "").slice(0, 200)}${(row.text || "").length > 200 ? "…" : ""}`
      })
      .join("\n")
  } catch (e) {
    console.error("getRecentPostsForContext error:", e)
    return ""
  }
}

export async function generatePostDrafts(
  trend: string,
  purpose: string,
  options?: {
    userId?: string
    aiProvider?: 'grok' | 'claude'
    enableHumor?: boolean
    enableRealtimeKnowledge?: boolean
    realtimeTrends?: string[]
    contextMode?: boolean
    factCheck?: boolean
  }
): Promise<PostDraftWithMeta[]> {
  try {
    let pastPostsContext: string | undefined
    if (options?.contextMode && options?.userId) {
      pastPostsContext = await getRecentPostsForContext(options.userId, 8)
    }

    const drafts = await generatePosts({
      trend,
      purpose,
      aiProvider: options?.aiProvider || 'grok',
      enableHumor: options?.enableHumor || false,
      enableRealtimeKnowledge: options?.enableRealtimeKnowledge || false,
      realtimeTrends: options?.realtimeTrends || [],
      pastPostsContext: pastPostsContext || undefined,
    })

    let result: PostDraftWithMeta[] = drafts.map((d) => ({ ...d }))

    const promo = options?.userId
      ? await getPromotionSettingsForGeneration(options.userId)
      : null
    if (promo?.enabled && promo?.link_url) {
      const suffix = promo.template.replace(/\[link\]/g, promo.link_url).trim()
      result = result.map((d) => {
        const text = `${d.text}\n\n${suffix}`
        const naturalnessScore = Math.max(0, (d.naturalnessScore ?? 0) - PROMOTION_NATURALNESS_PENALTY)
        return { ...d, text, naturalnessScore }
      })
    }

    if (options?.factCheck) {
      const aiProvider = (options?.aiProvider || 'grok') as 'grok' | 'claude'
      const checked = await Promise.all(
        result.map(async (d) => {
          const fc = await factCheckDraft(d.text, aiProvider)
          return { ...d, factScore: fc.score, factSuggestions: fc.suggestions }
        })
      )
      result = checked
    }

    return result
  } catch (error) {
    console.error("Error generating drafts:", error)
    throw error
  }
}

/** AB test: generate 2–3 variations (different hooks/formats) with a shared ab_test_id for comparison in analytics */
export async function generatePostDraftsAB(
  trend: string,
  purpose: string,
  options?: {
    userId?: string
    aiProvider?: 'grok' | 'claude'
    contextMode?: boolean
    factCheck?: boolean
  }
): Promise<{ drafts: PostDraftWithMeta[]; abTestId: string }> {
  const drafts = await generatePostDrafts(trend, purpose, {
    userId: options?.userId,
    aiProvider: options?.aiProvider || 'grok',
    contextMode: options?.contextMode,
    factCheck: options?.factCheck,
  })
  const abTestId = crypto.randomUUID()
  const variations = drafts.slice(0, 3)
  return { drafts: variations, abTestId }
}

export async function savePostToHistory(
  userId: string,
  draft: PostDraft,
  trend: string,
  purpose: string,
  status: 'draft' | 'posted' | 'scheduled' = 'draft',
  options?: { abTestId?: string; contextUsed?: boolean; factScore?: number }
) {
  try {
    // Use service role client to bypass RLS in Server Actions
    const supabaseAdmin = createServerClient()
    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      text: draft.text,
      hashtags: draft.hashtags,
      naturalness_score: draft.naturalnessScore,
      trend: trend,
      purpose: purpose,
      status: status,
    }
    if (options?.abTestId) insertPayload.ab_test_id = options.abTestId
    if (options?.contextUsed != null) insertPayload.context_used = options.contextUsed
    if (options?.factScore != null) insertPayload.fact_score = options.factScore
    const { data, error } = await supabaseAdmin.from("post_history").insert(insertPayload).select().single()

    if (error) {
      const appError = classifyError(error)
      logErrorToSentry(appError, {
        action: 'savePostToHistory',
        userId,
        status,
      })
      
      // DB接続エラーの場合は、エラーをスローしてクライアント側でローカルストレージに保存
      if (appError.type === ErrorType.DATABASE_ERROR) {
        throw appError
      }
      
      throw appError
    }

    return data
  } catch (error: any) {
    const appError = (error?.type && error?.message) ? error as AppError : classifyError(error)
    logErrorToSentry(appError, {
      action: 'savePostToHistory',
      userId,
      status,
    })
    throw appError
  }
}

export async function approveAndPostTweet(
  userId: string,
  draft: PostDraft,
  accessToken: string,
  trend: string,
  purpose: string,
  twitterAccountId?: string,
  options?: { skipSaveToHistory?: boolean; abTestId?: string; contextUsed?: boolean; factScore?: number }
): Promise<{ success: boolean; tweetId?: string; error?: string; retryable?: boolean; retryAfter?: number }> {
  try {
    // Try to post to Twitter
    let tweet
    let currentAccessToken = accessToken
    
    try {
      tweet = await postTweet(draft.text, currentAccessToken, {})
    } catch (error: any) {
      const appError = classifyError(error)
      
      // If 401 error, try to refresh token
      if (appError.type === ErrorType.AUTH_ERROR && appError.statusCode === 401) {
        console.log("[Post Tweet] Access token expired, attempting to refresh...")
        
        try {
          // Get refresh token from database for the specific account
          const supabaseAdmin = createServerClient()
          let query = supabaseAdmin
            .from("user_twitter_tokens")
            .select("refresh_token")
            .eq("user_id", userId)
          
          // If twitterAccountId is provided, use it to get the specific account's token
          if (twitterAccountId) {
            query = query.eq("id", twitterAccountId)
          }
          
          const { data: tokenData, error: tokenError } = await query.single()

          if (tokenError || !tokenData?.refresh_token) {
            const dbError = classifyError(tokenError || new Error('Refresh token not found'))
            logErrorToSentry(dbError, {
              action: 'approveAndPostTweet',
              step: 'get_refresh_token',
              userId,
              twitterAccountId,
            })
            return {
              success: false,
              error: 'Twitter認証エラー: リフレッシュトークンが見つかりません。Twitter連携を再度行ってください。',
              retryable: false,
            }
          }

          // Refresh access token
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await refreshTwitterAccessToken(tokenData.refresh_token)

          // Update tokens in database for the specific account
          let updateQuery = supabaseAdmin
            .from("user_twitter_tokens")
            .update({
              access_token: newAccessToken,
              refresh_token: newRefreshToken,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
          
          // If twitterAccountId is provided, update only that account
          if (twitterAccountId) {
            updateQuery = updateQuery.eq("id", twitterAccountId)
          }
          
          const { error: updateError } = await updateQuery

          if (updateError) {
            const updateAppError = classifyError(updateError)
            logErrorToSentry(updateAppError, {
              action: 'approveAndPostTweet',
              step: 'update_tokens',
              userId,
              twitterAccountId,
            })
            return {
              success: false,
              error: 'トークンの更新に失敗しました。Twitter連携を再度行ってください。',
              retryable: false,
            }
          }

          console.log("[Post Tweet] Token refreshed, retrying post...")
          // Retry with new access token
          currentAccessToken = newAccessToken
          tweet = await postTweet(draft.text, currentAccessToken, {})
        } catch (refreshError) {
          const refreshAppError = classifyError(refreshError)
          logErrorToSentry(refreshAppError, {
            action: 'approveAndPostTweet',
            step: 'refresh_token',
            userId,
            twitterAccountId,
          })
          return {
            success: false,
            error: refreshAppError.message,
            retryable: refreshAppError.retryable,
            retryAfter: refreshAppError.retryAfter,
          }
        }
      } else {
        // レート制限やその他のエラー
        logErrorToSentry(appError, {
          action: 'approveAndPostTweet',
          step: 'post_tweet',
          userId,
          twitterAccountId,
        })
        return {
          success: false,
          error: appError.message,
          retryable: appError.retryable,
          retryAfter: appError.retryAfter,
        }
      }
    }

    // Get initial engagement (may be 0 for new tweets)
    let engagementScore = 0
    let impressionCount: number | null = null
    let reachCount: number | null = null
    let engagementRate: number | null = null
    let likeCount = 0
    let retweetCount = 0
    let replyCount = 0
    let quoteCount = 0

    try {
      const engagement = await getTweetEngagement(tweet.id, currentAccessToken)
      if (engagement) {
        engagementScore = engagement.engagementScore
        impressionCount = engagement.impressionCount
        reachCount = engagement.reachCount
        engagementRate = engagement.engagementRate
        likeCount = engagement.likeCount
        retweetCount = engagement.retweetCount
        replyCount = engagement.replyCount
        quoteCount = engagement.quoteCount
      }
    } catch (error) {
      console.error("Error fetching initial engagement (this is OK for new tweets):", error)
      // Continue even if engagement fetch fails (new tweets may not have metrics yet)
    }

    // Save to history (skip when posting a scheduled tweet — we update that row instead)
    if (!options?.skipSaveToHistory) {
      try {
        const supabaseAdmin = createServerClient()
        const insertPayload: Record<string, unknown> = {
          user_id: userId,
          twitter_account_id: twitterAccountId || null,
          text: draft.text,
          hashtags: draft.hashtags,
          naturalness_score: draft.naturalnessScore,
          trend: trend,
          purpose: purpose,
          status: "posted",
          tweet_id: tweet.id,
          engagement_score: engagementScore,
          impression_count: impressionCount,
          reach_count: reachCount,
          engagement_rate: engagementRate,
          like_count: likeCount,
          retweet_count: retweetCount,
          reply_count: replyCount,
          quote_count: quoteCount,
        }
        if (options?.abTestId) insertPayload.ab_test_id = options.abTestId
        if (options?.contextUsed != null) insertPayload.context_used = options.contextUsed
        if (options?.factScore != null) insertPayload.fact_score = options.factScore
        const { error } = await supabaseAdmin.from("post_history").insert(insertPayload)

        if (error) {
          const dbError = classifyError(error)
          logErrorToSentry(dbError, {
            action: 'approveAndPostTweet',
            step: 'save_to_history',
            userId,
            twitterAccountId,
          })
          // DBエラーでも投稿は成功しているので、警告のみ
          console.warn("[Post Tweet] Failed to save to history:", dbError.message)
        }
      } catch (dbError) {
        const appError = classifyError(dbError)
        logErrorToSentry(appError, {
          action: 'approveAndPostTweet',
          step: 'save_to_history',
          userId,
          twitterAccountId,
        })
        // DBエラーでも投稿は成功しているので、警告のみ
        console.warn("[Post Tweet] Failed to save to history:", appError.message)
      }
    }

    return { success: true, tweetId: tweet.id, retryable: false }
  } catch (error: any) {
    const appError = (error?.type && error?.message) ? error as AppError : classifyError(error)
    logErrorToSentry(appError, {
      action: 'approveAndPostTweet',
      step: 'unknown',
      userId,
      twitterAccountId,
    })
    
    // エラーが既にAppError形式で返されている場合はそのまま返す
    if (error?.type && error?.message) {
      return {
        success: false,
        error: appError.message,
        retryable: appError.retryable,
        retryAfter: appError.retryAfter,
      }
    }
    
    return {
      success: false,
      error: appError.message,
      retryable: appError.retryable,
      retryAfter: appError.retryAfter,
    }
  }
}

// Post tweet with optional image
export async function approveAndPostTweetWithImage(
  userId: string,
  draft: PostDraft,
  accessToken: string,
  trend: string,
  purpose: string,
  imageUrl?: string,
  twitterAccountId?: string
): Promise<{ success: boolean; tweetId?: string; error?: string; retryable?: boolean; retryAfter?: number }> {
  try {
    const { postTweet, getTweetEngagement, refreshTwitterAccessToken, uploadMedia } = await import("@/lib/x-post")
    const { downloadImageAsBuffer } = await import("@/lib/image-generator")
    
    let mediaIds: string[] | undefined

    // Upload image if provided
    if (imageUrl) {
      try {
        const imageBuffer = await downloadImageAsBuffer(imageUrl)
        const mediaId = await uploadMedia(imageBuffer, accessToken, 'image/jpeg')
        mediaIds = [mediaId]
      } catch (error) {
        console.error('Error uploading image, posting without image:', error)
        // Continue without image if upload fails
      }
    }

    // Try to post to Twitter
    let tweet
    let currentAccessToken = accessToken
    
    try {
      tweet = await postTweet(draft.text, currentAccessToken, { mediaIds })
    } catch (error: any) {
      // If 401 error, try to refresh token
      if (error?.code === 401) {
        console.log("[Post Tweet with Image] Access token expired, attempting to refresh...")
        
        // Get refresh token from database for the specific account
        const supabaseAdmin = createServerClient()
        let query = supabaseAdmin
          .from("user_twitter_tokens")
          .select("refresh_token")
          .eq("user_id", userId)
        
        // If twitterAccountId is provided, use it to get the specific account's token
        if (twitterAccountId) {
          query = query.eq("id", twitterAccountId)
        }
        
        const { data: tokenData, error: tokenError } = await query.single()

        if (tokenError || !tokenData?.refresh_token) {
          throw new Error('Twitter認証エラー: リフレッシュトークンが見つかりません。Twitter連携を再度行ってください。')
        }

        // Refresh access token
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await refreshTwitterAccessToken(tokenData.refresh_token)

        // Update tokens in database for the specific account
        let updateQuery = supabaseAdmin
          .from("user_twitter_tokens")
          .update({
            access_token: newAccessToken,
            refresh_token: newRefreshToken,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
        
        // If twitterAccountId is provided, update only that account
        if (twitterAccountId) {
          updateQuery = updateQuery.eq("id", twitterAccountId)
        }
        
        const { error: updateError } = await updateQuery

        if (updateError) {
          console.error("[Post Tweet with Image] Error updating refreshed tokens:", updateError)
          throw new Error('トークンの更新に失敗しました。Twitter連携を再度行ってください。')
        }

        console.log("[Post Tweet with Image] Token refreshed, retrying post...")
        // Retry with new access token
        currentAccessToken = newAccessToken
        
        // Re-upload image with new token if needed
        if (imageUrl && !mediaIds) {
          try {
            const imageBuffer = await downloadImageAsBuffer(imageUrl)
            const mediaId = await uploadMedia(imageBuffer, currentAccessToken, 'image/jpeg')
            mediaIds = [mediaId]
          } catch (error) {
            console.error('Error uploading image with refreshed token:', error)
          }
        }
        
        tweet = await postTweet(draft.text, currentAccessToken, { mediaIds })
      } else {
        throw error
      }
    }

    // Get initial engagement
    let engagementScore = 0
    let impressionCount: number | null = null
    let reachCount: number | null = null
    let engagementRate: number | null = null
    let likeCount = 0
    let retweetCount = 0
    let replyCount = 0
    let quoteCount = 0

    try {
      const engagement = await getTweetEngagement(tweet.id, currentAccessToken)
      if (engagement) {
        engagementScore = engagement.engagementScore
        impressionCount = engagement.impressionCount
        reachCount = engagement.reachCount
        engagementRate = engagement.engagementRate
        likeCount = engagement.likeCount
        retweetCount = engagement.retweetCount
        replyCount = engagement.replyCount
        quoteCount = engagement.quoteCount
      }
    } catch (error) {
      console.error("Error fetching initial engagement (this is OK for new tweets):", error)
    }

    // Save to history
    const supabaseAdmin = createServerClient()
    const { error } = await supabaseAdmin.from("post_history").insert({
      user_id: userId,
      twitter_account_id: twitterAccountId || null,
      text: draft.text,
      hashtags: draft.hashtags,
      naturalness_score: draft.naturalnessScore,
      trend: trend,
      purpose: purpose,
      status: "posted",
      tweet_id: tweet.id,
      engagement_score: engagementScore,
      impression_count: impressionCount,
      reach_count: reachCount,
      engagement_rate: engagementRate,
      like_count: likeCount,
      retweet_count: retweetCount,
      reply_count: replyCount,
      quote_count: quoteCount,
    })

    if (error) throw error

    return { success: true, tweetId: tweet.id, retryable: false }
  } catch (error: any) {
    console.error("Error posting tweet with image:", error)
    const errorMessage = error instanceof Error ? error.message : "投稿に失敗しました"
    return { 
      success: false, 
      error: errorMessage 
    }
  }
}

// Update engagement for a specific tweet
export async function updateTweetEngagement(
  tweetId: string,
  accessToken: string
): Promise<{ 
  success: boolean
  engagementScore: number
  impressionCount: number | null
  reachCount: number | null
  engagementRate: number | null
  likeCount: number
  retweetCount: number
  replyCount: number
  quoteCount: number
}> {
  try {
    const engagement = await getTweetEngagement(tweetId, accessToken)
    
    if (!engagement) {
      return { 
        success: false, 
        engagementScore: 0,
        impressionCount: null,
        reachCount: null,
        engagementRate: null,
        likeCount: 0,
        retweetCount: 0,
        replyCount: 0,
        quoteCount: 0,
      }
    }

    // Update engagement in database
    const supabaseAdmin = createServerClient()
    const { error } = await supabaseAdmin
      .from("post_history")
      .update({ 
        engagement_score: engagement.engagementScore,
        impression_count: engagement.impressionCount,
        reach_count: engagement.reachCount,
        engagement_rate: engagement.engagementRate,
        like_count: engagement.likeCount,
        retweet_count: engagement.retweetCount,
        reply_count: engagement.replyCount,
        quote_count: engagement.quoteCount,
      })
      .eq("tweet_id", tweetId)

    if (error) throw error

    return { 
      success: true, 
      engagementScore: engagement.engagementScore,
      impressionCount: engagement.impressionCount,
      reachCount: engagement.reachCount,
      engagementRate: engagement.engagementRate,
      likeCount: engagement.likeCount,
      retweetCount: engagement.retweetCount,
      replyCount: engagement.replyCount,
      quoteCount: engagement.quoteCount,
    }
  } catch (error) {
    console.error("Error updating tweet engagement:", error)
    return { 
      success: false, 
      engagementScore: 0,
      impressionCount: null,
      reachCount: null,
      engagementRate: null,
      likeCount: 0,
      retweetCount: 0,
      replyCount: 0,
      quoteCount: 0,
    }
  }
}

// Rate limit: max tweets to update per run (X API limit safety)
const ENGAGEMENT_SYNC_MAX_PER_RUN = 15
const ENGAGEMENT_SYNC_DELAY_MS = 200

// Update engagement for all posted tweets of a user (rate-limited)
export async function updateAllTweetEngagements(
  userId: string,
  accessToken: string
): Promise<{ updated: number; failed: number }> {
  try {
    const supabaseAdmin = createServerClient()

    const { data: postedTweets, error: fetchError } = await supabaseAdmin
      .from("post_history")
      .select("tweet_id")
      .eq("user_id", userId)
      .eq("status", "posted")
      .not("tweet_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(ENGAGEMENT_SYNC_MAX_PER_RUN)

    if (fetchError) throw fetchError

    let updated = 0
    let failed = 0

    for (const post of postedTweets || []) {
      if (!post.tweet_id) continue
      try {
        const result = await updateTweetEngagement(post.tweet_id, accessToken)
        if (result.success) updated++
        else failed++
        await new Promise((r) => setTimeout(r, ENGAGEMENT_SYNC_DELAY_MS))
      } catch (error) {
        console.error(`Error updating engagement for tweet ${post.tweet_id}:`, error)
        failed++
      }
    }

    return { updated, failed }
  } catch (error) {
    console.error("Error updating all tweet engagements:", error)
    return { updated: 0, failed: 0 }
  }
}

// Get trending topics for a user (throws when API fails - no fallback to static list)
export async function getTrends(accessToken: string): Promise<Trend[]> {
  const trends = await getTrendingTopics(accessToken)
  return trends
}

// Get trending topics for the current user.
// 日本トレンドを優先: 1) WOEID 日本 (Bearer), 2) personalized_trends, 3) News API (jp).
// Returns { trends, error? } so the client gets a 200 with error message instead of 500.
export async function getTrendsForUser(
  userId: string,
  accountId?: string
): Promise<{ trends: Trend[]; error?: string }> {
  try {
    const supabaseAdmin = createServerClient()

    // 1. WOEID 日本を最優先（Bearer Token があれば日本のトレンド＝日本語・日本向け）
    try {
      const bearerToken = await getAppOnlyBearerToken()
      if (bearerToken) {
        console.log("[getTrendsForUser] Trying WOEID Japan (23424856) with Bearer token...")
        const trends = await getTrends(bearerToken)
        if (trends.length > 0) {
          return { trends }
        }
      }
    } catch (woeidError) {
      console.warn("[getTrendsForUser] WOEID Japan failed:", woeidError)
    }

    // 2. ユーザートークンで personalized_trends を試す（アカウントの言語・地域に依存）
    const accountQuery = supabaseAdmin
      .from("user_twitter_tokens")
      .select("id, access_token, refresh_token")
      .eq("user_id", userId)
    const { data: account } = accountId
      ? await accountQuery.eq("id", accountId).maybeSingle()
      : await accountQuery.eq("is_default", true).maybeSingle()

    if (account?.access_token) {
      try {
        console.log("[getTrendsForUser] Trying personalized_trends with user token...")
        const trends = await getPersonalizedTrends(account.access_token)
        if (trends.length > 0) {
          return { trends }
        }
      } catch (personalizedError) {
        console.warn("[getTrendsForUser] personalized_trends failed:", personalizedError)
      }
    }

    // 3. X API 両方失敗時: News API で代用（日本トップニュースからトレンド候補を取得）
    const newsApiKey = process.env.NEWS_API_KEY?.trim()
    if (newsApiKey) {
      try {
        console.log("[getTrendsForUser] Falling back to News API...")
        const newsInsight = await fetchNewsTrends(newsApiKey, "jp")
        if (newsInsight?.trendingTopics && newsInsight.trendingTopics.length > 0) {
          const trends: Trend[] = newsInsight.trendingTopics.slice(0, 15).map((name) => ({
            name,
            query: name,
            tweetVolume: null,
          }))
          return {
            trends,
            error: "Xのトレンドは利用できませんでした。ニュースの話題を表示しています。",
          }
        }
      } catch (newsError) {
        console.warn("[getTrendsForUser] News API fallback failed:", newsError)
      }
    }

    // どれも失敗した場合
    return {
      trends: [],
      error: "トレンド取得に失敗しました。Free プランでは X API のトレンドが制限されている場合があります。NEWS_API_KEY を設定するとニュースの話題で代用できます。トレンド欄にハッシュタグを手動で入力して投稿することもできます。",
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "トレンドの取得に失敗しました。"
    console.error("[getTrendsForUser]", message, e)
    return { trends: [], error: message }
  }
}

// Get unique purposes used by a user (for suggestions)
export async function getUserPurposes(userId: string): Promise<string[]> {
  try {
    const supabaseAdmin = createServerClient()
    const { data, error } = await supabaseAdmin
      .from("post_history")
      .select("purpose")
      .eq("user_id", userId)
      .not("purpose", "is", null)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) throw error

    // Get unique purposes, most recent first
    const uniquePurposes = Array.from(
      new Set((data || []).map((item: { purpose: string | null }) => item.purpose).filter(Boolean))
    ) as string[]

    return uniquePurposes
  } catch (error) {
    console.error("Error fetching user purposes:", error)
    return []
  }
}

// Get scheduled tweets
export async function getScheduledTweets(userId: string) {
  try {
    const supabaseAdmin = createServerClient()
    const { data, error } = await supabaseAdmin
      .from("post_history")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .order("scheduled_for", { ascending: true })

    if (error) throw error

    return data || []
  } catch (error) {
    console.error("Error fetching scheduled tweets:", error)
    return []
  }
}

// Update scheduled tweet
export async function updateScheduledTweet(
  postId: string,
  scheduledFor: Date
) {
  try {
    const supabaseAdmin = createServerClient()
    const { error } = await supabaseAdmin
      .from("post_history")
      .update({ scheduled_for: scheduledFor.toISOString() })
      .eq("id", postId)
      .eq("status", "scheduled")

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error updating scheduled tweet:", error)
    throw error
  }
}

// Delete scheduled tweet
export async function deleteScheduledTweet(postId: string) {
  try {
    const supabaseAdmin = createServerClient()
    const { error } = await supabaseAdmin
      .from("post_history")
      .update({ status: "deleted" })
      .eq("id", postId)
      .eq("status", "scheduled")

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error deleting scheduled tweet:", error)
    throw error
  }
}

// Post a scheduled tweet now (semi-auto: user clicks "投稿する" when notified)
export async function postScheduledTweet(
  userId: string,
  postHistoryId: string,
  twitterAccountId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseAdmin = createServerClient()

    const { data: post, error: postError } = await supabaseAdmin
      .from("post_history")
      .select("id, text, hashtags, naturalness_score, trend, purpose, original_tweet_id, retweet_type")
      .eq("id", postHistoryId)
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .maybeSingle()

    if (postError || !post) {
      return { success: false, error: "予約投稿が見つかりませんでした。" }
    }

    const accountId = twitterAccountId || undefined
    const accountQuery = supabaseAdmin
      .from("user_twitter_tokens")
      .select("id, access_token, refresh_token")
      .eq("user_id", userId)
    const { data: account, error: accountError } = accountId
      ? await accountQuery.eq("id", accountId).maybeSingle()
      : await accountQuery.eq("is_default", true).maybeSingle()

    if (accountError || !account?.access_token) {
      return { success: false, error: "X連携アカウントのトークンを取得できませんでした。X連携をやり直してください。" }
    }

    let tweetId: string | null = null

    // Scheduled retweet (auto-retweet): simple RT or quote RT
    if (post.original_tweet_id && (post.retweet_type === "simple" || post.retweet_type === "quote")) {
      const { postRetweet, postTweet: postTweetFn, refreshTwitterAccessToken } = await import("@/lib/x-post")
      let accessToken = account.access_token
      try {
        if (post.retweet_type === "simple") {
          const ret = await postRetweet(post.original_tweet_id, accessToken)
          tweetId = null // simple RT doesn't return a new tweet id for the RT itself
        } else {
          const comment = (post.text || "").trim() || "👍"
          const result = await postTweetFn(comment, accessToken, { quoteTweetId: post.original_tweet_id })
          tweetId = result.id
        }
      } catch (err: unknown) {
        if (err && typeof err === "object" && "code" in err && (err as { code?: number }).code === 401) {
          const { data: tokenData } = await supabaseAdmin
            .from("user_twitter_tokens")
            .select("refresh_token")
            .eq("user_id", userId)
            .eq("id", account.id)
            .single()
          if (tokenData?.refresh_token) {
            const { accessToken: newToken, refreshToken: newRefresh } = await refreshTwitterAccessToken(tokenData.refresh_token)
            await supabaseAdmin
              .from("user_twitter_tokens")
              .update({ access_token: newToken, refresh_token: newRefresh, updated_at: new Date().toISOString() })
              .eq("id", account.id)
            accessToken = newToken
            if (post.retweet_type === "simple") {
              await postRetweet(post.original_tweet_id, accessToken)
            } else {
              const comment = (post.text || "").trim() || "👍"
              const result = await postTweetFn(comment, accessToken, { quoteTweetId: post.original_tweet_id })
              tweetId = result.id
            }
          } else {
            return { success: false, error: "Twitter認証エラー。再連携してください。" }
          }
        } else {
          const msg = err instanceof Error ? err.message : "リツイートに失敗しました。"
          return { success: false, error: msg }
        }
      }
    } else {
      const draft: PostDraft = {
        text: post.text,
        hashtags: post.hashtags || [],
        naturalnessScore: post.naturalness_score ?? 0,
      }
      const result = await approveAndPostTweet(
        userId,
        draft,
        account.access_token,
        post.trend || "",
        post.purpose || "",
        account.id,
        { skipSaveToHistory: true }
      )
      if (!result.success) {
        return { success: false, error: result.error || "投稿に失敗しました。" }
      }
      tweetId = result.tweetId || null
    }

    await supabaseAdmin
      .from("post_history")
      .update({
        status: "posted",
        tweet_id: tweetId,
        twitter_account_id: account.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postHistoryId)
      .eq("user_id", userId)
      .eq("status", "scheduled")

    return { success: true }
  } catch (error) {
    console.error("Error posting scheduled tweet:", error)
    const message = error instanceof Error ? error.message : "投稿中にエラーが発生しました。"
    return { success: false, error: message }
  }
}

export async function scheduleTweet(
  userId: string,
  draft: PostDraft,
  scheduleFor: Date,
  trend: string,
  purpose: string,
  options?: { abTestId?: string; contextUsed?: boolean; factScore?: number }
) {
  try {
    // Use service role client to bypass RLS in Server Actions
    const supabaseAdmin = createServerClient()
    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      text: draft.text,
      hashtags: draft.hashtags,
      naturalness_score: draft.naturalnessScore,
      trend: trend,
      purpose: purpose,
      status: "scheduled",
      scheduled_for: scheduleFor.toISOString(),
    }
    if (options?.abTestId) insertPayload.ab_test_id = options.abTestId
    if (options?.contextUsed != null) insertPayload.context_used = options.contextUsed
    if (options?.factScore != null) insertPayload.fact_score = options.factScore
    const { error } = await supabaseAdmin.from("post_history").insert(insertPayload)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error scheduling tweet:", error)
    throw error
  }
}

export async function getHighEngagementPosts(userId: string) {
  try {
    // Use service role client to bypass RLS in Server Actions
    const supabaseAdmin = createServerClient()
    // Get posts with high engagement (you can add engagement metrics later)
    const { data, error } = await supabaseAdmin
      .from("post_history")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "posted")
      .order("created_at", { ascending: false })
      .limit(10)

    if (error) throw error

    return data || []
  } catch (error) {
    console.error("Error fetching high engagement posts:", error)
    return []
  }
}

export interface PaginationParams {
  page?: number
  pageSize?: number
  offset?: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasMore: boolean
}

export async function getPostHistory(
  userId: string, 
  limit: number = 50, 
  accountId?: string,
  pagination?: PaginationParams
): Promise<PostHistoryItem[]> {
  try {
    // Use service role client to bypass RLS in Server Actions
    const supabaseAdmin = createServerClient()
    let query = supabaseAdmin
      .from("post_history")
      .select(`
        *,
        twitter_account:user_twitter_tokens!post_history_twitter_account_id_fkey(
          username,
          display_name,
          account_name
        )
      `, { count: pagination ? 'exact' : undefined })
      .eq("user_id", userId)
    
    // Filter by account if specified
    if (accountId) {
      query = query.eq("twitter_account_id", accountId)
    }
    
    // Apply pagination
    if (pagination) {
      const page = pagination.page || 1
      const pageSize = pagination.pageSize || limit
      const offset = pagination.offset ?? (page - 1) * pageSize
      query = query.range(offset, offset + pageSize - 1)
    } else {
      query = query.limit(limit)
    }
    
    const { data, error, count } = await query
      .order("created_at", { ascending: false })

    if (error) throw error

    // Transform data to include account info
    return (data || []).map((item: any) => ({
      ...item,
      twitter_account: item.twitter_account || null
    }))
  } catch (error) {
    console.error("Error fetching post history:", error)
    return []
  }
}

/**
 * Get paginated post history with total count
 */
export async function getPostHistoryPaginated(
  userId: string,
  options: {
    page?: number
    pageSize?: number
    accountId?: string
    status?: string
    searchQuery?: string
  } = {}
): Promise<PaginatedResult<PostHistoryItem>> {
  try {
    const { page = 1, pageSize = 20, accountId, status, searchQuery } = options
    const supabaseAdmin = createServerClient()
    
    let query = supabaseAdmin
      .from("post_history")
      .select(`
        *,
        twitter_account:user_twitter_tokens!post_history_twitter_account_id_fkey(
          username,
          display_name,
          account_name
        )
      `, { count: 'exact' })
      .eq("user_id", userId)
    
    // Apply filters
    if (accountId) {
      query = query.eq("twitter_account_id", accountId)
    }
    if (status && status !== 'all') {
      query = query.eq("status", status)
    }
    if (searchQuery) {
      query = query.or(`text.ilike.%${searchQuery}%,hashtags.cs.{${searchQuery}}`)
    }
    
    // Apply pagination
    const offset = (page - 1) * pageSize
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) throw error

    const total = count || 0
    const totalPages = Math.ceil(total / pageSize)

    return {
      data: (data || []).map((item: any) => ({
        ...item,
        twitter_account: item.twitter_account ? {
          username: item.twitter_account.username,
          display_name: item.twitter_account.display_name,
          account_name: item.twitter_account.account_name,
        } : null,
      })) as PostHistoryItem[],
      total,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages,
    }
  } catch (error) {
    console.error("Error fetching paginated post history:", error)
    throw error
  }
}

export interface PostPerformanceStats {
  totalPosts: number
  postedCount: number
  draftCount: number
  scheduledCount: number
  averageEngagement: number
  highestEngagement: number
  weeklyPosts: number
  monthlyPosts: number
  totalImpressions: number
  averageImpressions: number
  totalReach: number
  averageEngagementRate: number
  topPost: {
    id: string
    text: string
    engagement_score: number
    impression_count: number | null
    engagement_rate: number | null
    created_at: string
  } | null
  hourlyPerformance: {
    hour: number
    averageEngagement: number
    averageImpressions: number
    postCount: number
  }[]
  weekdayPerformance: {
    weekday: number
    averageEngagement: number
    averageImpressions: number
    postCount: number
  }[]
}

export async function getPostPerformanceStats(userId: string): Promise<PostPerformanceStats> {
  try {
    const supabaseAdmin = createServerClient()
    
    // Get all posts for the user
    const { data: allPosts, error } = await supabaseAdmin
      .from("post_history")
      .select("*")
      .eq("user_id", userId)

    if (error) throw error

    const posts = (allPosts || []) as PostHistoryItem[]
    
    // Calculate statistics
    const totalPosts = posts.length
    const postedCount = posts.filter((p: PostHistoryItem) => p.status === 'posted').length
    const draftCount = posts.filter((p: PostHistoryItem) => p.status === 'draft').length
    const scheduledCount = posts.filter((p: PostHistoryItem) => p.status === 'scheduled').length
    
    // Calculate average engagement (only for posted tweets)
    const postedPosts = posts.filter((p: PostHistoryItem) => p.status === 'posted' && p.engagement_score !== null)
    const averageEngagement = postedPosts.length > 0
      ? Math.round(postedPosts.reduce((sum: number, p: PostHistoryItem) => sum + (p.engagement_score || 0), 0) / postedPosts.length)
      : 0
    
    // Find highest engagement
    const highestEngagement = postedPosts.length > 0
      ? Math.max(...postedPosts.map((p: PostHistoryItem) => p.engagement_score || 0))
      : 0
    
    // Calculate impression statistics
    const postsWithImpressions = postedPosts.filter((p: PostHistoryItem) => p.impression_count !== null && p.impression_count > 0)
    const totalImpressions = postsWithImpressions.reduce((sum: number, p: PostHistoryItem) => sum + (p.impression_count || 0), 0)
    const averageImpressions = postsWithImpressions.length > 0
      ? Math.round(totalImpressions / postsWithImpressions.length)
      : 0
    
    // Calculate reach statistics
    const postsWithReach = postedPosts.filter((p: PostHistoryItem) => p.reach_count !== null && p.reach_count > 0)
    const totalReach = postsWithReach.reduce((sum: number, p: PostHistoryItem) => sum + (p.reach_count || 0), 0)
    
    // Calculate average engagement rate
    const postsWithEngagementRate = postedPosts.filter((p: PostHistoryItem) => p.engagement_rate !== null && p.engagement_rate > 0)
    const averageEngagementRate = postsWithEngagementRate.length > 0
      ? parseFloat((postsWithEngagementRate.reduce((sum: number, p: PostHistoryItem) => sum + (p.engagement_rate || 0), 0) / postsWithEngagementRate.length).toFixed(2))
      : 0
    
    // Find top post (by engagement score, but include impressions)
    const topPostData = postedPosts.length > 0
      ? postedPosts.reduce((top: PostHistoryItem, current: PostHistoryItem) => 
          (current.engagement_score || 0) > (top.engagement_score || 0) ? current : top
        )
      : null
    
    const topPost = topPostData ? {
      id: topPostData.id,
      text: topPostData.text,
      engagement_score: topPostData.engagement_score || 0,
      impression_count: topPostData.impression_count || null,
      engagement_rate: topPostData.engagement_rate || null,
      created_at: topPostData.created_at
    } : null
    
    // Calculate weekly and monthly posts
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    const weeklyPosts = posts.filter((p: PostHistoryItem) => {
      const postDate = new Date(p.created_at)
      return postDate >= weekAgo && p.status === 'posted'
    }).length
    
    const monthlyPosts = posts.filter((p: PostHistoryItem) => {
      const postDate = new Date(p.created_at)
      return postDate >= monthAgo && p.status === 'posted'
    }).length

    // Calculate hourly performance (0-23 hours)
    const hourlyPerformance = Array.from({ length: 24 }, (_, hour) => {
      const hourPosts = postedPosts.filter((p: PostHistoryItem) => {
        const postDate = new Date(p.created_at)
        return postDate.getHours() === hour
      })
      
      if (hourPosts.length === 0) {
        return { hour, averageEngagement: 0, averageImpressions: 0, postCount: 0 }
      }
      
      const avgEngagement = Math.round(
        hourPosts.reduce((sum: number, p: PostHistoryItem) => sum + (p.engagement_score || 0), 0) / hourPosts.length
      )
      
      const hourPostsWithImpressions = hourPosts.filter((p: PostHistoryItem) => p.impression_count !== null && p.impression_count > 0)
      const avgImpressions = hourPostsWithImpressions.length > 0
        ? Math.round(
            hourPostsWithImpressions.reduce((sum: number, p: PostHistoryItem) => sum + (p.impression_count || 0), 0) / hourPostsWithImpressions.length
          )
        : 0
      
      return {
        hour,
        averageEngagement: avgEngagement,
        averageImpressions: avgImpressions,
        postCount: hourPosts.length
      }
    })

    // Calculate weekday performance (0 = Sunday, 6 = Saturday)
    const weekdayPerformance = Array.from({ length: 7 }, (_, weekday) => {
      const weekdayPosts = postedPosts.filter((p: PostHistoryItem) => {
        const postDate = new Date(p.created_at)
        return postDate.getDay() === weekday
      })
      
      if (weekdayPosts.length === 0) {
        return { weekday, averageEngagement: 0, averageImpressions: 0, postCount: 0 }
      }
      
      const avgEngagement = Math.round(
        weekdayPosts.reduce((sum: number, p: PostHistoryItem) => sum + (p.engagement_score || 0), 0) / weekdayPosts.length
      )
      
      const weekdayPostsWithImpressions = weekdayPosts.filter((p: PostHistoryItem) => p.impression_count !== null && p.impression_count > 0)
      const avgImpressions = weekdayPostsWithImpressions.length > 0
        ? Math.round(
            weekdayPostsWithImpressions.reduce((sum: number, p: PostHistoryItem) => sum + (p.impression_count || 0), 0) / weekdayPostsWithImpressions.length
          )
        : 0
      
      return {
        weekday,
        averageEngagement: avgEngagement,
        averageImpressions: avgImpressions,
        postCount: weekdayPosts.length
      }
    })

    return {
      totalPosts,
      postedCount,
      draftCount,
      scheduledCount,
      averageEngagement,
      highestEngagement,
      weeklyPosts,
      monthlyPosts,
      totalImpressions,
      averageImpressions,
      totalReach,
      averageEngagementRate,
      topPost,
      hourlyPerformance,
      weekdayPerformance
    }
  } catch (error) {
    console.error("Error fetching post performance stats:", error)
    return {
      totalPosts: 0,
      postedCount: 0,
      draftCount: 0,
      scheduledCount: 0,
      averageEngagement: 0,
      highestEngagement: 0,
      weeklyPosts: 0,
      monthlyPosts: 0,
      totalImpressions: 0,
      averageImpressions: 0,
      totalReach: 0,
      averageEngagementRate: 0,
      topPost: null,
      hourlyPerformance: [],
      weekdayPerformance: []
    }
  }
}

// Get optimal posting times based on historical performance
export interface OptimalPostingTime {
  date: Date
  hour: number
  weekday: number
  weekdayName: string
  score: number // Combined score based on engagement and impressions
  averageEngagement: number
  averageImpressions: number
  postCount: number
  reason: string // Why this time is optimal
}

export async function getOptimalPostingTimes(
  userId: string,
  count: number = 5
): Promise<OptimalPostingTime[]> {
  try {
    const stats = await getPostPerformanceStats(userId)
    
    if (!stats.hourlyPerformance || !stats.weekdayPerformance) {
      return []
    }

    // Calculate optimal times by combining hourly and weekday performance
    const optimalTimes: OptimalPostingTime[] = []
    const now = new Date()
    
    // Get top performing hours and weekdays
    const topHours = stats.hourlyPerformance
      .filter(h => h.postCount > 0)
      .sort((a, b) => {
        // Sort by engagement score, then by impressions
        const scoreA = a.averageEngagement * 0.7 + (a.averageImpressions / 100) * 0.3
        const scoreB = b.averageEngagement * 0.7 + (b.averageImpressions / 100) * 0.3
        return scoreB - scoreA
      })
      .slice(0, 3) // Top 3 hours

    const topWeekdays = stats.weekdayPerformance
      .filter(w => w.postCount > 0)
      .sort((a, b) => {
        const scoreA = a.averageEngagement * 0.7 + (a.averageImpressions / 100) * 0.3
        const scoreB = b.averageEngagement * 0.7 + (b.averageImpressions / 100) * 0.3
        return scoreB - scoreA
      })
      .slice(0, 3) // Top 3 weekdays

    // Generate optimal times for the next 7 days
    const weekdayNames = ['日', '月', '火', '水', '木', '金', '土']
    
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDate = new Date(now)
      targetDate.setDate(now.getDate() + dayOffset)
      targetDate.setHours(0, 0, 0, 0)
      
      const weekday = targetDate.getDay()
      const weekdayData = stats.weekdayPerformance[weekday]
      
      // Only consider weekdays with good performance
      if (!weekdayData || weekdayData.postCount === 0) continue
      
      // For each top hour, create a suggestion
      for (const hourData of topHours) {
        if (hourData.postCount === 0) continue
        
        const suggestedDate = new Date(targetDate)
        suggestedDate.setHours(hourData.hour, 0, 0, 0)
        
        // Skip if the time has already passed today
        if (dayOffset === 0 && suggestedDate <= now) {
          continue
        }
        
        // Calculate combined score
        const hourScore = hourData.averageEngagement * 0.7 + (hourData.averageImpressions / 100) * 0.3
        const weekdayScore = weekdayData.averageEngagement * 0.7 + (weekdayData.averageImpressions / 100) * 0.3
        const combinedScore = (hourScore * 0.6 + weekdayScore * 0.4)
        
        // Generate reason
        let reason = `${weekdayNames[weekday]}曜日の${hourData.hour}時は`
        if (hourData.averageEngagement > stats.averageEngagement) {
          reason += `平均より${Math.round((hourData.averageEngagement / stats.averageEngagement - 1) * 100)}%高いエンゲージメント`
        }
        if (hourData.averageImpressions > 0 && stats.averageImpressions > 0 && hourData.averageImpressions > stats.averageImpressions) {
          reason += `、インプレッションも${Math.round((hourData.averageImpressions / stats.averageImpressions - 1) * 100)}%多い`
        }
        reason += '傾向があります'
        
        optimalTimes.push({
          date: suggestedDate,
          hour: hourData.hour,
          weekday,
          weekdayName: weekdayNames[weekday],
          score: combinedScore,
          averageEngagement: hourData.averageEngagement,
          averageImpressions: hourData.averageImpressions,
          postCount: hourData.postCount,
          reason,
        })
      }
    }
    
    // Sort by score and return top N
    return optimalTimes
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
  } catch (error) {
    console.error("Error getting optimal posting times:", error)
    return []
  }
}

// Quoted Tweets Management
export interface QuotedTweet {
  id: string
  user_id: string
  title: string
  tweet_text: string
  tweet_url: string | null
  author_name: string | null
  author_handle: string | null
  author_avatar_url: string | null
  tweet_id: string | null
  media_url: string | null
  created_at: string
  updated_at: string
}

export async function getQuotedTweets(userId: string): Promise<QuotedTweet[]> {
  try {
    const supabaseAdmin = createServerClient()
    const { data, error } = await supabaseAdmin
      .from("quoted_tweets")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return data || []
  } catch (error) {
    console.error("Error fetching quoted tweets:", error)
    return []
  }
}

export async function saveQuotedTweet(
  userId: string,
  title: string,
  tweetText: string,
  tweetUrl?: string,
  authorName?: string,
  authorHandle?: string,
  authorAvatarUrl?: string,
  tweetId?: string,
  mediaUrl?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabaseAdmin = createServerClient()
    const { data, error } = await supabaseAdmin
      .from("quoted_tweets")
      .insert({
        user_id: userId,
        title,
        tweet_text: tweetText,
        tweet_url: tweetUrl || null,
        author_name: authorName || null,
        author_handle: authorHandle || null,
        author_avatar_url: authorAvatarUrl || null,
        tweet_id: tweetId || null,
        media_url: mediaUrl || null,
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, id: data.id }
  } catch (error) {
    console.error("Error saving quoted tweet:", error)
    const errorMessage = error instanceof Error ? error.message : "引用ツイートの保存に失敗しました"
    return { success: false, error: errorMessage }
  }
}

export async function deleteQuotedTweet(quotedTweetId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseAdmin = createServerClient()
    const { error } = await supabaseAdmin
      .from("quoted_tweets")
      .delete()
      .eq("id", quotedTweetId)

    if (error) throw error

    return { success: true }
  } catch (error) {
    console.error("Error deleting quoted tweet:", error)
    const errorMessage = error instanceof Error ? error.message : "引用ツイートの削除に失敗しました"
    return { success: false, error: errorMessage }
  }
}

// Post quoted tweet (Server Action)
export async function postQuotedTweet(
  userId: string,
  text: string,
  accessToken: string,
  quoteTweetId: string | null
): Promise<{ success: boolean; tweetId?: string; error?: string; retryable?: boolean; retryAfter?: number }> {
  try {
    const { postTweet, refreshTwitterAccessToken } = await import("@/lib/x-post")
    
    let tweet
    let currentAccessToken = accessToken
    
    try {
      tweet = await postTweet(text, currentAccessToken, { quoteTweetId: quoteTweetId || undefined })
    } catch (error: any) {
      // If 401 error, try to refresh token
      if (error?.code === 401) {
        console.log("[Post Quoted Tweet] Access token expired, attempting to refresh...")
        
        // Get refresh token from database
        const supabaseAdmin = createServerClient()
        const { data: tokenData, error: tokenError } = await supabaseAdmin
          .from("user_twitter_tokens")
          .select("refresh_token")
          .eq("user_id", userId)
          .single()

        if (tokenError || !tokenData?.refresh_token) {
          throw new Error('Twitter認証エラー: リフレッシュトークンが見つかりません。Twitter連携を再度行ってください。')
        }

        // Refresh access token
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await refreshTwitterAccessToken(tokenData.refresh_token)

        // Update tokens in database
        const { error: updateError } = await supabaseAdmin
          .from("user_twitter_tokens")
          .update({
            access_token: newAccessToken,
            refresh_token: newRefreshToken,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)

        if (updateError) {
          console.error("[Post Quoted Tweet] Error updating refreshed tokens:", updateError)
          throw new Error('トークンの更新に失敗しました。Twitter連携を再度行ってください。')
        }

        console.log("[Post Quoted Tweet] Token refreshed, retrying post...")
        // Retry with new access token
        currentAccessToken = newAccessToken
        tweet = await postTweet(text, currentAccessToken, { quoteTweetId: quoteTweetId || undefined })
      } else {
        throw error
      }
    }

    // Get initial engagement
    let engagementScore = 0
    let impressionCount: number | null = null
    let reachCount: number | null = null
    let engagementRate: number | null = null
    let likeCount = 0
    let retweetCount = 0
    let replyCount = 0
    let quoteCount = 0

    try {
      const { getTweetEngagement } = await import("@/lib/x-post")
      const engagement = await getTweetEngagement(tweet.id, currentAccessToken)
      if (engagement) {
        engagementScore = engagement.engagementScore
        impressionCount = engagement.impressionCount
        reachCount = engagement.reachCount
        engagementRate = engagement.engagementRate
        likeCount = engagement.likeCount
        retweetCount = engagement.retweetCount
        replyCount = engagement.replyCount
        quoteCount = engagement.quoteCount
      }
    } catch (error) {
      console.error("Error fetching initial engagement (this is OK for new tweets):", error)
    }

    // Save to history
    const supabaseAdmin = createServerClient()
    const { error } = await supabaseAdmin.from("post_history").insert({
      user_id: userId,
      text,
      hashtags: [],
      naturalness_score: 0,
      trend: "",
      purpose: "Quoted Tweet",
      status: "posted",
      tweet_id: tweet.id,
      engagement_score: engagementScore,
      impression_count: impressionCount,
      reach_count: reachCount,
      engagement_rate: engagementRate,
      like_count: likeCount,
      retweet_count: retweetCount,
      reply_count: replyCount,
      quote_count: quoteCount,
    })

    if (error) throw error

    return { success: true, tweetId: tweet.id, retryable: false }
  } catch (error: any) {
    console.error("Error posting quoted tweet:", error)
    const errorMessage = error instanceof Error ? error.message : "投稿に失敗しました"
    return { 
      success: false, 
      error: errorMessage 
    }
  }
}

// Multiple Twitter Accounts Management
export interface TwitterAccount {
  id: string
  user_id: string
  twitter_user_id: string | null
  username: string | null
  display_name: string | null
  profile_image_url: string | null
  account_name: string | null
  access_token: string
  is_default: boolean
  created_at: string
  updated_at: string
}

// Get all Twitter accounts for a user
export async function getTwitterAccounts(userId: string): Promise<TwitterAccount[]> {
  try {
    const supabaseAdmin = createServerClient()
    const { data, error } = await supabaseAdmin
      .from("user_twitter_tokens")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) throw error
    return (data || []) as TwitterAccount[]
  } catch (error) {
    console.error("Error fetching Twitter accounts:", error)
    return []
  }
}

// Get default Twitter account for a user
export async function getDefaultTwitterAccount(userId: string): Promise<TwitterAccount | null> {
  try {
    const supabaseAdmin = createServerClient()
    const { data, error } = await supabaseAdmin
      .from("user_twitter_tokens")
      .select("*")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') throw error
    return data as TwitterAccount | null
  } catch (error) {
    console.error("Error fetching default Twitter account:", error)
    return null
  }
}

// Get Twitter account by ID
export async function getTwitterAccountById(accountId: string, userId: string): Promise<TwitterAccount | null> {
  try {
    const supabaseAdmin = createServerClient()
    const { data, error } = await supabaseAdmin
      .from("user_twitter_tokens")
      .select("*")
      .eq("id", accountId)
      .eq("user_id", userId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') throw error
    return data as TwitterAccount | null
  } catch (error) {
    console.error("Error fetching Twitter account:", error)
    return null
  }
}

// Set default Twitter account
export async function setDefaultTwitterAccount(accountId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseAdmin = createServerClient()
    
    // First, unset all default flags for this user
    await supabaseAdmin
      .from("user_twitter_tokens")
      .update({ is_default: false })
      .eq("user_id", userId)

    // Then set the selected account as default
    const { error } = await supabaseAdmin
      .from("user_twitter_tokens")
      .update({ is_default: true })
      .eq("id", accountId)
      .eq("user_id", userId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error("Error setting default Twitter account:", error)
    const errorMessage = error instanceof Error ? error.message : "アカウントの設定に失敗しました"
    return { success: false, error: errorMessage }
  }
}

// Delete Twitter account
export async function deleteTwitterAccount(accountId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseAdmin = createServerClient()
    
    // Check if this is the default account
    const { data: account } = await supabaseAdmin
      .from("user_twitter_tokens")
      .select("is_default")
      .eq("id", accountId)
      .eq("user_id", userId)
      .maybeSingle()

    // Delete the account
    const { error } = await supabaseAdmin
      .from("user_twitter_tokens")
      .delete()
      .eq("id", accountId)
      .eq("user_id", userId)

    if (error) throw error

    // If it was the default account, set another one as default
    if (account?.is_default) {
      const { data: remainingAccounts } = await supabaseAdmin
        .from("user_twitter_tokens")
        .select("id")
        .eq("user_id", userId)
        .limit(1)

      if (remainingAccounts && remainingAccounts.length > 0) {
        await supabaseAdmin
          .from("user_twitter_tokens")
          .update({ is_default: true })
          .eq("id", remainingAccounts[0].id)
      }
    }

    return { success: true }
  } catch (error) {
    console.error("Error deleting Twitter account:", error)
    const errorMessage = error instanceof Error ? error.message : "アカウントの削除に失敗しました"
    return { success: false, error: errorMessage }
  }
}

// Update account name
export async function updateTwitterAccountName(accountId: string, userId: string, accountName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseAdmin = createServerClient()
    const { error } = await supabaseAdmin
      .from("user_twitter_tokens")
      .update({ account_name: accountName })
      .eq("id", accountId)
      .eq("user_id", userId)

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error("Error updating account name:", error)
    const errorMessage = error instanceof Error ? error.message : "アカウント名の更新に失敗しました"
    return { success: false, error: errorMessage }
  }
}

// Phase 4: Auto-Improvement Functionality
export interface ImprovementSuggestion {
  postId: string
  originalText: string
  improvedText: string
  reason: string
  expectedImprovement: {
    engagement: number
    impressions: number
  }
  changes: string[] // 変更点のリスト
}

export async function getImprovementSuggestions(
  userId: string,
  limit: number = 5
): Promise<ImprovementSuggestion[]> {
  try {
    const supabaseAdmin = createServerClient()
    
    // Get performance stats to identify low-performing posts
    const stats = await getPostPerformanceStats(userId)
    
    if (!stats || stats.postedCount === 0) {
      return []
    }

    // Get all posted posts with engagement data
    const { data: posts, error } = await supabaseAdmin
      .from("post_history")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "posted")
      .not("engagement_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) throw error
    if (!posts || posts.length === 0) return []

    // Identify low-performing posts (below average engagement or impressions)
    const lowPerformingPosts = posts.filter((post: PostHistoryItem) => {
      const engagement = post.engagement_score || 0
      const impressions = post.impression_count || 0
      
      // Consider low-performing if:
      // 1. Engagement is below average AND below 50% of highest
      // 2. Impressions are below average (if available)
      const isLowEngagement = engagement < stats.averageEngagement * 0.7
      const isLowImpressions = impressions > 0 && impressions < stats.averageImpressions * 0.7
      
      return isLowEngagement || isLowImpressions
    }).slice(0, limit)

    if (lowPerformingPosts.length === 0) {
      return []
    }

    // Generate improvement suggestions using AI
    const suggestions: ImprovementSuggestion[] = []
    
    for (const post of lowPerformingPosts) {
      try {
        const suggestion = await generateImprovementSuggestion(
          post.text,
          post.trend || "",
          post.purpose || "",
          post.engagement_score || 0,
          post.impression_count || 0,
          stats.averageEngagement,
          stats.averageImpressions,
          stats.topPost?.text || ""
        )
        
        if (suggestion) {
          suggestions.push({
            postId: post.id,
            originalText: post.text,
            improvedText: suggestion.improvedText,
            reason: suggestion.reason,
            expectedImprovement: suggestion.expectedImprovement,
            changes: suggestion.changes
          })
        }
      } catch (error) {
        console.error(`Error generating suggestion for post ${post.id}:`, error)
        // Continue with other posts
      }
    }

    return suggestions
  } catch (error) {
    console.error("Error getting improvement suggestions:", error)
    return []
  }
}

async function generateImprovementSuggestion(
  originalText: string,
  trend: string,
  purpose: string,
  currentEngagement: number,
  currentImpressions: number,
  averageEngagement: number,
  averageImpressions: number,
  topPostText: string
): Promise<{
  improvedText: string
  reason: string
  expectedImprovement: { engagement: number; impressions: number }
  changes: string[]
} | null> {
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })

    const prompt = `以下のX投稿は、エンゲージメントが平均を下回っています。インプレッションとエンゲージメントを最大化するように改善してください。

【現在の投稿】
${originalText}

【パフォーマンスデータ】
- 現在のエンゲージメント: ${currentEngagement}
- 現在のインプレッション: ${currentImpressions > 0 ? currentImpressions.toLocaleString('ja-JP') : 'データなし'}
- 平均エンゲージメント: ${averageEngagement}
- 平均インプレッション: ${averageImpressions > 0 ? averageImpressions.toLocaleString('ja-JP') : 'データなし'}

【参考: 高パフォーマンス投稿の例】
${topPostText || 'なし'}

【改善要件】
1. **冒頭の強化**: 最初の10-15文字で注意を引く（数字、絵文字、質問など）
2. **構造化**: 箇条書き、見出し、改行を効果的に使用
3. **絵文字の追加**: 視覚的インパクトを高める（3-5個程度）
4. **エンゲージメント誘発**: 質問や呼びかけを追加
5. **価値の明確化**: 読者にとってのメリットを明確に
6. **ハッシュタグの最適化**: 関連性の高いハッシュタグを3-5個

【出力形式（JSON）】:
{
  "improvedText": "改善された投稿テキスト（280文字以内）",
  "reason": "改善理由（なぜこの変更でパフォーマンスが向上するか）",
  "expectedImprovement": {
    "engagement": 予想されるエンゲージメント増加率（%）、
    "impressions": 予想されるインプレッション増加率（%）
  },
  "changes": ["変更点1", "変更点2", "変更点3"]
}`

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
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
    
    return {
      improvedText: parsed.improvedText || originalText,
      reason: parsed.reason || "パフォーマンス向上のための改善",
      expectedImprovement: {
        engagement: parsed.expectedImprovement?.engagement || 20,
        impressions: parsed.expectedImprovement?.impressions || 15
      },
      changes: parsed.changes || []
    }
  } catch (error) {
    console.error('Error generating improvement suggestion:', error)
    return null
  }
}

export interface SyntaxFormat {
  formattedText: string
  formatType: 'list' | 'bullet' | 'thread' | 'quote' | 'structured'
  structure: string[]
  preview: string
}

/**
 * 構文ボタン用: テキストをインプレッション最大化フォーマットに変換
 */
/**
 * 手動で入力したツイートテキストを改善・成形する（オプション: コンテキスト・事実確認）
 */
export async function improveTweetTextAction(
  text: string,
  purpose?: string,
  aiProvider?: 'grok' | 'claude',
  options?: { userId?: string; runFactCheck?: boolean }
): Promise<ImprovedText | null> {
  try {
    if (!text.trim()) {
      throw new Error('テキストが空です')
    }

    let pastPostsContext: string | undefined
    if (options?.userId) {
      pastPostsContext = await getRecentPostsForContext(options.userId, 6)
    }

    const result = await improveTweetText({
      originalText: text,
      purpose,
      aiProvider: aiProvider || 'grok',
      pastPostsContext,
      runFactCheck: options?.runFactCheck ?? true,
    })

    return result
  } catch (error) {
    console.error('Error improving tweet text:', error)
    const appError = classifyError(error as Error)
    logErrorToSentry(appError, {
      action: 'improveTweetTextAction',
    })
    return null
  }
}

export async function generateSyntaxFormat(
  text: string,
  purpose?: string
): Promise<SyntaxFormat | null> {
  try {
    if (!text.trim()) {
      throw new Error('テキストが空です')
    }

    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })

    const prompt = `以下のテキストを、Xでインプレッション（表示回数）が最大化される構造化フォーマットに変換してください。

【元のテキスト】
${text}

${purpose ? `【投稿目的】\n${purpose}\n` : ''}

【フォーマット要件】
1. **リスト形式**: 番号付きリスト（1. 2. 3.）または箇条書き（・、✓、→）を使用
2. **構造化**: 見出し（【】、数字付き）と改行を効果的に使用
3. **視覚的インパクト**: 「↓」記号や区切り線で視認性を向上
4. **冒頭の強化**: 最初の10-15文字で注意を引く（数字、絵文字、質問など）
5. **絵文字の戦略的使用**: 各項目に適切な絵文字（3-5個程度）
6. **エンゲージメント誘発**: 質問や呼びかけを追加

【出力形式（JSON）】:
{
  "formattedText": "構造化された投稿テキスト（280文字以内、改行含む）",
  "formatType": "list" | "bullet" | "thread" | "quote" | "structured",
  "structure": ["構造要素1", "構造要素2", "構造要素3"],
  "preview": "プレビュー用の短縮版（最初の50文字程度）"
}

【注意】
- 元のテキストの意味や内容は保持する
- 過度な装飾は避ける
- 自然で読みやすい形式にする
- 280文字以内に収める`

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
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
    
    return {
      formattedText: parsed.formattedText || text,
      formatType: parsed.formatType || 'structured',
      structure: parsed.structure || [],
      preview: parsed.preview || parsed.formattedText?.substring(0, 50) || ''
    }
  } catch (error) {
    console.error('Error generating syntax format:', error)
    return null
  }
}

/**
 * 下書きの更新
 */
export async function updateDraft(
  draftId: string,
  userId: string,
  text: string,
  hashtags: string[] = []
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseAdmin = createServerClient()
    const { error } = await supabaseAdmin
      .from("post_history")
      .update({
        text: text,
        hashtags: hashtags,
        updated_at: new Date().toISOString()
      })
      .eq("id", draftId)
      .eq("user_id", userId)
      .eq("status", "draft")

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error("Error updating draft:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "下書きの更新に失敗しました"
    }
  }
}

/**
 * 下書きの削除
 */
export async function deleteDraft(
  draftId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseAdmin = createServerClient()
    const { error } = await supabaseAdmin
      .from("post_history")
      .delete()
      .eq("id", draftId)
      .eq("user_id", userId)
      .eq("status", "draft")

    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error("Error deleting draft:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "下書きの削除に失敗しました"
    }
  }
}

/**
 * 位置情報を検索
 */
export async function searchLocations(
  query: string,
  accessToken: string
): Promise<Place[]> {
  try {
    return await searchPlaces(query, accessToken)
  } catch (error) {
    console.error("Error searching locations:", error)
    return []
  }
}

/**
 * ツイート用アイキャッチ画像を生成（Server Action）
 */
export async function generateTweetImage(
  tweetText: string,
  trend?: string,
  purpose?: string
): Promise<{ success: boolean; image?: GeneratedImage; error?: string }> {
  try {
    const image = await generateEyeCatchImage(tweetText, trend, purpose)
    if (image) {
      return { success: true, image }
    } else {
      return { success: false, error: "画像の生成に失敗しました" }
    }
  } catch (error) {
    console.error("Error generating tweet image:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "画像の生成に失敗しました"
    }
  }
}

/**
 * ツイート用画像バリエーションを生成（Server Action）
 */
export async function generateTweetImageVariations(
  tweetText: string,
  trend?: string,
  purpose?: string,
  count: number = 3
): Promise<{ success: boolean; images?: GeneratedImage[]; error?: string }> {
  try {
    const images = await generateImageVariations(tweetText, trend, purpose, count)
    if (images.length > 0) {
      return { success: true, images }
    } else {
      return { success: false, error: "画像の生成に失敗しました" }
    }
  } catch (error) {
    console.error("Error generating tweet image variations:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "画像の生成に失敗しました"
    }
  }
}
