# 実装ガイド - 即座に始められる改善

## 🚀 クイックスタート

このガイドでは、最適化計画書に基づいて、すぐに実装できる具体的なコード例を提供します。

---

## Phase 1: セキュリティ強化（最優先）

### 1. ログ管理システムの実装

#### ステップ1: ロガーライブラリの作成

```typescript
// lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  userId?: string
  action?: string
  [key: string]: unknown
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isProduction = process.env.NODE_ENV === 'production'

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context))
    }
  }

  info(message: string, context?: LogContext): void {
    if (!this.isProduction) {
      console.info(this.formatMessage('info', message, context))
    }
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context))
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
      } : undefined,
    }
    console.error(this.formatMessage('error', message, errorContext))
    
    // 本番環境では外部サービスに送信
    if (this.isProduction && error) {
      // TODO: Sentry.captureException(error, { extra: context })
    }
  }
}

export const logger = new Logger()
```

#### ステップ2: 既存のconsole.logを置き換え

**Before:**
```typescript
console.log('[Post Tweet] Access token expired, attempting to refresh...')
console.error('Error posting tweet:', error)
```

**After:**
```typescript
import { logger } from '@/lib/logger'

logger.info('Access token expired, attempting to refresh', { userId, accountId })
logger.error('Error posting tweet', error as Error, { userId, draftId })
```

---

### 2. 環境変数検証システム

#### ステップ1: Zodのインストール

```bash
npm install zod
```

#### ステップ2: 環境変数スキーマの作成

```typescript
// lib/env.ts
import { z } from 'zod'

const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),
  
  // AI API
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-', 'Invalid Anthropic API key format'),
  
  // Twitter API
  TWITTER_CLIENT_ID: z.string().min(1, 'Twitter client ID is required'),
  TWITTER_CLIENT_SECRET: z.string().min(1, 'Twitter client secret is required'),
  TWITTER_REDIRECT_URI: z.string().url('Invalid Twitter redirect URI'),
  
  // App
  NEXT_PUBLIC_APP_URL: z.string().url('Invalid app URL'),
  
  // Optional
  OPENAI_API_KEY: z.string().optional(),
  GROK_API_KEY: z.string().optional(),
  
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      throw new Error(
        `Environment variable validation failed:\n${missingVars.join('\n')}`
      )
    }
    throw error
  }
}

// 起動時に検証
export const env = validateEnv()
```

#### ステップ3: 既存コードの更新

**Before:**
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const apiKey = process.env.ANTHROPIC_API_KEY
```

**After:**
```typescript
import { env } from '@/lib/env'

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const apiKey = env.ANTHROPIC_API_KEY
```

---

### 3. レート制限システム

#### ステップ1: Upstash Redisのセットアップ

```bash
npm install @upstash/redis
```

#### ステップ2: レート制限の実装

```typescript
// lib/rate-limiter.ts
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export interface RateLimitConfig {
  limit: number      // 許可されるリクエスト数
  window: number     // 時間窓（秒）
}

export class RateLimiter {
  async checkLimit(
    userId: string,
    action: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const key = `rate_limit:${userId}:${action}`
    
    // 現在のカウントを取得
    const count = await redis.incr(key)
    
    // 初回リクエストの場合、TTLを設定
    if (count === 1) {
      await redis.expire(key, config.window)
    }
    
    const allowed = count <= config.limit
    const remaining = Math.max(0, config.limit - count)
    const ttl = await redis.ttl(key)
    const resetAt = new Date(Date.now() + ttl * 1000)
    
    return { allowed, remaining, resetAt }
  }
  
  async resetLimit(userId: string, action: string): Promise<void> {
    const key = `rate_limit:${userId}:${action}`
    await redis.del(key)
  }
}

export const rateLimiter = new RateLimiter()

// レート制限設定
export const RATE_LIMITS = {
  POST_TWEET: { limit: 5, window: 86400 },      // 1日5投稿
  GENERATE_DRAFT: { limit: 20, window: 3600 },  // 1時間20生成
  SCHEDULE_TWEET: { limit: 10, window: 3600 },  // 1時間10スケジュール
} as const
```

#### ステップ3: Server Actionでの使用

```typescript
// app/actions.ts
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter'
import { AppError } from '@/lib/errors'

