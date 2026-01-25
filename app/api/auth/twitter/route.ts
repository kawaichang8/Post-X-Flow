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

    console.log("=".repeat(80))
    console.log("[Twitter OAuth] ===== STARTING OAUTH FLOW =====")
    console.log("[Twitter OAuth] User ID:", userId)
    console.log("[Twitter OAuth] Timestamp:", new Date().toISOString())
    
    // Use simple implementation - let Twitter handle account selection naturally
    // Users should switch accounts on X side before clicking "Add Account"
    const { url, codeVerifier, state } = await getTwitterAuthUrl(false)

    console.log("[Twitter OAuth] Auth URL generated (simple implementation), storing in database...")
    console.log("[Twitter OAuth] Generated OAuth URL:", url)
    console.log("[Twitter OAuth] State:", state)
    console.log("[Twitter OAuth] Code Verifier length:", codeVerifier?.length || 0)
    
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
