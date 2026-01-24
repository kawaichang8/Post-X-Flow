import { createClient } from '@supabase/supabase-js'

// Get environment variables with validation
function getSupabaseConfig() {
  // Force read from process.env at runtime
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

  // Always log in development to debug
  console.log('[Supabase Config] Checking environment variables...')
  console.log('[Supabase Config] URL exists:', !!supabaseUrl)
  console.log('[Supabase Config] URL length:', supabaseUrl.length)
  console.log('[Supabase Config] URL value:', supabaseUrl || 'NOT SET')
  console.log('[Supabase Config] Key exists:', !!supabaseAnonKey)
  console.log('[Supabase Config] Key length:', supabaseAnonKey.length)

  if (!supabaseUrl || !supabaseAnonKey) {
    const errorMsg = `Missing Supabase environment variables:
  NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl || 'NOT SET'} (length: ${supabaseUrl.length})
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'SET' : 'NOT SET'} (length: ${supabaseAnonKey.length})
  
  Please check your .env.local file and restart the dev server.`
    console.error(errorMsg)
    throw new Error(errorMsg)
  }

  // Validate URL format
  try {
    const url = new URL(supabaseUrl)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('URL must use HTTP or HTTPS protocol')
    }
    console.log('[Supabase Config] URL validation passed:', url.hostname)
  } catch (error) {
    const errorMsg = `Invalid Supabase URL format: "${supabaseUrl}". Must be a valid HTTP or HTTPS URL.`
    console.error(errorMsg)
    throw new Error(errorMsg)
  }

  return { supabaseUrl, supabaseAnonKey }
}

// Create client lazily
let supabaseClient: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (!supabaseClient) {
    console.log('[Supabase] Creating client...')
    const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig()
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey)
    console.log('[Supabase] Client created successfully')
  }
  return supabaseClient
}

// Export for backward compatibility - but make it lazy
export const supabase = getSupabaseClient()

// Server-side client for admin operations
export function createServerClient() {
  // This function should only be called from server-side code
  if (typeof window !== 'undefined') {
    throw new Error('createServerClient can only be called from server-side code')
  }
  
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Please configure it in Vercel environment variables.')
  }
  const { supabaseUrl } = getSupabaseConfig()
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
