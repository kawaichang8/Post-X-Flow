import 'server-only'
import { TwitterApi } from 'twitter-api-v2'
import { classifyError, retryWithBackoff, logErrorToSentry, ErrorType, AppError } from './error-handler'
import { getTwitterClientId, getTwitterClientSecret } from './server-only'

// OAuth 2.0 with PKCE flow
export function getTwitterAuthClient() {
  const clientId = getTwitterClientId()
  const clientSecret = getTwitterClientSecret()
  const redirectUri = process.env.TWITTER_REDIRECT_URI || process.env.NEXT_PUBLIC_APP_URL + '/api/auth/twitter/callback'

  return new TwitterApi({
    clientId,
    clientSecret,
  })
}

// Generate OAuth authorization URL
export async function getTwitterAuthUrl(forceLogin: boolean = true): Promise<{ url: string; codeVerifier: string; state: string }> {
  try {
    const client = getTwitterAuthClient()
    const redirectUri = process.env.TWITTER_REDIRECT_URI || (process.env.NEXT_PUBLIC_APP_URL || '') + '/api/auth/twitter/callback'
    
    console.log('[Twitter OAuth] Generating auth URL with redirect URI:', redirectUri)
    
    // generateOAuth2AuthLink is synchronous, not async
    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
      redirectUri,
      {
        scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'tweet.read'],
      }
    )

    // Simple OAuth URL generation - no additional parameters
    // Users should switch accounts on X side before starting OAuth flow
    // This was the original working implementation
    console.log('[Twitter OAuth] Auth URL generated successfully')
    console.log('[Twitter OAuth] Final auth URL:', url)
    return { url, codeVerifier, state }
  } catch (error) {
    console.error('[Twitter OAuth] Error generating auth URL:', error)
    throw error
  }
}

// Exchange code for access token
export async function getTwitterAccessToken(
  code: string,
  codeVerifier: string
): Promise<{ accessToken: string; refreshToken: string }> {
  try {
    const client = getTwitterAuthClient()
    const redirectUri = process.env.TWITTER_REDIRECT_URI || (process.env.NEXT_PUBLIC_APP_URL || '') + '/api/auth/twitter/callback'
    
    console.log('[Twitter OAuth] Exchanging code for access token...')
    
    const { accessToken, refreshToken } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri,
    })

    if (!accessToken || !refreshToken) {
      throw new Error('Failed to obtain access token or refresh token from Twitter')
    }

    console.log('[Twitter OAuth] Access token received successfully')
    return { accessToken, refreshToken }
  } catch (error) {
    console.error('[Twitter OAuth] Error exchanging code for token:', error)
    throw error
  }
}

// Refresh access token using refresh token
export async function refreshTwitterAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  return retryWithBackoff(
    async () => {
      const client = getTwitterAuthClient()
      
      console.log('[Twitter OAuth] Refreshing access token...')
      
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await client.refreshOAuth2Token(refreshToken)

      if (!newAccessToken) {
        throw new Error('Failed to obtain new access token from Twitter')
      }

      console.log('[Twitter OAuth] Access token refreshed successfully')
      return { 
        accessToken: newAccessToken, 
        refreshToken: newRefreshToken || refreshToken // Use new refresh token if provided, otherwise keep old one
      }
    },
    {
      maxRetries: 2,
      initialDelay: 2000,
      onRetry: (attempt, error) => {
        console.log(`[Twitter OAuth] Retry attempt ${attempt} for token refresh`)
        logErrorToSentry(error, { action: 'refreshTwitterAccessToken', attempt })
      },
    }
  ).catch((error) => {
    const appError = classifyError(error)
    logErrorToSentry(appError, { action: 'refreshTwitterAccessToken' })
    throw appError
  })
}

// Get Twitter user information
export async function getTwitterUserInfo(accessToken: string): Promise<{
  id: string
  username: string
  name: string
  profile_image_url?: string
}> {
  const client = new TwitterApi(accessToken)
  const rwClient = client.readWrite

  try {
    const me = await rwClient.v2.me({
      'user.fields': ['profile_image_url', 'name', 'username'],
    })

    return {
      id: me.data.id,
      username: me.data.username,
      name: me.data.name,
      profile_image_url: me.data.profile_image_url,
    }
  } catch (error: any) {
    console.error('Error fetching Twitter user info:', error)
    throw new Error('Failed to fetch Twitter user information.')
  }
}

// Upload media to Twitter
export async function uploadMedia(
  mediaBuffer: Buffer,
  accessToken: string,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  const client = new TwitterApi(accessToken)
  const rwClient = client.readWrite

  try {
    // Upload media using v1.1 API (media upload endpoint)
    const mediaId = await rwClient.v1.uploadMedia(mediaBuffer, {
      mimeType,
    })

    return mediaId
  } catch (error: any) {
    console.error('Error uploading media:', error)
    throw new Error('Failed to upload media. Please check your permissions and try again.')
  }
}

