/**
 * エラーハンドリングユーティリティ
 * X API、AI API、Supabaseのエラーを統一的に処理
 */

export enum ErrorType {
  RATE_LIMIT = 'RATE_LIMIT',
  AUTH_ERROR = 'AUTH_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface AppError {
  type: ErrorType
  message: string
  originalError?: any
  retryable: boolean
  retryAfter?: number // seconds
  statusCode?: number
  details?: Record<string, any>
}

/**
 * エラーを分類してAppErrorに変換
 */
export function classifyError(error: any): AppError {
  // X API エラー
  if (error?.code === 429) {
    const retryAfter = extractRetryAfter(error)
    return {
      type: ErrorType.RATE_LIMIT,
      message: 'X APIのレート制限に達しました。しばらく待ってから再試行してください。',
      originalError: error,
      retryable: true,
      retryAfter,
      statusCode: 429,
      details: { api: 'twitter', retryAfter },
    }
  }

  if (error?.code === 401) {
    return {
      type: ErrorType.AUTH_ERROR,
      message: 'X API認証エラー: アクセストークンが無効または期限切れです。Twitter連携を再度行ってください。',
      originalError: error,
      retryable: false,
      statusCode: 401,
      details: { api: 'twitter', action: 'refresh_token_required' },
    }
  }

  if (error?.code === 403) {
    return {
      type: ErrorType.AUTH_ERROR,
      message: 'X API権限エラー: 投稿権限がありません。Twitter Developer Portalで権限を確認してください。',
      originalError: error,
      retryable: false,
      statusCode: 403,
      details: { api: 'twitter', action: 'check_permissions' },
    }
  }

  // Claude API エラー
  if (error?.status === 429) {
    const retryAfter = extractRetryAfter(error)
    return {
      type: ErrorType.RATE_LIMIT,
      message: 'Claude APIのレート制限に達しました。しばらく待ってから再試行してください。',
      originalError: error,
      retryable: true,
      retryAfter,
      statusCode: 429,
      details: { api: 'claude', retryAfter },
    }
  }

  if (error?.status === 401) {
    return {
      type: ErrorType.AUTH_ERROR,
      message: 'Claude API認証エラー: APIキーが無効です。環境変数を確認してください。',
      originalError: error,
      retryable: false,
      statusCode: 401,
      details: { api: 'claude', action: 'check_api_key' },
    }
  }

  // Supabase エラー
  if (error?.code === 'PGRST116' || error?.message?.includes('connection')) {
    return {
      type: ErrorType.DATABASE_ERROR,
      message: 'データベース接続エラーが発生しました。ローカルストレージに保存します。',
      originalError: error,
      retryable: true,
      retryAfter: 5,
      details: { database: 'supabase', action: 'use_local_storage' },
    }
  }

  if (error?.code?.startsWith('PGRST') || error?.code?.startsWith('235')) {
    return {
      type: ErrorType.DATABASE_ERROR,
      message: `データベースエラー: ${error.message || '不明なエラーが発生しました'}`,
      originalError: error,
      retryable: true,
      retryAfter: 2,
      details: { database: 'supabase', code: error.code },
    }
  }

  // ネットワークエラー
  if (error?.message?.includes('fetch') || error?.message?.includes('network') || error?.code === 'ECONNREFUSED') {
    return {
      type: ErrorType.NETWORK_ERROR,
      message: 'ネットワークエラーが発生しました。接続を確認して再試行してください。',
      originalError: error,
      retryable: true,
      retryAfter: 5,
      details: { network: true },
    }
  }

  // デフォルト
  return {
    type: ErrorType.UNKNOWN_ERROR,
    message: error?.message || '不明なエラーが発生しました',
    originalError: error,
    retryable: false,
    details: { unknown: true },
  }
}

/**
 * レスポンスヘッダーからRetry-Afterを抽出
 */
function extractRetryAfter(error: any): number | undefined {
  // X API のレート制限: 15分 = 900秒
  if (error?.code === 429) {
    return 900
  }

  // Claude API: レスポンスヘッダーから取得
  if (error?.response?.headers?.['retry-after']) {
    return parseInt(error.response.headers['retry-after'], 10)
  }

  // デフォルト: 60秒
  return 60
}

/**
 * エラーログをSentryに送信（準備）
 */
export async function logErrorToSentry(error: AppError, context?: Record<string, any>) {
  // TODO: Sentry統合
  // if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  //   Sentry.captureException(error.originalError, {
  //     tags: {
  //       errorType: error.type,
  //       retryable: error.retryable,
  //     },
  //     extra: {
  //       ...error.details,
  //       ...context,
  //     },
  //   })
  // }

  // 開発環境では詳細ログを出力
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error Handler]', {
      type: error.type,
      message: error.message,
      retryable: error.retryable,
      retryAfter: error.retryAfter,
      details: error.details,
      context,
      originalError: error.originalError,
    })
  }
}

/**
 * 指数バックオフでリトライ
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    multiplier?: number
    onRetry?: (attempt: number, error: any) => void
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    multiplier = 2,
    onRetry,
  } = options

  let lastError: any
  let delay = initialDelay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const appError = classifyError(error)

      // リトライ不可能なエラーは即座にスロー
      if (!appError.retryable || attempt === maxRetries) {
        throw appError
      }

      // Retry-Afterが指定されている場合はそれを使用
      if (appError.retryAfter) {
        delay = appError.retryAfter * 1000
      } else {
        delay = Math.min(delay * multiplier, maxDelay)
      }

      if (onRetry) {
        onRetry(attempt + 1, appError)
      }

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
