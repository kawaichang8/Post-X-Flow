import { NextResponse, type NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function middleware(request: NextRequest) {
  // Simple auth check - redirect logic handled in pages
  // For production, consider using @supabase/ssr for better cookie handling
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
