"use server"

import { generatePosts, PostDraft } from "@/lib/ai-generator"
import { createServerClient } from "@/lib/supabase"
import { postTweet, getTweetEngagement, getTrendingTopics, Trend, refreshTwitterAccessToken, uploadMedia, searchPlaces, Place } from "@/lib/x-post"
import { generateEyeCatchImage, generateImageVariations, downloadImageAsBuffer, GeneratedImage } from "@/lib/image-generator"

export async function generatePostDrafts(
  trend: string,
  purpose: string
): Promise<PostDraft[]> {
  try {
    const drafts = await generatePosts({ trend, purpose })
    return drafts
  } catch (error) {
    console.error("Error generating drafts:", error)
    throw error
  }
}

export async function savePostToHistory(
  userId: string,
  draft: PostDraft,
  trend: string,
  purpose: string,
  status: 'draft' | 'posted' | 'scheduled' = 'draft'
) {
  try {
    // Use service role client to bypass RLS in Server Actions
    const supabaseAdmin = createServerClient()
    const { error } = await supabaseAdmin.from("post_history").insert({
      user_id: userId,
      text: draft.text,
      hashtags: draft.hashtags,
      naturalness_score: draft.naturalnessScore,
      trend: trend,
      purpose: purpose,
      status: status,
    })

    if (error) throw error
  } catch (error) {
    console.error("Error saving post to history:", error)
    throw error
  }
}

