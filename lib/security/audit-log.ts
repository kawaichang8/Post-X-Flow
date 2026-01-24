/**
 * セキュリティ監査ログ
 * APIキーアクセス、認証イベント、セキュリティ関連イベントを記録
 */

import 'server-only'
import { createServerClient } from '../supabase'

export enum AuditEventType {
  API_KEY_ACCESS = 'api_key_access',
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  TOKEN_REFRESH = 'token_refresh',
  POST_ATTEMPT = 'post_attempt',
  POST_SUCCESS = 'post_success',
  POST_FAILURE = 'post_failure',
  RATE_LIMIT_HIT = 'rate_limit_hit',
  SECURITY_ALERT = 'security_alert',
}

export interface AuditLogEntry {
  event_type: AuditEventType
  user_id?: string
  ip_address?: string
  user_agent?: string
  details?: Record<string, any>
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: string
}

/**
 * 監査ログを記録
 */
export async function logAuditEvent(
  eventType: AuditEventType,
  options: {
    userId?: string
    ipAddress?: string
    userAgent?: string
    details?: Record<string, any>
    severity?: 'low' | 'medium' | 'high' | 'critical'
  } = {}
): Promise<void> {
  try {
    const {
      userId,
      ipAddress,
      userAgent,
      details,
      severity = 'low',
    } = options

    const entry: AuditLogEntry = {
      event_type: eventType,
      user_id: userId,
      ip_address: ipAddress,
      user_agent: userAgent,
      details: details || {},
      severity,
      timestamp: new Date().toISOString(),
    }

    // 本番環境ではSupabaseに保存、開発環境ではコンソールに出力
    if (process.env.NODE_ENV === 'production') {
      const supabase = createServerClient()
      await supabase.from('audit_logs').insert(entry).catch((error: unknown) => {
        // ログ保存失敗は致命的ではないので、コンソールに出力
        console.error('[Audit Log] Failed to save audit log:', error)
        console.log('[Audit Log] Entry:', JSON.stringify(entry, null, 2))
      })
    } else {
      // 開発環境ではコンソールに出力
      console.log('[Audit Log]', JSON.stringify(entry, null, 2))
    }
  } catch (error) {
    // 監査ログの記録失敗はアプリケーションの動作を妨げない
    console.error('[Audit Log] Error logging event:', error)
  }
}

/**
 * APIキーアクセスを記録
 */
export async function logApiKeyAccess(
  apiType: 'anthropic' | 'grok' | 'twitter',
  userId?: string,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent(AuditEventType.API_KEY_ACCESS, {
    userId,
    ipAddress,
    details: { api_type: apiType },
    severity: 'medium',
  })
}

/**
 * 認証成功を記録
 */
export async function logAuthSuccess(
  userId: string,
  provider: 'twitter' | 'email',
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent(AuditEventType.AUTH_SUCCESS, {
    userId,
    ipAddress,
    userAgent,
    details: { provider },
    severity: 'low',
  })
}

/**
 * 認証失敗を記録
 */
export async function logAuthFailure(
  provider: 'twitter' | 'email',
  reason: string,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent(AuditEventType.AUTH_FAILURE, {
    ipAddress,
    details: { provider, reason },
    severity: 'medium',
  })
}

/**
 * セキュリティアラートを記録
 */
export async function logSecurityAlert(
  alert: string,
  details: Record<string, any>,
  severity: 'high' | 'critical' = 'high',
  userId?: string,
  ipAddress?: string
): Promise<void> {
  await logAuditEvent(AuditEventType.SECURITY_ALERT, {
    userId,
    ipAddress,
    details: { alert, ...details },
    severity,
  })
}
