/**
 * 環境変数検証とセキュリティチェック
 * ビルド時とランタイムで環境変数の安全性を検証
 */

import 'server-only'

export interface EnvValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * 環境変数の検証
 */
export function validateEnvironmentVariables(): EnvValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 必須のサーバーサイド環境変数
  const requiredServerVars = [
    'ANTHROPIC_API_KEY',
    'TWITTER_CLIENT_ID',
    'TWITTER_CLIENT_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]

  for (const varName of requiredServerVars) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`)
    } else {
      // 環境変数がNEXT_PUBLIC_で始まっていないことを確認（セキュリティ）
      if (varName.startsWith('NEXT_PUBLIC_')) {
        warnings.push(`Warning: ${varName} is exposed to client. Ensure this is intentional.`)
      }
    }
  }

  // クライアントサイド環境変数（NEXT_PUBLIC_プレフィックス）
  const requiredClientVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]

  for (const varName of requiredClientVars) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`)
    }
  }

  // セキュリティチェック: 機密情報がNEXT_PUBLIC_で始まっていないか
  const sensitiveVars = [
    'ANTHROPIC_API_KEY',
    'GROK_API_KEY',
    'TWITTER_CLIENT_SECRET',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]

  for (const varName of sensitiveVars) {
    if (process.env[`NEXT_PUBLIC_${varName}`]) {
      errors.push(`CRITICAL: ${varName} is exposed with NEXT_PUBLIC_ prefix. This is a security risk!`)
    }
  }

  // URL形式の検証
  const urlVars = [
    { name: 'NEXT_PUBLIC_SUPABASE_URL', value: process.env.NEXT_PUBLIC_SUPABASE_URL },
    { name: 'TWITTER_REDIRECT_URI', value: process.env.TWITTER_REDIRECT_URI },
    { name: 'NEXT_PUBLIC_APP_URL', value: process.env.NEXT_PUBLIC_APP_URL },
  ]

  for (const { name, value } of urlVars) {
    if (value) {
      try {
        const url = new URL(value)
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push(`${name} must use HTTP or HTTPS protocol`)
        }
        if (url.protocol === 'http:' && process.env.NODE_ENV === 'production') {
          warnings.push(`${name} uses HTTP in production. Consider using HTTPS.`)
        }
      } catch {
        errors.push(`${name} is not a valid URL: ${value}`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * ビルド時の環境変数検証
 * next.config.tsやビルドスクリプトから呼び出す
 */
export function validateEnvironmentAtBuildTime(): void {
  if (typeof window !== 'undefined') {
    throw new Error('validateEnvironmentAtBuildTime can only be called on the server')
  }

  const result = validateEnvironmentVariables()

  if (!result.valid) {
    console.error('❌ Environment variable validation failed:')
    result.errors.forEach((error) => console.error(`  - ${error}`))
    throw new Error('Environment variable validation failed. Please check your configuration.')
  }

  if (result.warnings.length > 0) {
    console.warn('⚠️  Environment variable warnings:')
    result.warnings.forEach((warning) => console.warn(`  - ${warning}`))
  }

  console.log('✅ Environment variables validated successfully')
}