export async function approveAndPostTweet(
  userId: string,
  draft: PostDraft,
  accessToken: string,
  trend: string,
  purpose: string,
  twitterAccountId?: string
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  // レート制限チェック
  const rateLimit = await rateLimiter.checkLimit(
    userId,
    'POST_TWEET',
    RATE_LIMITS.POST_TWEET
  )
  
  if (!rateLimit.allowed) {
    throw new AppError(
      `投稿回数の上限に達しました。リセット時刻: ${rateLimit.resetAt.toLocaleString('ja-JP')}`,
      'RATE_LIMIT_EXCEEDED',
      429,
      '1日の投稿回数の上限に達しました。明日再度お試しください。'
    )
  }
  
  // 既存の投稿処理...
}
```

---

### 4. 入力検証とサニタイゼーション

#### ステップ1: バリデーションスキーマの作成

```typescript
// lib/validation.ts
import { z } from 'zod'

// ツイートテキストの検証
export const tweetTextSchema = z.string()
  .min(1, 'ツイート内容を入力してください')
  .max(280, 'ツイートは280文字以内で入力してください')
  .refine(
    (text) => {
      // スパムパターンのチェック
      const spamPatterns = [
        /click here/i,
        /buy now/i,
        /limited time/i,
        /act now/i,
      ]
      return !spamPatterns.some(pattern => pattern.test(text))
    },
    '不適切な内容が含まれています'
  )
  .refine(
    (text) => {
      // 連続する同じ文字のチェック（例: "aaaaa"）
      return !/(.)\1{4,}/.test(text)
    },
    '不自然な文字列が含まれています'
  )

// トレンドの検証
export const trendSchema = z.string()
  .max(100, 'トレンドは100文字以内で入力してください')
  .optional()

// 目的の検証
export const purposeSchema = z.enum([
  '情報共有',
  'エンゲージメント',
  'アプリ宣伝',
  'その他'
])

// ハッシュタグの検証
export const hashtagSchema = z.string()
  .regex(/^#[\w]+$/, 'ハッシュタグの形式が正しくありません')
  .max(50, 'ハッシュタグは50文字以内で入力してください')

export const hashtagsSchema = z.array(hashtagSchema).max(10, 'ハッシュタグは10個までです')
```

#### ステップ2: Server Actionでの使用

```typescript
// app/actions.ts
import { tweetTextSchema, trendSchema, purposeSchema } from '@/lib/validation'
import { AppError } from '@/lib/errors'

export async function approveAndPostTweet(
  userId: string,
  draft: PostDraft,
  accessToken: string,
  trend: string,
  purpose: string,
  twitterAccountId?: string
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  try {
    // 入力検証
    const validatedText = tweetTextSchema.parse(draft.text)
    const validatedTrend = trendSchema.parse(trend)
    const validatedPurpose = purposeSchema.parse(purpose)
    
    // 検証済みデータで処理を続行
    // ...
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(
        error.errors.map(e => e.message).join(', '),
        'VALIDATION_ERROR',
        400,
        '入力内容に問題があります。確認してください。'
      )
    }
    throw error
  }
}
```

---

## Phase 2: コード構造の最適化

### 1. カスタムフックの作成

#### ツイート生成フック

```typescript
// app/dashboard/hooks/useTweetGeneration.ts
import { useState } from 'react'
import { generatePostDrafts, PostDraft } from '@/app/actions'
import { logger } from '@/lib/logger'
import { useToast } from '@/components/ui/toast'

