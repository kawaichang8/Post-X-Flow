/**
 * Server-only marker
 * This file ensures that any module importing from it can only run on the server
 */
import 'server-only'

/**
 * Server-only environment variable getters
 * These functions ensure API keys are never exposed to the client
 */

/**
 * Get Anthropic API key (server-only)
 * @throws Error if key is missing or accessed from client
 */
export function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY is not set. Please configure it in Vercel environment variables.')
  }
  return key
}

/**
 * Get Grok API key (server-only)
 * @throws Error if key is missing or accessed from client
 */
export function getGrokApiKey(): string {
  const key = process.env.GROK_API_KEY
  if (!key) {
    throw new Error('GROK_API_KEY is not set. Please configure it in Vercel environment variables.')
  }
  return key
}

/**
 * Get Twitter Client ID (server-only)
 * @throws Error if key is missing or accessed from client
 */
export function getTwitterClientId(): string {
  const key = process.env.TWITTER_CLIENT_ID
  if (!key) {
    throw new Error('TWITTER_CLIENT_ID is not set. Please configure it in Vercel environment variables.')
  }
  return key
}

/**
 * Get Twitter Client Secret (server-only)
 * @throws Error if key is missing or accessed from client
 */
export function getTwitterClientSecret(): string {
  const key = process.env.TWITTER_CLIENT_SECRET
  if (!key) {
    throw new Error('TWITTER_CLIENT_SECRET is not set. Please configure it in Vercel environment variables.')
  }
  return key
}

/**
 * Get Supabase Service Role Key (server-only)
 * @throws Error if key is missing or accessed from client
 */
export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Please configure it in Vercel environment variables.')
  }
  return key
}

/**
 * Validate that we're running on the server
 * This is a runtime check to prevent accidental client-side usage
 */
export function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error('This code can only run on the server. It contains sensitive API keys.')
  }
}
