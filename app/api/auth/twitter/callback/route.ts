import { NextRequest, NextResponse } from "next/server"
import { getTwitterAccessToken, getTwitterUserInfo } from "@/lib/x-post"
import { cookies } from "next/headers"
import { createServerClient } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  const baseUrl = request.nextUrl.origin
  console.log("[Twitter OAuth Callback] Callback received")
  console.log("[Twitter OAuth Callback] Full URL:", request.url)
  
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
    
    console.log("[Twitter OAuth Callback] Existing accounts for user:", allUserAccounts?.map((acc: { id: string; twitter_user_id: string | null; username: string | null; account_name: string | null }) => ({
      id: acc.id,
      twitter_user_id: acc.twitter_user_id,
      username: acc.username,
      account_name: acc.account_name
    })))

    console.log("[Twitter OAuth Callback] Storing account in database...")
    console.log("[Twitter OAuth Callback] Twitter user ID:", userInfo.id)
    console.log("[Twitter OAuth Callback] Twitter username:", userInfo.username)
    console.log("[Twitter OAuth Callback] Twitter display name:", userInfo.name)
    
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
      console.log("[Twitter OAuth Callback] Found existing account:", {
        id: existingAccount.id,
        username: existingAccount.username,
        twitter_user_id: existingAccount.twitter_user_id,
        account_name: existingAccount.account_name
      })
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
      
      console.log("[Twitter OAuth Callback] Existing account updated successfully")
      // Show message that account was already connected and tokens were refreshed
      // Redirect with account_already_exists flag to show appropriate message
      return NextResponse.redirect(`${baseUrl}/dashboard?twitter_connected=true&account_already_exists=true&account_username=${encodeURIComponent(userInfo.username || "")}`)
    }

    // This is a new account - add it
    console.log("[Twitter OAuth Callback] No existing account found - this is a new account")
    
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
    
    console.log("[Twitter OAuth Callback] New account inserted successfully")
    console.log("[Twitter OAuth Callback] Tokens stored successfully")
    console.log("[Twitter OAuth Callback] Redirecting to dashboard with success message...")
    return NextResponse.redirect(`${baseUrl}/dashboard?twitter_connected=true`)
  } catch (error) {
    console.error("[Twitter OAuth Callback] Error in Twitter OAuth callback:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[Twitter OAuth Callback] Error details:", errorMessage)
    return NextResponse.redirect(`${baseUrl}/dashboard?error=oauth_failed&details=${encodeURIComponent(errorMessage)}`)
  }
}
