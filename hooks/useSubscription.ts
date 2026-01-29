"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { 
  getUserSubscription, 
  getSubscriptionLimits, 
  canUserGenerate, 
  getTrialDaysRemaining,
  getTodayUsage,
  UserSubscription,
  SubscriptionLimits
} from "@/app/actions-subscription"

interface UseSubscriptionReturn {
  subscription: UserSubscription | null
  limits: SubscriptionLimits | null
  isPro: boolean
  isTrialActive: boolean
  trialDaysRemaining: number
  canGenerate: boolean
  generationsRemaining: number
  generationsLimit: number
  todayUsage: number
  isLoading: boolean
  error: Error | null
  refresh: () => Promise<void>
  startCheckout: () => Promise<void>
}

export function useSubscription(userId: string | null): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [limits, setLimits] = useState<SubscriptionLimits | null>(null)
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0)
  const [canGenerateState, setCanGenerateState] = useState(true)
  const [generationsRemaining, setGenerationsRemaining] = useState(3)
  const [generationsLimit, setGenerationsLimit] = useState(3)
  const [todayUsage, setTodayUsage] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // 開発・自己運用でProを強制: .env.local に NEXT_PUBLIC_FORCE_PRO=true を設定
  const forcePro = typeof window !== "undefined" ? process.env.NEXT_PUBLIC_FORCE_PRO === "true" : false
  const isPro = forcePro || subscription?.subscription_status === "pro" || false

  const isTrialActive = Boolean(
    subscription?.subscription_status === "trial" && 
    subscription?.trial_ends_at && 
    new Date(subscription.trial_ends_at) > new Date()
  )

  const refresh = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Fetch all subscription data in parallel
      const [subData, limitsData, canGenData, trialDays, usageData] = await Promise.all([
        getUserSubscription(userId),
        getSubscriptionLimits(userId),
        canUserGenerate(userId),
        getTrialDaysRemaining(userId),
        getTodayUsage(userId),
      ])

      setSubscription(subData)
      setLimits(limitsData)
      setTrialDaysRemaining(trialDays)
      setCanGenerateState(canGenData.canGenerate)
      setGenerationsRemaining(canGenData.remaining === Infinity ? Infinity : canGenData.remaining)
      setGenerationsLimit(canGenData.limit === Infinity ? Infinity : canGenData.limit)
      setTodayUsage(usageData?.generation_count || 0)
    } catch (err) {
      console.error("Error loading subscription:", err)
      setError(err instanceof Error ? err : new Error("Failed to load subscription"))
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  const startCheckout = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token
    if (!accessToken) {
      throw new Error("ログインしてください。")
    }

    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
    })

    const data = await response.json().catch(() => ({ error: "応答の解析に失敗しました" }))

    if (data.error) {
      throw new Error(typeof data.error === "string" ? data.error : "チェックアウトを開始できませんでした")
    }

    if (data.url) {
      window.location.href = data.url
      return
    }
    throw new Error("決済ページのURLを取得できませんでした")
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    subscription,
    limits,
    isPro: forcePro || isPro || isTrialActive,
    isTrialActive,
    trialDaysRemaining,
    canGenerate: canGenerateState,
    generationsRemaining,
    generationsLimit,
    todayUsage,
    isLoading,
    error,
    refresh,
    startCheckout,
  }
}

// Feature check helper
export function useFeatureAccess(userId: string | null) {
  const { isPro, limits } = useSubscription(userId)

  return {
    canUseRepostSuggestions: isPro || (limits?.canUseRepostSuggestions ?? false),
    canUseUnlimitedMedia: isPro || (limits?.canUseUnlimitedMedia ?? false),
    canUseAdvancedAnalytics: isPro || (limits?.canUseAdvancedAnalytics ?? false),
    canUseScheduling: limits?.canUseScheduling ?? true,
    isPro,
  }
}