// Post tweet using access token (requires explicit user confirmation)
export interface PollOption {
  label: string
}

export interface TweetOptions {
  quoteTweetId?: string
  mediaIds?: string[]
  poll?: {
    options: PollOption[]
    durationMinutes: number // 5, 15, 30, 60, 1440 (1 day), 10080 (7 days)
  }
  replyToTweetId?: string // For thread replies
  placeId?: string // For location/place
}

export async function postTweet(
  text: string,
  accessToken: string,
  options?: TweetOptions
): Promise<{ id: string; text: string }> {
  return retryWithBackoff(
    async () => {
      const client = new TwitterApi(accessToken)
      const rwClient = client.readWrite

      const tweetParams: any = {
        text,
      }

      // Add quote tweet ID if provided
      if (options?.quoteTweetId) {
        tweetParams.quote_tweet_id = options.quoteTweetId
      }

      // Add reply to tweet ID for threads
      if (options?.replyToTweetId) {
        tweetParams.reply = {
          in_reply_to_tweet_id: options.replyToTweetId,
        }
      }

      // Add media IDs if provided
      if (options?.mediaIds && options.mediaIds.length > 0) {
        tweetParams.media = {
          media_ids: options.mediaIds,
        }
      }

      // Add poll if provided
      if (options?.poll) {
        tweetParams.poll = {
          options: options.poll.options.map(opt => opt.label),
          duration_minutes: options.poll.durationMinutes,
        }
      }

      // Add location/place if provided
      if (options?.placeId) {
        tweetParams.geo = {
          place_id: options.placeId,
        }
      }

      const tweet = await rwClient.v2.tweet(tweetParams)

      if (!tweet.data) {
        throw new Error('Tweet data is missing from response')
      }

      return {
        id: tweet.data.id,
        text: tweet.data.text || text,
      }
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 30000,
      onRetry: (attempt, error) => {
        console.log(`[X API] Retry attempt ${attempt} after error:`, error.type)
        logErrorToSentry(error, { action: 'postTweet', attempt })
      },
    }
  ).catch((error) => {
    const appError = classifyError(error)
    logErrorToSentry(appError, { action: 'postTweet', text: text.substring(0, 50) })
    throw appError
  })
}

// Get tweet engagement metrics (likes, retweets, replies, impressions, reach)
export interface TweetEngagement {
  tweetId: string
  likeCount: number
  retweetCount: number
  replyCount: number
  quoteCount: number
  engagementScore: number // Sum of all engagement metrics
  impressionCount: number | null // Impressions (may be null if not available)
  reachCount: number | null // Reach (may be null if not available)
  engagementRate: number | null // Engagement rate (engagement / impressions)
}

export async function getTweetEngagement(
  tweetId: string,
  accessToken: string
): Promise<TweetEngagement | null> {
  try {
    const client = new TwitterApi(accessToken)
    const rwClient = client.readWrite

    // Request both public and non-public metrics
    const tweet = await rwClient.v2.singleTweet(tweetId, {
      'tweet.fields': ['public_metrics', 'non_public_metrics'],
    })

    if (!tweet.data) {
      console.error('Tweet not found:', tweetId)
      return null
    }

    const publicMetrics = tweet.data.public_metrics || {
      like_count: 0,
      retweet_count: 0,
      reply_count: 0,
      quote_count: 0,
    }

    const nonPublicMetrics = tweet.data.non_public_metrics || {
      impression_count: null,
      url_link_clicks: null,
      user_profile_clicks: null,
    }

    // Note: Twitter API v2 may not always return non_public_metrics
    // It depends on the access level and permissions
    const impressionCount = nonPublicMetrics.impression_count ?? null
    const reachCount = null // Reach is not directly available in standard API

    const engagementScore = 
      (publicMetrics.like_count || 0) +
      (publicMetrics.retweet_count || 0) +
      (publicMetrics.reply_count || 0) +
      (publicMetrics.quote_count || 0)

    // Calculate engagement rate if impressions are available
    const engagementRate = impressionCount && impressionCount > 0
      ? (engagementScore / impressionCount) * 100
      : null

    return {
      tweetId,
      likeCount: publicMetrics.like_count || 0,
      retweetCount: publicMetrics.retweet_count || 0,
      replyCount: publicMetrics.reply_count || 0,
      quoteCount: publicMetrics.quote_count || 0,
      engagementScore,
      impressionCount,
      reachCount,
      engagementRate,
    }
  } catch (error) {
    console.error('Error fetching tweet engagement:', error)
    // If non_public_metrics fails, try with just public_metrics
    try {
      const client = new TwitterApi(accessToken)
      const rwClient = client.readWrite

      const tweet = await rwClient.v2.singleTweet(tweetId, {
        'tweet.fields': ['public_metrics'],
      })

      if (!tweet.data) {
        return null
      }

      const metrics = tweet.data.public_metrics || {
        like_count: 0,
        retweet_count: 0,
        reply_count: 0,
        quote_count: 0,
      }

      const engagementScore = 
        (metrics.like_count || 0) +
        (metrics.retweet_count || 0) +
        (metrics.reply_count || 0) +
        (metrics.quote_count || 0)

      return {
        tweetId,
        likeCount: metrics.like_count || 0,
        retweetCount: metrics.retweet_count || 0,
        replyCount: metrics.reply_count || 0,
        quoteCount: metrics.quote_count || 0,
        engagementScore,
        impressionCount: null,
        reachCount: null,
        engagementRate: null,
      }
    } catch (fallbackError) {
      console.error('Error fetching tweet engagement (fallback):', fallbackError)
      return null
    }
  }
}

