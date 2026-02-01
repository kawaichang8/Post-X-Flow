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

// Simple retweet (no comment) - X API v2 POST /2/users/:id/retweets
export async function postRetweet(
  targetTweetId: string,
  accessToken: string
): Promise<{ retweeted: boolean }> {
  const client = new TwitterApi(accessToken)
  const rwClient = client.readWrite
  const me = await rwClient.v2.me()
  if (!me.data?.id) {
    throw new Error('認証ユーザー情報を取得できませんでした')
  }
  const result = await rwClient.v2.retweet(me.data.id, targetTweetId)
  return { retweeted: result.data?.retweeted ?? true }
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

// Fetch a single tweet by ID with full details (for quote RT)
export interface FetchedTweet {
  id: string
  text: string
  authorId: string
  authorName: string
  authorUsername: string
  authorProfileImageUrl?: string
  likeCount: number
  retweetCount: number
  replyCount: number
  quoteCount: number
  impressionCount: number | null
  createdAt: string
}

export async function fetchTweetById(
  tweetId: string,
  accessToken: string
): Promise<FetchedTweet | null> {
  try {
    const client = new TwitterApi(accessToken)
    const rwClient = client.readWrite

    // Fetch tweet with author expansion and metrics
    const tweet = await rwClient.v2.singleTweet(tweetId, {
      'tweet.fields': ['public_metrics', 'created_at', 'author_id'],
      expansions: ['author_id'],
      'user.fields': ['name', 'username', 'profile_image_url'],
    })

    if (!tweet.data) {
      console.error('[fetchTweetById] Tweet not found:', tweetId)
      return null
    }

    const author = tweet.includes?.users?.[0]
    const metrics = tweet.data.public_metrics || {
      like_count: 0,
      retweet_count: 0,
      reply_count: 0,
      quote_count: 0,
    }

    return {
      id: tweet.data.id,
      text: tweet.data.text,
      authorId: tweet.data.author_id || author?.id || '',
      authorName: author?.name || '不明',
      authorUsername: author?.username || '',
      authorProfileImageUrl: author?.profile_image_url,
      likeCount: metrics.like_count || 0,
      retweetCount: metrics.retweet_count || 0,
      replyCount: metrics.reply_count || 0,
      quoteCount: metrics.quote_count || 0,
      impressionCount: null, // Only available for own tweets
      createdAt: tweet.data.created_at || new Date().toISOString(),
    }
  } catch (error) {
    console.error('[fetchTweetById] Error:', error)
    return null
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

const BEARER_TOKEN_HELP =
  '【重要】スタンドアロンアプリの Bearer Token では 403 になります。developer.x.com → Projects & Apps → Overview を開き、「Free」の下にあるプロジェクト（例: Default project-...）をクリック → その中に表示される「PROJECT APP」（鍵アイコン付き）をクリック → Keys and tokens タブで「Bearer Token」をコピーし、.env.local の TWITTER_BEARER_TOKEN に貼り付けて保存。「Standalone Apps」のアプリのトークンは使わないでください。設定後は開発サーバーを Ctrl+C で止めてから npm run dev で再起動してください。'

export async function getAppOnlyBearerToken(): Promise<string> {
  // 環境変数で Bearer Token が指定されていればそれを使う（推奨。403 回避）
  let envBearer = (process.env.TWITTER_BEARER_TOKEN || process.env.BEARER_TOKEN || '').trim()
  if (envBearer) {
    // .env の引用符を除去（"..." で囲んだ場合）
    envBearer = envBearer.replace(/^["']|["']$/g, '')
    // コピペで %2F, %2B, %3D などが入っていても正しく解釈する
    try {
      if (/%[0-9A-Fa-f]{2}/.test(envBearer)) envBearer = decodeURIComponent(envBearer)
    } catch {
      // デコードに失敗したらそのまま使う
    }
    return envBearer
  }

  // TWITTER_BEARER_TOKEN 未設定時は client_credentials を試す（403 になりやすい場合は上記を設定すること）
  if (cachedAppOnlyBearerToken && Date.now() < cachedAppOnlyBearerTokenExpiry) {
    return cachedAppOnlyBearerToken
  }

  const apiKey = (process.env.TWITTER_API_KEY || process.env.TWITTER_CLIENT_ID || '').trim()
  const apiSecret = (process.env.TWITTER_API_SECRET || process.env.TWITTER_CLIENT_SECRET || '').trim()
  if (!apiKey || !apiSecret) {
    throw new Error(`トレンド取得には TWITTER_BEARER_TOKEN が必要です。${BEARER_TOKEN_HELP}`)
  }

  const basicAuth = Buffer.from(`${apiKey}:${apiSecret}`, 'utf8').toString('base64')
  const endpoints = ['https://api.twitter.com/oauth2/token', 'https://api.x.com/oauth2/token']
  let lastError = ''

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
        body: 'grant_type=client_credentials',
      })
      const text = await response.text().catch(() => '')
      if (!response.ok) {
        lastError = `${response.status}: ${text}`
        console.warn('[AppOnlyBearer]', endpoint, lastError)
        if (response.status === 403) {
          throw new Error(`トレンド取得には TWITTER_BEARER_TOKEN の設定が必要です（403 のため）。${BEARER_TOKEN_HELP}`)
        }
        continue
      }
      const data = JSON.parse(text)
      const token = data.access_token
      if (!token) {
        lastError = 'レスポンスに access_token がありません'
        continue
      }
      cachedAppOnlyBearerToken = token
      cachedAppOnlyBearerTokenExpiry = Date.now() + BEARER_TOKEN_CACHE_MS
      return token
    } catch (e) {
      if (e instanceof Error && e.message.includes('TWITTER_BEARER_TOKEN')) throw e
      lastError = e instanceof Error ? e.message : String(e)
      console.warn('[AppOnlyBearer]', endpoint, lastError)
    }
  }

  throw new Error(`アプリ認証トークンの取得に失敗しました。${BEARER_TOKEN_HELP} エラー: ${lastError}`)
}

// Get trending topics (Japan - WOEID: 23424856)
export interface Trend {
  name: string
  query: string
  tweetVolume: number | null
}

const TRENDS_BASE_URLS = ['https://api.x.com', 'https://api.twitter.com'] as const

export async function getTrendingTopics(
  accessToken: string,
  woeid: number = 23424856 // Japan
): Promise<Trend[]> {
  try {
    const maxTrends = 10 // Get top 10
    let lastStatus = 0
    let errorDetail = ''

    for (const baseUrl of TRENDS_BASE_URLS) {
      const url = new URL(`${baseUrl}/2/trends/by/woeid/${woeid}`)
      url.searchParams.set('max_trends', String(maxTrends))

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
      lastStatus = response.status

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        try {
          const errorJson = JSON.parse(errorText)
          if (errorJson.errors && Array.isArray(errorJson.errors)) {
            errorDetail = errorJson.errors.map((e: any) => e.detail || e.title || JSON.stringify(e)).join(', ')
          } else if (errorJson.detail) {
            errorDetail = errorJson.detail
          } else {
            errorDetail = errorText
          }
        } catch {
          errorDetail = errorText
        }
        console.error('[Trends v2] Error response:', { status: response.status, body: errorDetail })
        // 401 のときはもう一つの base URL で再試行
        if (response.status === 401 && baseUrl === TRENDS_BASE_URLS[0]) continue
        break
      }

      const data = await response.json()
      console.log('[Trends v2] Response data:', JSON.stringify(data).substring(0, 500))

      if (data.errors && data.errors.length > 0) {
        const errorMessages = data.errors.map((e: any) => e.detail || e.title || JSON.stringify(e)).join(', ')
        throw new Error(`X API v2 エラー: ${errorMessages}`)
      }
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        throw new Error('トレンドデータが空です')
      }
      const processed = processTrendsV2(data.data)
      console.log('[Trends v2] Processed trends:', processed.length)
      return processed
    }

    // 両方の base URL で失敗した場合
    if (lastStatus === 403 && /project|Project/i.test(errorDetail)) {
      throw new Error(
        `X API v2 では、アプリを「Project」に紐付けたうえで、そのアプリの Bearer Token を使う必要があります。${BEARER_TOKEN_HELP}`
      )
    }
    if (lastStatus === 401) {
      throw new Error(
        `Bearer Token が無効または失効しています（401）。Developer Portal の Project 内 App → Keys and tokens で Bearer Token を「Regenerate」し、表示されたトークンを .env.local の TWITTER_BEARER_TOKEN に貼り付けて保存・再起動してください。Free プランでトレンド API にアクセスできない場合もあります。その場合はトレンド欄にハッシュタグなどを手動で入力して投稿できます。`
      )
    }
    throw new Error(`X API v2 トレンド取得エラー (${lastStatus}): ${errorDetail}`)
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

// Get personalized trends using user's OAuth token (Free プランで利用可能)
// Endpoint: GET /2/users/personalized_trends
export async function getPersonalizedTrends(userAccessToken: string): Promise<Trend[]> {
  const baseUrls = ['https://api.x.com', 'https://api.twitter.com']
  let lastStatus = 0
  let errorDetail = ''

  for (const baseUrl of baseUrls) {
    try {
      const url = `${baseUrl}/2/users/personalized_trends`
      console.log('[PersonalizedTrends] Request URL:', url)

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userAccessToken}`,
          'Content-Type': 'application/json',
        },
      })

      console.log('[PersonalizedTrends] Response status:', response.status, response.statusText)
      lastStatus = response.status

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        try {
          const errorJson = JSON.parse(errorText)
          errorDetail = errorJson.detail || errorJson.errors?.[0]?.detail || errorText
        } catch {
          errorDetail = errorText
        }
        console.error('[PersonalizedTrends] Error:', { status: response.status, body: errorDetail })
        // 401/403 のときは次の base URL で再試行
        if ((response.status === 401 || response.status === 403) && baseUrl === baseUrls[0]) continue
        break
      }

      const data = await response.json()
      console.log('[PersonalizedTrends] Response data:', JSON.stringify(data).substring(0, 500))

      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        return processTrendsV2(data.data)
      }
      throw new Error('パーソナライズドトレンドが空です')
    } catch (e) {
      if (e instanceof Error && e.message.includes('パーソナライズド')) throw e
      errorDetail = e instanceof Error ? e.message : String(e)
      console.error('[PersonalizedTrends] Error:', errorDetail)
    }
  }

  throw new Error(`パーソナライズドトレンドの取得に失敗しました (${lastStatus}): ${errorDetail}`)
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
