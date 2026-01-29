"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { PostDraft } from "@/lib/ai-generator"
import { 
  generatePostDrafts, 
  generatePostDraftsAB,
  approveAndPostTweet, 
  savePostToHistory, 
  scheduleTweet, 
  getScheduledTweets, 
  deleteScheduledTweet,
  postScheduledTweet,
  getPostHistory,
  getTwitterAccounts, 
  getDefaultTwitterAccount, 
  getTwitterAccountById,
  setDefaultTwitterAccount, 
  TwitterAccount 
} from "@/app/actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/toast"
import { ModernSidebar } from "@/components/ModernSidebar"
import { ModernGenerateForm } from "@/components/ModernGenerateForm"
import { PostGenerationCard } from "@/components/PostGenerationCard"
import { OnboardingTour } from "@/components/OnboardingTour"
import { EnhancedCalendar } from "@/components/EnhancedCalendar"
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard"
import { ImprovementSuggestionsCard } from "@/components/ImprovementSuggestionsCard"
import { cn } from "@/lib/utils"
import { StatsHeroBanner } from "@/components/StatsHeroBanner"
import { ProCard } from "@/components/ProCard"
import { UsageLimitWarning } from "@/components/ProFeatureLock"
import { useSubscription } from "@/hooks/useSubscription"
import { incrementGenerationCount } from "@/app/actions-subscription"
import { Loader2, RefreshCw, Sparkles, History, Heart, Eye, Bell, Send } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

interface PostHistoryItem {
  id: string
  text: string
  hashtags: string[]
  naturalness_score: number
  trend: string | null
  purpose: string | null
  status: 'draft' | 'posted' | 'scheduled' | 'deleted'
  tweet_id: string | null
  scheduled_for: string | null
  created_at: string
  twitter_account_id: string | null
  engagement_score?: number
  impression_count?: number | null
  like_count?: number
  retweet_count?: number
}

interface User {
  id: string
  email?: string
}

interface GeneratedPost {
  id: string
  content: string
  mediaUrl?: string
  mediaType?: "image" | "video"
  naturalness_score: number
  fact_score?: number | null
  fact_suggestions?: string[]
  context_used?: boolean
}

function NewDashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  
  // User state
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Twitter state
  const [twitterConnected, setTwitterConnected] = useState(false)
  const [twitterAccounts, setTwitterAccounts] = useState<TwitterAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  
  // Generation state
  const [drafts, setDrafts] = useState<GeneratedPost[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [currentTrend, setCurrentTrend] = useState("")
  const [currentPurpose, setCurrentPurpose] = useState("")
  
  // View state
  const [activeView, setActiveView] = useState("create")
  
  // History and scheduled
  const [postHistory, setPostHistory] = useState<PostHistoryItem[]>([])
  const [scheduledTweets, setScheduledTweets] = useState<PostHistoryItem[]>([])
  const [historyList, setHistoryList] = useState<PostHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Schedule modal (when user clicks schedule on a post)
  const [schedulingPost, setSchedulingPost] = useState<GeneratedPost | null>(null)
  const [scheduleDate, setScheduleDate] = useState("")
  const [postingScheduledId, setPostingScheduledId] = useState<string | null>(null)

  // AB test: shared id for current session variations (set when generating in AB mode)
  const [abTestId, setAbTestId] = useState<string | null>(null)

  // Fact-check warning: show before post/schedule when fact_score < 70
  const [pendingPostAction, setPendingPostAction] = useState<{ type: "post"; post: GeneratedPost } | { type: "schedule"; post: GeneratedPost; scheduleDate: string } | null>(null)

  // Subscription state
  const {
    isPro,
    isTrialActive,
    trialDaysRemaining,
    canGenerate,
    generationsRemaining,
    generationsLimit,
    startCheckout,
    refresh: refreshSubscription,
  } = useSubscription(user?.id || null)

  // When false, run as free-only (no upgrade button/banner)
  const upgradeEnabled = process.env.NEXT_PUBLIC_UPGRADE_ENABLED !== "false"

  // Handle upgrade: show toast on error so user gets feedback when button does nothing
  const handleUpgrade = useCallback(async () => {
    try {
      await startCheckout()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "アップグレードを開始できませんでした"
      showToast(msg, "error")
    }
  }, [startCheckout, showToast])

  // Handle upgrade success/cancel from URL params
  useEffect(() => {
    const upgrade = searchParams.get("upgrade")
    if (upgrade === "success") {
      showToast("Proプランへのアップグレードが完了しました！", "success")
      refreshSubscription()
    } else if (upgrade === "cancelled") {
      showToast("アップグレードがキャンセルされました", "info")
    }
  }, [searchParams, showToast, refreshSubscription])

  // Load scheduled tweets when user is set (for due banner) and when calendar view is active (refresh)
  const loadScheduledTweets = useCallback(() => {
    if (!user) return
    getScheduledTweets(user.id).then(setScheduledTweets)
  }, [user])

  useEffect(() => {
    if (user) loadScheduledTweets()
  }, [user, loadScheduledTweets])

  useEffect(() => {
    if ((activeView === "calendar" || activeView === "scheduled") && user) {
      loadScheduledTweets()
    }
  }, [activeView, user, loadScheduledTweets])

  // Load post history when history view is active
  const loadHistory = useCallback(async () => {
    if (!user) return
    setLoadingHistory(true)
    try {
      const data = await getPostHistory(user.id, 50, selectedAccountId || undefined)
      setHistoryList(data as PostHistoryItem[])
    } catch (e) {
      console.error("Failed to load post history:", e)
      showToast("投稿履歴の取得に失敗しました", "error")
    } finally {
      setLoadingHistory(false)
    }
  }, [user, selectedAccountId, showToast])

  useEffect(() => {
    if (activeView === "history" && user) loadHistory()
  }, [activeView, user, loadHistory])

  // Check user session
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email })
        // Check onboarding
        const hasSeenTour = localStorage.getItem('freexboost_onboarding_complete')
        if (!hasSeenTour) {
          setShowOnboarding(true)
        }
      } else {
        router.push("/auth/login")
      }
      setIsLoading(false)
    }
    checkUser()
  }, [router])

  // Load Twitter accounts
  useEffect(() => {
    const loadAccounts = async () => {
      if (!user) return
      try {
        const accounts = await getTwitterAccounts(user.id)
        setTwitterAccounts(accounts)
        setTwitterConnected(accounts.length > 0)
        
        if (accounts.length > 0) {
          const defaultAccount = await getDefaultTwitterAccount(user.id)
          setSelectedAccountId(defaultAccount?.id || accounts[0].id)
        }
      } catch (error) {
        console.error("Failed to load Twitter accounts:", error)
      }
    }
    loadAccounts()
  }, [user])

  // Handle Twitter callback (callback uses twitter_connected=true and error=... / details=... / message=...)
  useEffect(() => {
    const twitterConnected = searchParams.get("twitter_connected")
    const error = searchParams.get("error")
    const details = searchParams.get("details")
    const message = searchParams.get("message")

    if (twitterConnected === "true") {
      showToast("X連携が完了しました", "success")
      if (user) {
        getTwitterAccounts(user.id).then(setTwitterAccounts)
      }
    } else if (error) {
      const msg = message ? decodeURIComponent(message) : (details ? decodeURIComponent(details) : decodeURIComponent(error))
      showToast(msg || "X連携に失敗しました", "error")
    }
  }, [searchParams, user, showToast])

  // Generate posts (abMode: Pro-only; contextMode/factCheck: toggles for RAG and fact-check)
  const handleGenerate = async (trend: string, purpose: string, aiProvider: string, abMode?: boolean, contextMode?: boolean, factCheck?: boolean) => {
    if (!user) return
    
    // Check generation limit for free users
    if (!canGenerate) {
      showToast("本日の生成上限に達しました。Proプランにアップグレードすると無制限に生成できます。", "error")
      return
    }
    
    setIsGenerating(true)
    setCurrentTrend(trend)
    setCurrentPurpose(purpose)
    setAbTestId(null)
    
    try {
      // Increment usage count for free users
      if (!isPro) {
        await incrementGenerationCount(user.id)
        refreshSubscription() // Refresh to update remaining count
      }
      
      const genOptions = {
        userId: user.id,
        aiProvider: aiProvider as "grok" | "claude",
        contextMode: contextMode ?? true,
        factCheck: factCheck ?? true,
      }
      if (isPro && abMode) {
        const { drafts: draftsResult, abTestId: newAbTestId } = await generatePostDraftsAB(trend, purpose, genOptions)
        setAbTestId(newAbTestId)
        const generatedPosts: GeneratedPost[] = draftsResult.map((draft, index: number) => ({
          id: `draft-${Date.now()}-${index}`,
          content: draft.text,
          naturalness_score: draft.naturalnessScore,
          fact_score: draft.factScore,
          fact_suggestions: draft.factSuggestions,
          context_used: !!genOptions.contextMode,
        }))
        setDrafts(generatedPosts)
        showToast(`${generatedPosts.length}案をABテスト用に作成しました（分析で比較できます）`, "success")
      } else {
        const draftsResult = await generatePostDrafts(trend, purpose, genOptions)
        const generatedPosts: GeneratedPost[] = draftsResult.map((draft, index: number) => ({
          id: `draft-${Date.now()}-${index}`,
          content: draft.text,
          naturalness_score: draft.naturalnessScore,
          fact_score: draft.factScore,
          fact_suggestions: draft.factSuggestions,
          context_used: !!genOptions.contextMode,
        }))
        setDrafts(generatedPosts)
        showToast(`${generatedPosts.length}件の投稿案を作成しました`, "success")
      }
    } catch (error) {
      showToast("投稿の生成に失敗しました", "error")
    } finally {
      setIsGenerating(false)
    }
  }

  // Post to Twitter (with fact-check warning if score < 70)
  const handlePost = async (postId: string) => {
    const post = drafts.find(d => d.id === postId)
    if (!post || !selectedAccountId || !user) return
    
    const factScore = post.fact_score ?? 100
    if (factScore < 70) {
      setPendingPostAction({ type: "post", post })
      return
    }
    
    await doPost(post)
  }

  const doPost = async (post: GeneratedPost) => {
    if (!selectedAccountId || !user) return
    const account = await getTwitterAccountById(selectedAccountId, user.id)
    if (!account?.access_token) {
      showToast("選択されたアカウントのトークンが見つかりません", "error")
      return
    }
    setIsPosting(true)
    try {
      const draft: PostDraft = {
        text: post.content,
        naturalnessScore: post.naturalness_score,
        hashtags: [],
      }
      const result = await approveAndPostTweet(
        user.id,
        draft,
        account.access_token,
        currentTrend,
        currentPurpose,
        selectedAccountId,
        {
          ...(abTestId ? { abTestId } : {}),
          contextUsed: post.context_used,
          factScore: post.fact_score ?? undefined,
        }
      )
      if (result.success) {
        showToast("ツイートが投稿されました", "success")
        setDrafts(prev => prev.filter(d => d.id !== post.id))
      } else {
        showToast(result.error || "ツイートの投稿に失敗しました", "error")
      }
    } catch (error) {
      showToast("投稿中にエラーが発生しました", "error")
    } finally {
      setIsPosting(false)
    }
  }

  // Schedule post (called when user confirms date in modal; fact-check warning if score < 70)
  const handleScheduleConfirm = async () => {
    if (!schedulingPost || !user || !scheduleDate) return
    const factScore = schedulingPost.fact_score ?? 100
    if (factScore < 70) {
      setPendingPostAction({ type: "schedule", post: schedulingPost, scheduleDate })
      setSchedulingPost(null)
      setScheduleDate("")
      return
    }
      await doSchedule(schedulingPost, scheduleDate)
  }

  const doSchedule = async (post: GeneratedPost, dateStr: string) => {
    if (!user) return
    const scheduledTime = new Date(dateStr)
    const draft: PostDraft = {
      text: post.content,
      naturalnessScore: post.naturalness_score,
      hashtags: [],
    }
    try {
      await scheduleTweet(user.id, draft, scheduledTime, currentTrend, currentPurpose, {
        ...(abTestId ? { abTestId } : {}),
        contextUsed: post.context_used,
        factScore: post.fact_score ?? undefined,
      })
      showToast(`${scheduledTime.toLocaleString("ja-JP")}に投稿予定です`, "success")
      setDrafts(prev => prev.filter(d => d.id !== post.id))
      setSchedulingPost(null)
      setScheduleDate("")
    } catch (error) {
      showToast("スケジュール設定に失敗しました", "error")
    }
  }

  // Save draft (with context_used / fact_score for analytics)
  const handleSaveDraft = async (postId: string) => {
    const post = drafts.find(d => d.id === postId)
    if (!post || !user) return
    
    const draft: PostDraft = {
      text: post.content,
      naturalnessScore: post.naturalness_score,
      hashtags: [],
    }
    try {
      await savePostToHistory(user.id, draft, currentTrend, currentPurpose, "draft", {
        contextUsed: post.context_used,
        factScore: post.fact_score ?? undefined,
      })
      showToast("下書きを保存しました", "success")
    } catch (error) {
      showToast("保存中にエラーが発生しました", "error")
    }
  }

  // Confirm fact-check warning and run pending post/schedule
  const handleConfirmFactWarning = async () => {
    if (!pendingPostAction || !user) return
    if (pendingPostAction.type === "post") {
      await doPost(pendingPostAction.post)
    } else {
      await doSchedule(pendingPostAction.post, pendingPostAction.scheduleDate)
    }
    setPendingPostAction(null)
  }

  // Edit post content
  const handleEditContent = (postId: string, newContent: string) => {
    setDrafts(prev => prev.map(d => 
      d.id === postId ? { ...d, content: newContent } : d
    ))
  }

  // Post a scheduled tweet now (semi-auto: user clicks "投稿する")
  const handlePostScheduled = async (postId: string) => {
    if (!user) return
    setPostingScheduledId(postId)
    try {
      const result = await postScheduledTweet(user.id, postId, selectedAccountId ?? undefined)
      if (result.success) {
        showToast("投稿しました", "success")
        loadScheduledTweets()
      } else {
        showToast(result.error ?? "投稿に失敗しました", "error")
      }
    } catch (e) {
      showToast("投稿中にエラーが発生しました", "error")
    } finally {
      setPostingScheduledId(null)
    }
  }

  // Due scheduled posts (scheduled_for <= now) — show "予約投稿の時刻です" banner
  const dueScheduled = scheduledTweets.filter(
    (p) => p.status === "scheduled" && p.scheduled_for && new Date(p.scheduled_for) <= new Date()
  )

  // Connect Twitter: redirect to OAuth start (server stores session and redirects to X)
  const handleConnectTwitter = () => {
    if (!user?.id) {
      showToast("ログインしてください", "error")
      return
    }
    window.location.href = `/api/auth/twitter?userId=${encodeURIComponent(user.id)}`
  }

  // Select account
  const handleSelectAccount = async (accountId: string) => {
    setSelectedAccountId(accountId)
    if (user) {
      await setDefaultTwitterAccount(user.id, accountId)
    }
  }

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  // Navigate between views
  const handleNavigate = (view: string) => {
    setActiveView(view)
  }

  // Complete onboarding
  const handleOnboardingComplete = () => {
    localStorage.setItem('freexboost_onboarding_complete', 'true')
    setShowOnboarding(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-green-500" />
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Onboarding Tour */}
      {showOnboarding && (
        <OnboardingTour onComplete={handleOnboardingComplete} />
      )}

      {/* Fact-check warning (score < 70) before post/schedule */}
      <AlertDialog open={!!pendingPostAction} onOpenChange={(open) => { if (!open) setPendingPostAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>事実確認スコアが70未満です</AlertDialogTitle>
            <AlertDialogDescription>
              この投稿には事実関係の確認が推奨される内容が含まれている可能性があります。投稿しますか？内容を編集してから投稿することをおすすめします。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmFactWarning}>
              {pendingPostAction?.type === "schedule" ? "スケジュールする" : "投稿する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Schedule date modal */}
      <AlertDialog open={!!schedulingPost} onOpenChange={(open) => { if (!open) { setSchedulingPost(null); setScheduleDate("") } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>投稿日時を設定</AlertDialogTitle>
            <AlertDialogDescription>
              スケジュールする日時を選択してください
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleScheduleConfirm}
              disabled={!scheduleDate}
            >
              スケジュール
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex">
        {/* Modern Sidebar */}
        <ModernSidebar
          user={user}
          twitterConnected={twitterConnected}
          twitterAccounts={twitterAccounts}
          selectedAccountId={selectedAccountId}
          onConnectTwitter={handleConnectTwitter}
          onSelectAccount={handleSelectAccount}
          onLogout={handleLogout}
          activeView={activeView}
          onNavigate={handleNavigate}
          isPro={isPro}
          isTrialActive={isTrialActive}
          trialDaysRemaining={trialDaysRemaining}
          onUpgrade={upgradeEnabled ? handleUpgrade : undefined}
        />

        {/* Main Content */}
        <main className="flex-1 min-h-screen p-4 md:p-6 lg:p-8 ml-20 md:ml-[280px] transition-all duration-300">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Due scheduled posts banner (semi-auto: 通知 → ユーザーが押して投稿) */}
            {dueScheduled.length > 0 && user && (
              <Card className="rounded-2xl border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-500/20 overflow-hidden">
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                      <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-amber-900 dark:text-amber-100">
                        予約投稿の時刻です（{dueScheduled.length}件）
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        クリックしてXに投稿します
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {dueScheduled.map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-xl bg-white/60 dark:bg-black/20 border border-amber-200/50 dark:border-amber-800/50"
                      >
                        <p className="text-sm text-foreground line-clamp-2 flex-1 min-w-0">
                          {p.text}
                        </p>
                        <Button
                          size="sm"
                          className="rounded-xl shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                          onClick={() => handlePostScheduled(p.id)}
                          disabled={postingScheduledId === p.id}
                        >
                          {postingScheduledId === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-1.5" />
                              投稿する
                            </>
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            
            {/* Create View */}
            {activeView === "create" && (
              <>
                {/* Premium Header */}
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">投稿を作成</span>
                  </h1>
                  <p className="text-muted-foreground mt-2 text-sm md:text-base">
                    AIを活用してエンゲージメントの高い投稿を生成
                  </p>
                </div>

                {/* Stats Banner */}
                <StatsHeroBanner 
                  stats={{
                    postsToday: drafts.length,
                    scheduledCount: scheduledTweets.length,
                    totalEngagement: 0,
                    avgScore: drafts.length > 0 
                      ? Math.round(drafts.reduce((acc, d) => acc + d.naturalness_score, 0) / drafts.length)
                      : undefined
                  }}
                />

                {/* PRO plan card (Xboost-style) for Free/Trial Users */}
                {!isPro && upgradeEnabled && (
                  <ProCard
                    config={{
                      spotsLeft: 5,
                      spotsTotal: 5,
                      oldPrice: "¥66,000",
                      price: "¥44,800",
                      priceUnit: "/3ヶ月",
                      userCountLabel: "90人がPRO利用中",
                      currentPlan: "Free",
                    }}
                    onUpgrade={handleUpgrade}
                    variant="default"
                    showAsUpgrade={true}
                  />
                )}

                {/* Usage Limit Warning */}
                {!isPro && (
                  <UsageLimitWarning 
                    remaining={generationsRemaining === Infinity ? 999 : generationsRemaining} 
                    limit={generationsLimit === Infinity ? 999 : generationsLimit} 
                  />
                )}

                {/* Generate Form - Glass Card */}
                <Card className="glass-card-green border-0 overflow-hidden">
                  <CardContent className="p-6">
                    <ModernGenerateForm
                      onGenerate={handleGenerate}
                      isLoading={isGenerating}
                      userId={user?.id ?? null}
                      selectedAccountId={selectedAccountId}
                      onTrendsError={(msg) => showToast(msg, "error")}
                      isPro={isPro}
                    />
                  </CardContent>
                </Card>

                {/* Generated Posts */}
                {drafts.length > 0 && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        生成された投稿
                        <span className="text-sm font-normal text-muted-foreground">
                          ({drafts.length}件)
                        </span>
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerate(currentTrend, currentPurpose, "grok")}
                        disabled={isGenerating}
                        className="rounded-xl border-2 shadow-sm"
                      >
                        <RefreshCw className={cn("h-4 w-4 mr-2", isGenerating && "animate-spin")} />
                        再生成
                      </Button>
                    </div>

                    {/* Post Cards - Horizontal Scroll on Mobile, Grid on Desktop */}
                    <div className="relative">
                      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible md:pb-0">
                        {drafts.map((post, index) => (
                          <div key={post.id} className="min-w-[300px] md:min-w-0">
                            <PostGenerationCard
                              post={post}
                              index={index}
                              onContentChange={(id, content) => handleEditContent(id, content)}
                              onPost={() => handlePost(post.id)}
                              onSchedule={() => setSchedulingPost(post)}
                              onSaveDraft={() => handleSaveDraft(post.id)}
                              isPosting={isPosting}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty State - Premium */}
                {drafts.length === 0 && !isGenerating && (
                  <Card className="glass-card border-dashed border-2 border-border/30 overflow-hidden">
                    <CardContent className="flex flex-col items-center justify-center py-20 relative">
                      {/* Decorative background */}
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
                      <div className="absolute top-10 right-10 w-32 h-32 bg-green-500/10 rounded-full blur-3xl" />
                      <div className="absolute bottom-10 left-10 w-24 h-24 bg-emerald-500/10 rounded-full blur-3xl" />
                      
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center mb-6 shadow-xl shadow-green-500/20 logo-glow">
                          <Sparkles className="h-10 w-10 text-white" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">
                          AIで投稿を生成しましょう
                        </h3>
                        <p className="text-muted-foreground text-center max-w-md leading-relaxed">
                          上のフォームにトレンドキーワードを入力し、目的を選択して
                          「生成する」ボタンをクリックしてください
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Loading State - Premium Skeleton */}
                {isGenerating && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                      <Card key={i} className="glass-card overflow-hidden animate-pulse">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-6 w-6 rounded-full" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <Skeleton className="h-28 w-full rounded-xl" />
                          <div className="space-y-2">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-4/5" />
                          </div>
                          <div className="flex gap-2">
                            <Skeleton className="h-9 w-20 rounded-xl" />
                            <Skeleton className="h-9 w-20 rounded-xl" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Calendar View (sidebar uses id "scheduled") */}
            {(activeView === "calendar" || activeView === "scheduled") && user && (
              <EnhancedCalendar
                scheduledPosts={scheduledTweets.map((p) => ({
                  id: p.id,
                  content: p.text,
                  scheduled_for: new Date(p.scheduled_for || 0),
                  status: "pending" as const,
                }))}
                onDateSelect={() => {}}
                onPostSelect={() => {}}
                onDeletePost={async (id) => {
                  try {
                    await deleteScheduledTweet(id)
                    setScheduledTweets((prev) => prev.filter((x) => x.id !== id))
                    showToast("スケジュールを削除しました", "success")
                  } catch {
                    showToast("削除に失敗しました", "error")
                  }
                }}
                onEditPost={() => {}}
                onAddNew={() => {}}
              />
            )}

            {/* Analytics View */}
            {activeView === "analytics" && user && (
              <div className="space-y-6">
                <AnalyticsDashboard userId={user.id} />
                <ImprovementSuggestionsCard
                  userId={user.id}
                  onUseImprovement={(improvedText) => {
                    setDrafts([
                      {
                        id: `improved-${Date.now()}`,
                        content: improvedText,
                        naturalness_score: 85,
                      },
                    ])
                    handleNavigate("create")
                  }}
                  limit={5}
                />
              </div>
            )}

            {/* History View */}
            {activeView === "history" && (
              <Card className="rounded-2xl border-0 shadow-lg overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>投稿履歴</CardTitle>
                      <CardDescription>
                        過去に生成・投稿した内容の一覧
                      </CardDescription>
                    </div>
                    {user && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadHistory}
                        disabled={loadingHistory}
                        className="rounded-xl border-2 shadow-sm"
                      >
                        <RefreshCw className={cn("h-4 w-4 mr-1.5", loadingHistory && "animate-spin")} />
                        更新
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingHistory && (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-4 rounded-xl border space-y-3">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <div className="flex gap-2">
                            <Skeleton className="h-6 w-16 rounded-lg" />
                            <Skeleton className="h-6 w-20 rounded-lg" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!loadingHistory && historyList.length === 0 && (
                    <div className="text-center py-12">
                      <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        履歴がありません。ツイートを生成すると履歴に保存されます。
                      </p>
                    </div>
                  )}
                  {!loadingHistory && historyList.length > 0 && (
                    <div className="space-y-3">
                      {historyList.map((item) => (
                        <div
                          key={item.id}
                          className="p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors"
                        >
                          <p className="text-sm text-foreground line-clamp-2 mb-2">{item.text}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge
                              variant={item.status === "posted" ? "default" : item.status === "scheduled" ? "secondary" : "outline"}
                              className="rounded-lg font-normal"
                            >
                              {item.status === "draft" && "下書き"}
                              {item.status === "posted" && "投稿済み"}
                              {item.status === "scheduled" && "スケジュール済み"}
                              {item.status === "deleted" && "削除済み"}
                            </Badge>
                            <span>
                              {new Date(item.created_at).toLocaleString("ja-JP", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {(item.like_count != null && item.like_count > 0) && (
                              <span className="flex items-center gap-0.5">
                                <Heart className="h-3 w-3" />
                                {item.like_count}
                              </span>
                            )}
                            {(item.impression_count != null && item.impression_count > 0) && (
                              <span className="flex items-center gap-0.5">
                                <Eye className="h-3 w-3" />
                                {item.impression_count.toLocaleString()}
                              </span>
                            )}
                            {item.trend && (
                              <span className="text-muted-foreground/80">#{item.trend.replace(/^#/, "")}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Settings View */}
            {activeView === "settings" && (
              <Card>
                <CardHeader>
                  <CardTitle>設定</CardTitle>
                  <CardDescription>
                    アプリケーションの設定
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Link
                    href="/settings/promotion"
                    className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium">宣伝設定</p>
                      <p className="text-sm text-muted-foreground">
                        生成投稿に自分の商品・リンクを誘導する文言を追加
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">→</span>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function NewDashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-green-500" />
      </div>
    }>
      <NewDashboardContent />
    </Suspense>
  )
}
