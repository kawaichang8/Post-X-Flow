import { NextRequest, NextResponse } from "next/server"
import { getTwitterAuthUrl } from "@/lib/x-post"
import { createServerClient } from "@/lib/supabase"

// Get OAuth URL without redirecting (for copying to clipboard or opening in incognito)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    console.log("[Twitter OAuth URL] Generating auth URL for user:", userId)
    const { url, codeVerifier, state } = await getTwitterAuthUrl(true)

    console.log("[Twitter OAuth URL] Auth URL generated, storing in database...")
    
    // Store state, codeVerifier, and user ID in database
    const supabaseAdmin = createServerClient()
    
    const { error: dbError } = await supabaseAdmin.from("twitter_oauth_sessions").insert({
      state: state,
      user_id: userId,
      code_verifier: codeVerifier,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
    })

    if (dbError) {
      console.error("[Twitter OAuth URL] Error storing OAuth session:", dbError)
      return NextResponse.json(
        { error: "Failed to store OAuth session" },
        { status: 500 }
      )
    }

    console.log("[Twitter OAuth URL] OAuth session stored successfully")
    return NextResponse.json({ url })
  } catch (error) {
    console.error("[Twitter OAuth URL] Error generating OAuth URL:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
