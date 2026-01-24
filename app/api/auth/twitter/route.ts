import { NextRequest, NextResponse } from "next/server"
import { getTwitterAuthUrl } from "@/lib/x-post"
import { cookies } from "next/headers"
import { createServerClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  try {
    // Get user ID from query parameter (sent from client)
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) {
      const baseUrl = request.nextUrl.origin
      console.error("[Twitter OAuth] No user ID provided")
      return NextResponse.redirect(`${baseUrl}/dashboard?error=no_user_id`)
    }

    console.log("[Twitter OAuth] Starting OAuth flow for user:", userId)
    // Don't use force_login=true - let users switch accounts on X side before starting OAuth
    // If user switches account on X before clicking, that account will be selected
    const { url, codeVerifier, state } = await getTwitterAuthUrl(false)

    console.log("[Twitter OAuth] Auth URL generated (with force_login=true), storing in database...")
    
    // Store state, codeVerifier, and user ID in database (more reliable than cookies with ngrok)
    const supabaseAdmin = createServerClient()
    
    const { error: dbError } = await supabaseAdmin.from("twitter_oauth_sessions").insert({
      state: state,
      user_id: userId,
      code_verifier: codeVerifier,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
    })

    if (dbError) {
      console.error("[Twitter OAuth] Error storing OAuth session:", dbError)
      const baseUrl = request.nextUrl.origin
      return NextResponse.redirect(`${baseUrl}/dashboard?error=session_storage_failed`)
    }

    console.log("[Twitter OAuth] OAuth session stored successfully")
    console.log("[Twitter OAuth] Redirecting to Twitter...")
    return NextResponse.redirect(url)
  } catch (error) {
    console.error("[Twitter OAuth] Error initiating Twitter OAuth:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const baseUrl = request.nextUrl.origin
    return NextResponse.redirect(`${baseUrl}/dashboard?error=oauth_init_failed&details=${encodeURIComponent(errorMessage)}`)
  }
}