export function useTweetGeneration() {
  const [drafts, setDrafts] = useState<PostDraft[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { showToast } = useToast()

  const generateDrafts = async (trend: string, purpose: string) => {
    setIsLoading(true)
    try {
      logger.info('Generating tweet drafts', { trend, purpose })
      const generatedDrafts = await generatePostDrafts(trend, purpose)
      setDrafts(generatedDrafts)
      showToast('ツイートドラフトを生成しました', 'success')
      return generatedDrafts
    } catch (error) {
      logger.error('Error generating drafts', error as Error, { trend, purpose })
      showToast('ツイートの生成に失敗しました', 'error')
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const clearDrafts = () => {
    setDrafts([])
  }

  return {
    drafts,
    isLoading,
    generateDrafts,
    clearDrafts,
  }
}
```

#### Twitterアカウント管理フック

```typescript
// app/dashboard/hooks/useTwitterAccounts.ts
import { useState, useEffect } from 'react'
import { getTwitterAccounts, TwitterAccount } from '@/app/actions'
import { logger } from '@/lib/logger'
import { useToast } from '@/components/ui/toast'

export function useTwitterAccounts(userId: string | null) {
  const [accounts, setAccounts] = useState<TwitterAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    if (userId) {
      loadAccounts()
    }
  }, [userId])

  const loadAccounts = async () => {
    if (!userId) return
    
    setIsLoading(true)
    try {
      const loadedAccounts = await getTwitterAccounts(userId)
      setAccounts(loadedAccounts)
      
      // デフォルトアカウントを選択
      const defaultAccount = loadedAccounts.find(acc => acc.is_default) || loadedAccounts[0]
      if (defaultAccount) {
        setSelectedAccountId(defaultAccount.id)
      }
    } catch (error) {
      logger.error('Error loading Twitter accounts', error as Error, { userId })
      showToast('アカウントの読み込みに失敗しました', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const selectAccount = (accountId: string) => {
    setSelectedAccountId(accountId)
  }

  const getSelectedAccount = (): TwitterAccount | undefined => {
    return accounts.find(acc => acc.id === selectedAccountId)
  }

  return {
    accounts,
    selectedAccountId,
    isLoading,
    selectAccount,
    getSelectedAccount,
    reloadAccounts: loadAccounts,
  }
}
```

---

### 2. エラーハンドリングの統一

#### カスタムエラークラス

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public userMessage?: string,
    public context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export class TwitterAPIError extends AppError {
  constructor(message: string, statusCode: number, context?: Record<string, unknown>) {
    const userMessages: Record<number, string> = {
      401: 'Twitter認証に失敗しました。再度連携してください。',
      403: 'Twitter APIの権限が不足しています。',
      429: 'Twitter APIのレート制限に達しました。しばらく待ってからお試しください。',
    }
    
    super(
      message,
      'TWITTER_API_ERROR',
      statusCode,
      userMessages[statusCode] || 'Twitter APIでエラーが発生しました',
      context
    )
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(
      message,
      'VALIDATION_ERROR',
      400,
      '入力内容に問題があります。確認してください。',
      { field }
    )
  }
}

export class RateLimitError extends AppError {
  constructor(resetAt: Date) {
    super(
      'Rate limit exceeded',
      'RATE_LIMIT_EXCEEDED',
      429,
      `投稿回数の上限に達しました。リセット時刻: ${resetAt.toLocaleString('ja-JP')}`,
      { resetAt: resetAt.toISOString() }
    )
  }
}
```

#### エラーハンドリングユーティリティ

```typescript
// lib/error-handler.ts
import { AppError } from './errors'
import { logger } from './logger'

export interface ErrorResponse {
  message: string
  code: string
  statusCode: number
  context?: Record<string, unknown>
}

export function handleError(error: unknown): ErrorResponse {
  if (error instanceof AppError) {
    logger.error('App error', error, error.context)
    return {
      message: error.userMessage || error.message,
      code: error.code,
      statusCode: error.statusCode,
      context: error.context,
    }
  }
  
  if (error instanceof Error) {
    logger.error('Unexpected error', error)
    return {
      message: '予期しないエラーが発生しました',
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
    }
  }
  
  logger.error('Unknown error type', new Error(String(error)))
  return {
    message: '予期しないエラーが発生しました',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
  }
}

// Server Actionでの使用例
export async function safeServerAction<T>(
  action: () => Promise<T>
): Promise<{ success: true; data: T } | { success: false; error: ErrorResponse }> {
  try {
    const data = await action()
    return { success: true, data }
  } catch (error) {
    return { success: false, error: handleError(error) }
  }
}
```

---

## 📝 移行チェックリスト

### セキュリティ
- [ ] `lib/logger.ts`を作成し、全`console.log`を置き換え
- [ ] `lib/env.ts`を作成し、環境変数を検証
- [ ] レート制限システムを実装
- [ ] 入力検証スキーマを作成

### コード構造
- [ ] カスタムフックを作成（`useTweetGeneration`, `useTwitterAccounts`等）
- [ ] エラーハンドリングを統一（`AppError`クラスを使用）
- [ ] ダッシュボードコンポーネントを分割

### テスト
- [ ] 各機能のユニットテストを作成
- [ ] エラーハンドリングのテスト
- [ ] レート制限のテスト

---

## 🎯 次のステップ

1. **Phase 1の実装**: セキュリティ強化から開始
2. **段階的移行**: 既存コードを少しずつ置き換え
3. **テスト**: 各変更後にテストを実行
4. **ドキュメント更新**: 変更内容をドキュメントに反映

---

このガイドに従って実装を進めることで、コードベースを段階的に改善できます。
