import { NextRequest, NextResponse } from "next/server"
import { getTwitterAccessToken, getTwitterUserInfo } from "@/lib/x-post"
import { cookies } from "next/headers"
import { createServerClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  // Always log callback received - this helps debug if callback is being called
  // Use simple log format that Vercel can display
  const baseUrl = request.nextUrl.origin
  const fullUrl = request.url
  const timestamp = new Date().toISOString()
  
  // Use simple console.log that Vercel can display
  console.log("[CALLBACK] Received at", timestamp)
  console.log("[CALLBACK] URL:", fullUrl)
  console.log("[CALLBACK] Base URL:", baseUrl)
  
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  console.log("[Twitter OAuth Callback] Parameters:", {
    hasCode: !!code,
    hasState: !!state,
    hasError: !!error,
    error,
    errorDescription,
  })

  // Check for OAuth errors from Twitter
  if (error) {
    console.error("[Twitter OAuth Callback] Twitter OAuth error:", error, errorDescription)
    return NextResponse.redirect(`${baseUrl}/dashboard?error=twitter_oauth_error&details=${encodeURIComponent(errorDescription || error)}`)
  }

  if (!code) {
    console.error("[Twitter OAuth Callback] No authorization code received from Twitter")
    return NextResponse.redirect(`${baseUrl}/dashboard?error=no_code`)
  }

  if (!state) {
    console.error("[Twitter OAuth Callback] No state received from Twitter")
    return NextResponse.redirect(`${baseUrl}/dashboard?error=no_state`)
  }

  try {
    // Get OAuth session from database using state
    const supabaseAdmin = createServerClient()
    
    console.log("[Twitter OAuth Callback] Looking up OAuth session for state:", state)
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from("twitter_oauth_sessions")
      .select("user_id, code_verifier")
      .eq("state", state)
      .gt("expires_at", new Date().toISOString()) // Only get non-expired sessions
      .single()

    if (sessionError || !sessionData) {
      console.error("[Twitter OAuth Callback] OAuth session not found or expired:", sessionError)
      return NextResponse.redirect(`${baseUrl}/dashboard?error=session_not_found`)
    }

    const { user_id: userId, code_verifier: codeVerifier } = sessionData
    console.log("[Twitter OAuth Callback] OAuth session found for user:", userId)

    // Delete the session (one-time use)
    await supabaseAdmin
      .from("twitter_oauth_sessions")
      .delete()
      .eq("state", state)

    console.log("[Twitter OAuth Callback] Exchanging code for access token...")
    // Exchange code for access token
    const { accessToken, refreshToken } = await getTwitterAccessToken(
      code,
      codeVerifier
    )

    console.log("[Twitter OAuth Callback] Access token received, fetching user info...")
    
    // Get Twitter user information - this is required to identify the account
    let userInfo
    try {
      userInfo = await getTwitterUserInfo(accessToken)
      console.log("[Twitter OAuth Callback] User info fetched:", {
        id: userInfo?.id,
        username: userInfo?.username,
        name: userInfo?.name
      })
    } catch (error) {
      console.error("[Twitter OAuth Callback] Error fetching user info:", error)
      // Cannot proceed without user info - we need twitter_user_id to check for duplicates
      return NextResponse.redirect(`${baseUrl}/dashboard?error=user_info_fetch_failed&details=${encodeURIComponent(error instanceof Error ? error.message : "Failed to fetch user information")}`)
    }

    // Validate userInfo
    if (!userInfo || !userInfo.id) {
      console.error("[Twitter OAuth Callback] Invalid user info:", userInfo)
      return NextResponse.redirect(`${baseUrl}/dashboard?error=invalid_user_info`)
    }

    // Log all existing accounts for this user (for debugging)
    const { data: allUserAccounts } = await supabaseAdmin
      .from("user_twitter_tokens")
      .select("id, twitter_user_id, username, account_name")
      .eq("user_id", userId)
    
    const existingAccountIds = allUserAccounts?.map((acc: { twitter_user_id: string | null }) => acc.twitter_user_id).filter(Boolean) || []
    console.log("[CALLBACK] Existing account Twitter IDs:", existingAccountIds.join(", ") || "none")
    console.log("[CALLBACK] Authenticated Twitter ID:", userInfo.id, "Username:", userInfo.username)
    
    // Check if this Twitter account is already linked to this user
    // Use twitter_user_id to identify the account (not username, as it can change)
    console.log("[Twitter OAuth Callback] Checking for existing account with twitter_user_id:", userInfo.id)
    const { data: existingAccount, error: checkError } = await supabaseAdmin
      .from("user_twitter_tokens")
      .select("id, is_default, username, twitter_user_id, account_name")
      .eq("user_id", userId)
      .eq("twitter_user_id", userInfo.id)
      .maybeSingle()
    
    console.log("[Twitter OAuth Callback] Existing account check result:", {
      found: !!existingAccount,
      accountId: existingAccount?.id,
      username: existingAccount?.username,
      twitter_user_id: existingAccount?.twitter_user_id,
      checkError: checkError ? { code: checkError.code, message: checkError.message } : null
    })

    if (checkError && checkError.code !== 'PGRST116') {
      console.error("[Twitter OAuth Callback] Error checking existing account:", checkError)
      return NextResponse.redirect(`${baseUrl}/dashboard?error=storage_failed&details=${encodeURIComponent(checkError.message)}`)
    }

    if (existingAccount) {
      console.log("[CALLBACK] EXISTING ACCOUNT FOUND - Twitter ID:", userInfo.id, "Username:", userInfo.username)
      console.log("[CALLBACK] This account is already linked. To add different account, logout from X first.")
      // If this is the same account, just update tokens (refresh)
      // This prevents duplicate accounts from being created
      console.log("[Twitter OAuth Callback] Updating existing account (refreshing tokens)...")
      const { error: updateError } = await supabaseAdmin
        .from("user_twitter_tokens")
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          username: userInfo.username || null,
          display_name: userInfo.name || null,
          profile_image_url: userInfo.profile_image_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAccount.id)
      
      if (updateError) {
        console.error("[Twitter OAuth Callback] Error updating existing account:", updateError)
        return NextResponse.redirect(`${baseUrl}/dashboard?error=storage_failed&details=${encodeURIComponent(updateError.message)}`)
      }
      
      console.log("[CALLBACK] EXISTING ACCOUNT UPDATED - Twitter ID:", userInfo.id, "Username:", userInfo.username)
      // Show message that account was already connected and tokens were refreshed
      // Redirect with account_already_exists flag to show appropriate message
      return NextResponse.redirect(`${baseUrl}/dashboard?twitter_connected=true&account_already_exists=true&account_username=${encodeURIComponent(userInfo.username || "")}&account_id=${encodeURIComponent(userInfo.id)}`)
    }

    // This is a new account - add it
    console.log("[CALLBACK] NEW ACCOUNT DETECTED - Twitter ID:", userInfo.id, "Username:", userInfo.username)
    
    // Check if user has any accounts (to determine if this should be default)
    const { data: existingAccounts } = await supabaseAdmin
      .from("user_twitter_tokens")
      .select("id")
      .eq("user_id", userId)

    const isFirstAccount = !existingAccounts || existingAccounts.length === 0
    const isDefault = isFirstAccount

    console.log("[Twitter OAuth Callback] Inserting new account...")
    const { error: insertError } = await supabaseAdmin
      .from("user_twitter_tokens")
      .insert({
        user_id: userId,
        twitter_user_id: userInfo.id, // Required - cannot be null
        access_token: accessToken,
        refresh_token: refreshToken,
        username: userInfo.username || null,
        display_name: userInfo.name || null,
        profile_image_url: userInfo.profile_image_url || null,
        account_name: userInfo.username || null, // Default account name to username
        is_default: isDefault,
        updated_at: new Date().toISOString(),
      })
    
    if (insertError) {
      console.error("[Twitter OAuth Callback] Error inserting new account:", insertError)
      return NextResponse.redirect(`${baseUrl}/dashboard?error=storage_failed&details=${encodeURIComponent(insertError.message)}`)
    }
    
    console.log("[CALLBACK] NEW ACCOUNT ADDED SUCCESSFULLY - Twitter ID:", userInfo.id, "Username:", userInfo.username)
    return NextResponse.redirect(`${baseUrl}/dashboard?twitter_connected=true`)
  } catch (error) {
    console.error("[Twitter OAuth Callback] Error in Twitter OAuth callback:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Twitter OAuth Callback] Error details:", errorMessage)
    return NextResponse.redirect(`${baseUrl}/dashboard?error=oauth_failed&details=${encodeURIComponent(errorMessage)}`)
  }
}