// Schedule tweet (store in database for later posting)
export interface ScheduledTweet {
  text: string
  scheduledFor: Date
  userId: string
}

// Get trending topics (Japan - WOEID: 23424856)
export interface Trend {
  name: string
  query: string
  tweetVolume: number | null
}

export async function getTrendingTopics(
  accessToken: string,
  woeid: number = 23424856 // Japan
): Promise<Trend[]> {
  try {
    const client = new TwitterApi(accessToken)
    
    // Try using twitter-api-v2's v1 client for trends
    // Note: OAuth 2.0 user context tokens may work with v1.1 endpoints
    try {
      // Access v1 client through the readWrite client
      const trendsData = await client.v1.get('trends/place.json', {
        id: woeid,
      })

      if (trendsData && Array.isArray(trendsData) && trendsData[0] && trendsData[0].trends) {
        return processTrends(trendsData[0].trends)
      }
    } catch (v1Error) {
      console.warn('v1 trends endpoint failed, trying direct API call:', v1Error)
      
      // Fallback: Direct API call
      try {
        const response = await fetch(
          `https://api.twitter.com/1.1/trends/place.json?id=${woeid}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        )

        if (response.ok) {
          const trendsData = await response.json()
          
          if (trendsData && Array.isArray(trendsData) && trendsData[0] && trendsData[0].trends) {
            return processTrends(trendsData[0].trends)
          }
        }
      } catch (fetchError) {
        console.warn('Direct API call also failed:', fetchError)
      }
    }

    // If all methods fail, return fallback
    return getTrendingTopicsFallback()
  } catch (error) {
    console.error('Error fetching trending topics:', error)
    // Return fallback - graceful degradation
    return getTrendingTopicsFallback()
  }
}

function processTrends(trends: any[]): Trend[] {
  return trends
    .filter((trend: any) => trend.name)
    .slice(0, 10) // Get top 10 trends
    .map((trend: any) => ({
      name: trend.name,
      query: trend.query || trend.name,
      tweetVolume: trend.tweet_volume || null,
    }))
}

// Fallback: Get popular topics (if trends endpoint is not available)
function getTrendingTopicsFallback(): Trend[] {
  // Popular Japanese hashtags and topics as fallback
  // These are commonly trending topics that users might want to use
  return [
    { name: '#日曜劇場リブート', query: '#日曜劇場リブート', tweetVolume: null },
    { name: '#乃木坂工事中', query: '#乃木坂工事中', tweetVolume: null },
    { name: '鈴木亮平', query: '鈴木亮平', tweetVolume: null },
    { name: '#AI', query: '#AI', tweetVolume: null },
    { name: '#プログラミング', query: '#プログラミング', tweetVolume: null },
    { name: '#開発日記', query: '#開発日記', tweetVolume: null },
    { name: '#生産性', query: '#生産性', tweetVolume: null },
    { name: '#技術', query: '#技術', tweetVolume: null },
  ]
}

// Search for places/locations
export interface Place {
  id: string
  name: string
  fullName: string
  country: string
  countryCode: string
}

export async function searchPlaces(
  query: string,
  accessToken: string
): Promise<Place[]> {
  try {
    const client = new TwitterApi(accessToken)
    const rwClient = client.readWrite

    // Use Twitter API v1.1 geo/search endpoint
    const response = await rwClient.v1.get('geo/search.json', {
      query: query,
      max_results: 10,
    })

    if (response.result && response.result.places) {
      return response.result.places.map((place: any) => ({
        id: place.id,
        name: place.name,
        fullName: place.full_name,
        country: place.country || '',
        countryCode: place.country_code || '',
      }))
    }

    return []
  } catch (error) {
    console.error('Error searching places:', error)
    return []
  }
}

// Note: openTwitterCompose has been moved to lib/twitter-client.ts
// to avoid importing twitter-api-v2 on the client side
