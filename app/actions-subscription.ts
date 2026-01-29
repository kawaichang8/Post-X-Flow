"use server"

import { createServerClient } from "@/lib/supabase"

// ============================================
// Types
// ============================================
export type SubscriptionStatus = "free" | "trial" | "pro" | "cancelled"

export interface UserSubscription {
  id: string
  user_id: string
  subscription_status: SubscriptionStatus
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  trial_started_at: string | null
  trial_ends_at: string | null
  subscription_started_at: string | null
  subscription_ends_at: string | null
  created_at: string
  updated_at: string
}

export interface UsageTracking {
  id: string
  user_id: string
  usage_date: string
  generation_count: number
  post_count: number
  media_upload_count: number
}

export interface SubscriptionLimits {
  maxGenerationsPerDay: number
  canUseRepostSuggestions: boolean
  canUseUnlimitedMedia: boolean
  canUseAdvancedAnalytics: boolean
  canUseScheduling: boolean
}

// Free tier limits
const FREE_LIMITS: SubscriptionLimits = {
  maxGenerationsPerDay: 3,
  canUseRepostSuggestions: false,
  canUseUnlimitedMedia: false,
  canUseAdvancedAnalytics: false,
  canUseScheduling: true, // Basic scheduling allowed
}

// Pro tier limits
const PRO_LIMITS: SubscriptionLimits = {
  maxGenerationsPerDay: Infinity,
  canUseRepostSuggestions: true,
  canUseUnlimitedMedia: true,
  canUseAdvancedAnalytics: true,
  canUseScheduling: true,
}

// ============================================
// Get user subscription
// ============================================
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  try {
    const supabase = createServerClient()
    
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .single()
    
    if (error) {
      // If no subscription found, create one
      if (error.code === "PGRST116") {
        return await createUserSubscription(userId)
      }
      console.error("Error getting subscription:", error)
      return null
    }
    
    return data as UserSubscription
  } catch (error) {
    console.error("Error getting subscription:", error)
    return null
  }
}

// ============================================
// Create user subscription (for new users)
// ============================================
export async function createUserSubscription(userId: string): Promise<UserSubscription | null> {
  try {
    const supabase = createServerClient()
    
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 7) // 7-day trial
    
    const { data, error } = await supabase
      .from("user_subscriptions")
      .insert({
        user_id: userId,
        subscription_status: "trial",
        trial_started_at: new Date().toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
      })
      .select()
      .single()
    
    if (error) {
      console.error("Error creating subscription:", error)
      return null
    }
    
    return data as UserSubscription
  } catch (error) {
    console.error("Error creating subscription:", error)
    return null
  }
}

// ============================================
// Check if user is Pro (includes active trial)
// ============================================
export async function isUserPro(userId: string): Promise<boolean> {
  // 開発・自己運用でProを強制: .env に FORCE_PRO=true を設定
  if (process.env.FORCE_PRO === "true") return true

  const subscription = await getUserSubscription(userId)
  if (!subscription) return false

  if (subscription.subscription_status === "pro") {
    return true
  }

  if (subscription.subscription_status === "trial" && subscription.trial_ends_at) {
    const trialEndsAt = new Date(subscription.trial_ends_at)
    return trialEndsAt > new Date()
  }

  return false
}

// ============================================
// Get subscription limits based on status
// ============================================
export async function getSubscriptionLimits(userId: string): Promise<SubscriptionLimits> {
  const isPro = await isUserPro(userId)
  return isPro ? PRO_LIMITS : FREE_LIMITS
}

// ============================================
// Get today's usage
// ============================================
export async function getTodayUsage(userId: string): Promise<UsageTracking | null> {
  try {
    const supabase = createServerClient()
    
    const today = new Date().toISOString().split("T")[0]
    
    const { data, error } = await supabase
      .from("usage_tracking")
      .select("*")
      .eq("user_id", userId)
      .eq("usage_date", today)
      .single()
    
    if (error && error.code !== "PGRST116") {
      console.error("Error getting usage:", error)
    }
    
    return data as UsageTracking | null
  } catch (error) {
    console.error("Error getting usage:", error)
    return null
  }
}

