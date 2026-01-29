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
    
    console.log("=".repeat(80))
    console.log('[Twitter OAuth] ===== GENERATING AUTH URL =====')
    console.log('[Twitter OAuth] Redirect URI:', redirectUri)
    console.log('[Twitter OAuth] TWITTER_REDIRECT_URI env:', process.env.TWITTER_REDIRECT_URI || 'NOT SET')
    console.log('[Twitter OAuth] NEXT_PUBLIC_APP_URL env:', process.env.NEXT_PUBLIC_APP_URL || 'NOT SET')
    console.log('[Twitter OAuth] Timestamp:', new Date().toISOString())
    
    // generateOAuth2AuthLink is synchronous, not async
    console.log('[Twitter OAuth] About to generate OAuth link with redirectUri:', redirectUri)
    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
      redirectUri,
      {
        scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'tweet.read'],
      }
    )
    console.log('[Twitter OAuth] OAuth link generated, URL length:', url.length)

    // Add force_login=true to force login screen and prevent cached account selection
    // This should prevent logged-out accounts from being automatically selected
    const authUrl = new URL(url)
    // Remove prompt if it exists (from previous implementations)
    authUrl.searchParams.delete('prompt')
    // Add force_login=true to force fresh login
    authUrl.searchParams.set('force_login', 'true')

    console.log('[Twitter OAuth] Auth URL generated with force_login=true (forces fresh login)')
    console.log('[Twitter OAuth] Final auth URL:', authUrl.toString())
    console.log('[Twitter OAuth] URL parameters:', Object.fromEntries(authUrl.searchParams))
    console.log('[Twitter OAuth] Expected callback URL:', redirectUri)
    console.log("=".repeat(80))
    return { url: authUrl.toString(), codeVerifier, state }
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

// OAuth 2.0 Application-Only Bearer Token (for endpoints that require it, e.g. v2 trends)
let cachedAppOnlyBearerToken: string | null = null
let cachedAppOnlyBearerTokenExpiry = 0
const BEARER_TOKEN_CACHE_MS = 50 * 60 * 1000 // 50 min (tokens often valid 2h)

export async function getAppOnlyBearerToken(): Promise<string> {
  if (cachedAppOnlyBearerToken && Date.now() < cachedAppOnlyBearerTokenExpiry) {
    return cachedAppOnlyBearerToken
  }
  const clientId = getTwitterClientId()
  const clientSecret = getTwitterClientSecret()
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')
  const response = await fetch('https://api.x.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: 'grant_type=client_credentials',
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    console.error('[AppOnlyBearer] Error:', response.status, text)
    throw new Error(`アプリ認証トークンの取得に失敗しました: ${response.status}`)
  }
  const data = await response.json()
  const token = data.access_token
  if (!token) {
    throw new Error('アプリ認証トークンの取得に失敗しました（トークンなし）')
  }
  cachedAppOnlyBearerToken = token
  cachedAppOnlyBearerTokenExpiry = Date.now() + BEARER_TOKEN_CACHE_MS
  return token
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
    // Use X API v2: GET /2/trends/by/woeid/{woeid}
    // Free plan supports v2, so this should work
    const maxTrends = 10 // Get top 10
    const url = new URL(`https://api.x.com/2/trends/by/woeid/${woeid}`)
    url.searchParams.set('max_trends', String(maxTrends))
    // trend.fields: array format in docs, but URL query uses comma-separated string
    // Try without trend.fields first (default fields might be returned)
    // If needed, we can add: url.searchParams.set('trend.fields', 'trend_name,tweet_count')

    console.log('[Trends v2] Request URL:', url.toString())
    console.log('[Trends v2] WOEID:', woeid)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    console.log('[Trends v2] Response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error('[Trends v2] Error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      })
      
      // Try to parse error JSON
      let errorDetail = errorText
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.errors && Array.isArray(errorJson.errors)) {
          errorDetail = errorJson.errors.map((e: any) => e.detail || e.title || JSON.stringify(e)).join(', ')
        } else if (errorJson.detail) {
          errorDetail = errorJson.detail
        }
      } catch {
        // Keep original errorText
      }
      
      throw new Error(`X API v2 トレンド取得エラー (${response.status}): ${errorDetail}`)
    }

    const data = await response.json()
    console.log('[Trends v2] Response data:', JSON.stringify(data).substring(0, 500))

    // v2 response format: { data: [{ trend_name, tweet_count }], errors?: [...] }
    if (data.errors && data.errors.length > 0) {
      console.error('[Trends v2] API errors in response:', data.errors)
      const errorMessages = data.errors.map((e: any) => e.detail || e.title || JSON.stringify(e)).join(', ')
      throw new Error(`X API v2 エラー: ${errorMessages}`)
    }

    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      console.warn('[Trends v2] Empty data array in response')
      throw new Error('トレンドデータが空です')
    }

    const processed = processTrendsV2(data.data)
    console.log('[Trends v2] Processed trends:', processed.length)
    return processed
  } catch (error) {
    if (error instanceof Error && error.message.includes('最新のトレンドを取得できませんでした')) throw error
    if (error instanceof Error) {
      console.error('[Trends v2] Error fetching trending topics:', error.message, error.stack)
      throw new Error(`最新のトレンドを取得できませんでした: ${error.message}`)
    }
    console.error('[Trends v2] Unknown error fetching trending topics:', error)
    throw new Error('最新のトレンドを取得できませんでした。しばらくしてから再度お試しください。')
  }
}

// Process v2 trends response: { trend_name, tweet_count }[]
function processTrendsV2(trends: any[]): Trend[] {
  return trends
    .filter((trend: any) => trend.trend_name)
    .map((trend: any) => ({
      name: trend.trend_name,
      query: trend.trend_name, // v2 doesn't have separate query field, use trend_name
      tweetVolume: trend.tweet_count ?? null,
    }))
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
