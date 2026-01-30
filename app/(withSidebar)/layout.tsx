"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  getTwitterAccounts,
  getDefaultTwitterAccount,
  setDefaultTwitterAccount,
  TwitterAccount,
} from "@/app/actions"
import { ModernSidebar } from "@/components/ModernSidebar"
import { useSubscription } from "@/hooks/useSubscription"
import { Loader2 } from "lucide-react"

interface User {
  id: string
  email?: string
}

export default function WithSidebarLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [twitterAccounts, setTwitterAccounts] = useState<TwitterAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  const { isPro, isTrialActive, trialDaysRemaining, startCheckout } = useSubscription(user?.id ?? null)
  const upgradeEnabled = process.env.NEXT_PUBLIC_UPGRADE_ENABLED !== "false"

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push("/auth/login")
        return
      }
      setUser({ id: session.user.id, email: session.user.email })
      setLoading(false)
    }
    check()
  }, [router])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const accounts = await getTwitterAccounts(user.id)
        setTwitterAccounts(accounts)
        if (accounts.length > 0) {
          const defaultAccount = await getDefaultTwitterAccount(user.id)
          setSelectedAccountId(defaultAccount?.id ?? accounts[0].id)
        }
      } catch (e) {
        console.error("Load accounts error:", e)
      }
    }
    load()
  }, [user])

  const handleConnectTwitter = useCallback(() => {
    if (!user?.id) return
    window.location.href = `/api/auth/twitter?userId=${encodeURIComponent(user.id)}`
  }, [user?.id])

  const handleSelectAccount = useCallback(
    async (accountId: string) => {
      setSelectedAccountId(accountId)
      if (user) await setDefaultTwitterAccount(user.id, accountId)
    },
    [user]
  )

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }, [router])

  const handleNavigate = useCallback(
    (view: string) => {
      router.push("/dashboard")
    },
    [router]
  )

  const handleUpgrade = useCallback(async () => {
    try {
      await startCheckout()
    } catch (e) {
      console.error("Upgrade error:", e)
    }
  }, [startCheckout])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-white dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="h-10 w-10 animate-spin text-green-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="flex">
        <ModernSidebar
          user={user}
          twitterConnected={twitterAccounts.length > 0}
          twitterAccounts={twitterAccounts}
          selectedAccountId={selectedAccountId}
          onConnectTwitter={handleConnectTwitter}
          onSelectAccount={handleSelectAccount}
          onLogout={handleLogout}
          activeView=""
          onNavigate={handleNavigate}
          isPro={isPro}
          isTrialActive={isTrialActive ?? false}
          trialDaysRemaining={trialDaysRemaining ?? 0}
          onUpgrade={upgradeEnabled ? handleUpgrade : undefined}
        />
        <main className="flex-1 min-h-screen p-4 md:p-6 lg:p-8 ml-20 md:ml-[280px] transition-all duration-300">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}