// ============================================
// Increment generation count
// ============================================
export async function incrementGenerationCount(userId: string): Promise<{ success: boolean; count: number; limitReached: boolean }> {
  try {
    const supabase = createServerClient()
    
    const today = new Date().toISOString().split("T")[0]
    const limits = await getSubscriptionLimits(userId)
    
    // Try to upsert usage
    const { data, error } = await supabase
      .from("usage_tracking")
      .upsert(
        {
          user_id: userId,
          usage_date: today,
          generation_count: 1,
        },
        {
          onConflict: "user_id,usage_date",
          ignoreDuplicates: false,
        }
      )
      .select()
      .single()
    
    if (error) {
      // If conflict, update instead
      const { data: updatedData, error: updateError } = await supabase
        .from("usage_tracking")
        .update({
          generation_count: supabase.rpc("increment_generation_count", { p_user_id: userId }),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("usage_date", today)
        .select()
        .single()
      
      if (updateError) {
        // Fallback: Just increment via direct SQL
        const { data: rpcData, error: rpcError } = await supabase.rpc("increment_generation_count", {
          p_user_id: userId,
        })
        
        if (rpcError) {
          console.error("Error incrementing generation count:", rpcError)
          return { success: false, count: 0, limitReached: false }
        }
        
        const count = rpcData as number
        return {
          success: true,
          count,
          limitReached: count >= limits.maxGenerationsPerDay,
        }
      }
      
      const count = (updatedData as UsageTracking).generation_count
      return {
        success: true,
        count,
        limitReached: count >= limits.maxGenerationsPerDay,
      }
    }
    
    return {
      success: true,
      count: 1,
      limitReached: 1 >= limits.maxGenerationsPerDay,
    }
  } catch (error) {
    console.error("Error incrementing generation count:", error)
    return { success: false, count: 0, limitReached: false }
  }
}

// ============================================
// Check if user can generate
// ============================================
export async function canUserGenerate(userId: string): Promise<{ canGenerate: boolean; remaining: number; limit: number }> {
  const limits = await getSubscriptionLimits(userId)
  
  // Pro users have unlimited
  if (limits.maxGenerationsPerDay === Infinity) {
    return { canGenerate: true, remaining: Infinity, limit: Infinity }
  }
  
  const usage = await getTodayUsage(userId)
  const used = usage?.generation_count || 0
  const remaining = Math.max(0, limits.maxGenerationsPerDay - used)
  
  return {
    canGenerate: remaining > 0,
    remaining,
    limit: limits.maxGenerationsPerDay,
  }
}

// ============================================
// Update subscription after Stripe payment
// ============================================
export async function updateSubscriptionToPro(
  userId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string
): Promise<boolean> {
  try {
    const supabase = createServerClient()
    
    const { error } = await supabase
      .from("user_subscriptions")
      .update({
        subscription_status: "pro",
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        subscription_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
    
    if (error) {
      console.error("Error updating subscription:", error)
      return false
    }
    
    return true
  } catch (error) {
    console.error("Error updating subscription:", error)
    return false
  }
}

// ============================================
// Cancel subscription
// ============================================
export async function cancelSubscription(userId: string): Promise<boolean> {
  try {
    const supabase = createServerClient()
    
    const { error } = await supabase
      .from("user_subscriptions")
      .update({
        subscription_status: "cancelled",
        subscription_ends_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
    
    if (error) {
      console.error("Error cancelling subscription:", error)
      return false
    }
    
    return true
  } catch (error) {
    console.error("Error cancelling subscription:", error)
    return false
  }
}

// ============================================
// Get trial days remaining
// ============================================
export async function getTrialDaysRemaining(userId: string): Promise<number> {
  const subscription = await getUserSubscription(userId)
  
  if (!subscription || subscription.subscription_status !== "trial") {
    return 0
  }
  
  if (!subscription.trial_ends_at) {
    return 0
  }
  
  const trialEndsAt = new Date(subscription.trial_ends_at)
  const now = new Date()
  const diff = trialEndsAt.getTime() - now.getTime()
  
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