export async function approveAndPostTweet(
  userId: string,
  draft: PostDraft,
  accessToken: string,
  trend: string,
  purpose: string
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  try {
    // Try to post to Twitter
    let tweet
    let currentAccessToken = accessToken
    
    try {
      tweet = await postTweet(draft.text, currentAccessToken, {})
    } catch (error: any) {
      // If 401 error, try to refresh token
      if (error?.code === 401) {
        console.log("[Post Tweet] Access token expired, attempting to refresh...")
        
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
          console.error("[Post Tweet] Error updating refreshed tokens:", updateError)
          throw new Error('トークンの更新に失敗しました。Twitter連携を再度行ってください。')
        }

        console.log("[Post Tweet] Token refreshed, retrying post...")
        // Retry with new access token
        currentAccessToken = newAccessToken
        tweet = await postTweet(draft.text, currentAccessToken, {})
      } else {
        throw error
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

    // Save to history using service role client
    const supabaseAdmin = createServerClient()
    const { error } = await supabaseAdmin.from("post_history").insert({
      user_id: userId,
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

    return { success: true, tweetId: tweet.id }
  } catch (error) {
    console.error("Error posting tweet:", error)
    const errorMessage = error instanceof Error ? error.message : "投稿に失敗しました"
    return { 
      success: false, 
      error: errorMessage 
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
  imageUrl?: string
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
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

    return { success: true, tweetId: tweet.id }
  } catch (error) {
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

// Update engagement for all posted tweets of a user
export async function updateAllTweetEngagements(
  userId: string,
  accessToken: string
): Promise<{ updated: number; failed: number }> {
  try {
    const supabaseAdmin = createServerClient()
    
    // Get all posted tweets with tweet_id
    const { data: postedTweets, error: fetchError } = await supabaseAdmin
      .from("post_history")
      .select("tweet_id")
      .eq("user_id", userId)
      .eq("status", "posted")
      .not("tweet_id", "is", null)

    if (fetchError) throw fetchError

    let updated = 0
    let failed = 0

    // Update engagement for each tweet
    for (const post of postedTweets || []) {
      if (!post.tweet_id) continue
      
      try {
        const result = await updateTweetEngagement(post.tweet_id, accessToken)
        if (result.success) {
          updated++
        } else {
          failed++
        }
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
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

// Get trending topics for a user
export async function getTrends(accessToken: string): Promise<Trend[]> {
  try {
    const trends = await getTrendingTopics(accessToken)
    return trends
  } catch (error) {
    console.error("Error fetching trends:", error)
    return []
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
      new Set((data || []).map((item) => item.purpose).filter(Boolean))
    )

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

export async function scheduleTweet(
  userId: string,
  draft: PostDraft,
  scheduleFor: Date,
  trend: string,
  purpose: string
) {
  try {
    // Use service role client to bypass RLS in Server Actions
    const supabaseAdmin = createServerClient()
    const { error } = await supabaseAdmin.from("post_history").insert({
      user_id: userId,
      text: draft.text,
      hashtags: draft.hashtags,
      naturalness_score: draft.naturalnessScore,
      trend: trend,
      purpose: purpose,
      status: "scheduled",
      scheduled_for: scheduleFor.toISOString(),
    })

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

export async function getPostHistory(userId: string, limit: number = 50) {
  try {
    // Use service role client to bypass RLS in Server Actions
    const supabaseAdmin = createServerClient()
    const { data, error } = await supabaseAdmin
      .from("post_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error

    return data || []
  } catch (error) {
    console.error("Error fetching post history:", error)
    return []
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

    const posts = allPosts || []
    
    // Calculate statistics
    const totalPosts = posts.length
    const postedCount = posts.filter(p => p.status === 'posted').length
    const draftCount = posts.filter(p => p.status === 'draft').length
    const scheduledCount = posts.filter(p => p.status === 'scheduled').length
    
    // Calculate average engagement (only for posted tweets)
    const postedPosts = posts.filter(p => p.status === 'posted' && p.engagement_score !== null)
    const averageEngagement = postedPosts.length > 0
      ? Math.round(postedPosts.reduce((sum, p) => sum + (p.engagement_score || 0), 0) / postedPosts.length)
      : 0
    
    // Find highest engagement
    const highestEngagement = postedPosts.length > 0
      ? Math.max(...postedPosts.map(p => p.engagement_score || 0))
      : 0
    
    // Calculate impression statistics
    const postsWithImpressions = postedPosts.filter(p => p.impression_count !== null && p.impression_count > 0)
    const totalImpressions = postsWithImpressions.reduce((sum, p) => sum + (p.impression_count || 0), 0)
    const averageImpressions = postsWithImpressions.length > 0
      ? Math.round(totalImpressions / postsWithImpressions.length)
      : 0
    
    // Calculate reach statistics
    const postsWithReach = postedPosts.filter(p => p.reach_count !== null && p.reach_count > 0)
    const totalReach = postsWithReach.reduce((sum, p) => sum + (p.reach_count || 0), 0)
    
    // Calculate average engagement rate
    const postsWithEngagementRate = postedPosts.filter(p => p.engagement_rate !== null && p.engagement_rate > 0)
    const averageEngagementRate = postsWithEngagementRate.length > 0
      ? parseFloat((postsWithEngagementRate.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / postsWithEngagementRate.length).toFixed(2))
      : 0
    
    // Find top post (by engagement score, but include impressions)
    const topPostData = postedPosts.length > 0
      ? postedPosts.reduce((top, current) => 
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
    
    const weeklyPosts = posts.filter(p => {
      const postDate = new Date(p.created_at)
      return postDate >= weekAgo && p.status === 'posted'
    }).length
    
    const monthlyPosts = posts.filter(p => {
      const postDate = new Date(p.created_at)
      return postDate >= monthAgo && p.status === 'posted'
    }).length

    // Calculate hourly performance (0-23 hours)
    const hourlyPerformance = Array.from({ length: 24 }, (_, hour) => {
      const hourPosts = postedPosts.filter(p => {
        const postDate = new Date(p.created_at)
        return postDate.getHours() === hour
      })
      
      if (hourPosts.length === 0) {
        return { hour, averageEngagement: 0, averageImpressions: 0, postCount: 0 }
      }
      
      const avgEngagement = Math.round(
        hourPosts.reduce((sum, p) => sum + (p.engagement_score || 0), 0) / hourPosts.length
      )
      
      const hourPostsWithImpressions = hourPosts.filter(p => p.impression_count !== null && p.impression_count > 0)
      const avgImpressions = hourPostsWithImpressions.length > 0
        ? Math.round(
            hourPostsWithImpressions.reduce((sum, p) => sum + (p.impression_count || 0), 0) / hourPostsWithImpressions.length
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
      const weekdayPosts = postedPosts.filter(p => {
        const postDate = new Date(p.created_at)
        return postDate.getDay() === weekday
      })
      
      if (weekdayPosts.length === 0) {
        return { weekday, averageEngagement: 0, averageImpressions: 0, postCount: 0 }
      }
      
      const avgEngagement = Math.round(
        weekdayPosts.reduce((sum, p) => sum + (p.engagement_score || 0), 0) / weekdayPosts.length
      )
      
      const weekdayPostsWithImpressions = weekdayPosts.filter(p => p.impression_count !== null && p.impression_count > 0)
      const avgImpressions = weekdayPostsWithImpressions.length > 0
        ? Math.round(
            weekdayPostsWithImpressions.reduce((sum, p) => sum + (p.impression_count || 0), 0) / weekdayPostsWithImpressions.length
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
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
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

    return { success: true, tweetId: tweet.id }
  } catch (error) {
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
    const lowPerformingPosts = posts.filter(post => {
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
