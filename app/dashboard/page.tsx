"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { PostDraft } from "@/lib/ai-generator"
import { 
  generatePostDrafts, 
  approveAndPostTweet, 
  savePostToHistory, 
  scheduleTweet, 
  getScheduledTweets, 
  deleteScheduledTweet,
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
import { cn } from "@/lib/utils"
import { StatsHeroBanner } from "@/components/StatsHeroBanner"
import { UpgradeBanner } from "@/components/UpgradeBanner"
import { UsageLimitWarning } from "@/components/ProFeatureLock"
import { useSubscription } from "@/hooks/useSubscription"
import { incrementGenerationCount } from "@/app/actions-subscription"
import { Switch } from "@/components/ui/switch"
import { Loader2, RefreshCw, Sparkles, Link2, Moon, Sun, Crown } from "lucide-react"

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
  
  // MemoFlow state
  const [memoFlowEnabled, setMemoFlowEnabled] = useState(false)
  const [promotionUrl, setPromotionUrl] = useState("")
  
  // View state
  const [activeView, setActiveView] = useState("create")
  
  // History and scheduled
  const [postHistory, setPostHistory] = useState<PostHistoryItem[]>([])
  const [scheduledTweets, setScheduledTweets] = useState<PostHistoryItem[]>([])

  // Onboarding
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Schedule modal (when user clicks schedule on a post)
  const [schedulingPost, setSchedulingPost] = useState<GeneratedPost | null>(null)
  const [scheduleDate, setScheduleDate] = useState("")

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

  // Load scheduled tweets when calendar view is active
  useEffect(() => {
    if (activeView === "calendar" && user) {
      getScheduledTweets(user.id).then(setScheduledTweets)
    }
  }, [activeView, user])

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

  // Handle Twitter callback
  useEffect(() => {
    const success = searchParams.get("twitter_success")
    const error = searchParams.get("twitter_error")
    
    if (success === "true") {
      showToast("Twitter連携成功: アカウントが正常に連携されました", "success")
      // Reload accounts
      if (user) {
        getTwitterAccounts(user.id).then(setTwitterAccounts)
      }
    } else if (error) {
      showToast(`Twitter連携エラー: ${decodeURIComponent(error)}`, "error")
    }
  }, [searchParams, user, showToast])

  // Generate posts
  const handleGenerate = async (trend: string, purpose: string, aiProvider: string) => {
    if (!user) return
    
    // Check generation limit for free users
    if (!canGenerate) {
      showToast("本日の生成上限に達しました。Proプランにアップグレードすると無制限に生成できます。", "error")
      return
    }
    
    setIsGenerating(true)
    setCurrentTrend(trend)
    setCurrentPurpose(purpose)
    
    try {
      // Increment usage count for free users
      if (!isPro) {
        await incrementGenerationCount(user.id)
        refreshSubscription() // Refresh to update remaining count
      }
      
      const draftsResult = await generatePostDrafts(trend, purpose, { aiProvider: aiProvider as "grok" | "claude" })
      const generatedPosts: GeneratedPost[] = draftsResult.map((draft: PostDraft, index: number) => ({
        id: `draft-${Date.now()}-${index}`,
        content: memoFlowEnabled && promotionUrl 
          ? `${draft.text}\n\n${promotionUrl}` 
          : draft.text,
        naturalness_score: draft.naturalnessScore,
      }))
      setDrafts(generatedPosts)
      showToast(`${generatedPosts.length}件の投稿案を作成しました`, "success")
    } catch (error) {
      showToast("投稿の生成に失敗しました", "error")
    } finally {
      setIsGenerating(false)
    }
  }

  // Post to Twitter
  const handlePost = async (postId: string) => {
    const post = drafts.find(d => d.id === postId)
    if (!post || !selectedAccountId || !user) return
    
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
        selectedAccountId
      )
      
      if (result.success) {
        showToast("ツイートが投稿されました", "success")
        setDrafts(prev => prev.filter(d => d.id !== postId))
      } else {
        showToast(result.error || "ツイートの投稿に失敗しました", "error")
      }
    } catch (error) {
      showToast("投稿中にエラーが発生しました", "error")
    } finally {
      setIsPosting(false)
    }
  }

  // Schedule post (called when user confirms date in modal)
  const handleScheduleConfirm = async () => {
    if (!schedulingPost || !user || !scheduleDate) return
    const scheduledTime = new Date(scheduleDate)
    const draft: PostDraft = {
      text: schedulingPost.content,
      naturalnessScore: schedulingPost.naturalness_score,
      hashtags: [],
    }
    try {
      await scheduleTweet(user.id, draft, scheduledTime, currentTrend, currentPurpose)
      showToast(`${scheduledTime.toLocaleString("ja-JP")}に投稿予定です`, "success")
      setDrafts(prev => prev.filter(d => d.id !== schedulingPost.id))
      setSchedulingPost(null)
      setScheduleDate("")
    } catch (error) {
      showToast("スケジュール設定に失敗しました", "error")
    }
  }

  // Save draft
  const handleSaveDraft = async (postId: string) => {
    const post = drafts.find(d => d.id === postId)
    if (!post || !user) return
    
    const draft: PostDraft = {
      text: post.content,
      naturalnessScore: post.naturalness_score,
      hashtags: [],
    }
    try {
      await savePostToHistory(user.id, draft, currentTrend, currentPurpose, "draft")
      showToast("下書きを保存しました", "success")
    } catch (error) {
      showToast("保存中にエラーが発生しました", "error")
    }
  }

  // Edit post content
  const handleEditContent = (postId: string, newContent: string) => {
    setDrafts(prev => prev.map(d => 
      d.id === postId ? { ...d, content: newContent } : d
    ))
  }

  // Connect Twitter
  const handleConnectTwitter = async () => {
    try {
      const response = await fetch("/api/auth/twitter/url")
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      showToast("Twitter連携URLの取得に失敗しました", "error")
    }
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
          onUpgrade={startCheckout}
        />

        {/* Main Content */}
        <main className="flex-1 min-h-screen p-4 md:p-6 lg:p-8 ml-20 md:ml-[280px] transition-all duration-300">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Create View */}
            {activeView === "create" && (
              <>
                {/* Premium Header with MemoFlow Toggle */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                  
                  {/* MemoFlow Toggle - Premium */}
                  <div className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300",
                    memoFlowEnabled 
                      ? "border-green-500/30 bg-green-50/50 dark:bg-green-950/30" 
                      : "border-border bg-card/50"
                  )}>
                    <Link2 className={cn(
                      "h-4 w-4 transition-colors",
                      memoFlowEnabled ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                    )} />
                    <span className="text-sm font-medium">MemoFlow</span>
                    <Switch
                      checked={memoFlowEnabled}
                      onCheckedChange={setMemoFlowEnabled}
                      className="data-[state=checked]:bg-green-500"
                    />
                  </div>
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

                {/* Upgrade Banner for Free/Trial Users */}
                {!isPro && (
                  <UpgradeBanner
                    trialDaysRemaining={trialDaysRemaining}
                    generationsRemaining={generationsRemaining === Infinity ? 999 : generationsRemaining}
                    generationsLimit={generationsLimit === Infinity ? 999 : generationsLimit}
                    onUpgrade={startCheckout}
                    variant={isTrialActive ? "compact" : "default"}
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
                      memoFlowEnabled={memoFlowEnabled}
                      onMemoFlowToggle={setMemoFlowEnabled}
                      promotionUrl={promotionUrl}
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
                        className="rounded-xl hover:bg-accent/80"
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

            {/* Calendar View */}
            {activeView === "calendar" && user && (
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
              <AnalyticsDashboard userId={user.id} />
            )}

            {/* History View */}
            {activeView === "history" && (
              <Card>
                <CardHeader>
                  <CardTitle>投稿履歴</CardTitle>
                  <CardDescription>
                    過去に作成・投稿した内容の一覧
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-center py-8">
                    投稿履歴機能は準備中です
                  </p>
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
                  <div className="flex items-center justify-between p-4 rounded-xl border">
                    <div>
                      <p className="font-medium">MemoFlow プロモーションURL</p>
                      <p className="text-sm text-muted-foreground">
                        自動で投稿に追加するリンク
                      </p>
                    </div>
                    <input
                      type="url"
                      value={promotionUrl}
                      onChange={(e) => setPromotionUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-64 px-3 py-2 rounded-lg border bg-background"
                    />
                  </div>
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
