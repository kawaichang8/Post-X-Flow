"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { PostDraft } from "@/lib/ai-generator"
import { 
  generatePostDrafts, 
  approveAndPostTweet, 
  approveAndPostTweetWithImage, 
  savePostToHistory, 
  scheduleTweet, 
  getPostHistory,
  getScheduledTweets, 
  updateScheduledTweet, 
  deleteScheduledTweet, 
  getTwitterAccounts, 
  getDefaultTwitterAccount, 
  setDefaultTwitterAccount, 
  deleteTwitterAccount, 
  TwitterAccount 
} from "@/app/actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import { ModernSidebar } from "@/components/ModernSidebar"
import { ModernGenerateForm } from "@/components/ModernGenerateForm"
import { PostGenerationCard } from "@/components/PostGenerationCard"
import { OnboardingTour } from "@/components/OnboardingTour"
import { EnhancedCalendar } from "@/components/EnhancedCalendar"
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard"
import { cn } from "@/lib/utils"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"

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
      showToast({
        title: "Twitter連携成功",
        description: "アカウントが正常に連携されました",
        variant: "default",
      })
      // Reload accounts
      if (user) {
        getTwitterAccounts(user.id).then(setTwitterAccounts)
      }
    } else if (error) {
      showToast({
        title: "Twitter連携エラー",
        description: decodeURIComponent(error),
        variant: "destructive",
      })
    }
  }, [searchParams, user, showToast])

  // Generate posts
  const handleGenerate = async (trend: string, purpose: string, aiProvider: string) => {
    if (!user) return
    
    setIsGenerating(true)
    setCurrentTrend(trend)
    setCurrentPurpose(purpose)
    
    try {
      const result = await generatePostDrafts(trend, purpose, user.id, aiProvider)
      
      if (result.success && result.drafts) {
        const generatedPosts: GeneratedPost[] = result.drafts.map((draft, index) => ({
          id: `draft-${Date.now()}-${index}`,
          content: memoFlowEnabled && promotionUrl 
            ? `${draft.text}\n\n${promotionUrl}` 
            : draft.text,
          naturalness_score: draft.naturalness_score,
        }))
        setDrafts(generatedPosts)
        showToast({
          title: "投稿を生成しました",
          description: `${generatedPosts.length}件の投稿案を作成しました`,
          variant: "default",
        })
      } else {
        showToast({
          title: "生成エラー",
          description: result.error || "投稿の生成に失敗しました",
          variant: "destructive",
        })
      }
    } catch (error) {
      showToast({
        title: "エラー",
        description: "投稿の生成中にエラーが発生しました",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Post to Twitter
  const handlePost = async (postId: string) => {
    const post = drafts.find(d => d.id === postId)
    if (!post || !selectedAccountId) return
    
    setIsPosting(true)
    try {
      const result = await approveAndPostTweet(post.content, selectedAccountId)
      
      if (result.success) {
        showToast({
          title: "投稿完了",
          description: "ツイートが投稿されました",
          variant: "default",
        })
        // Remove from drafts
        setDrafts(prev => prev.filter(d => d.id !== postId))
      } else {
        showToast({
          title: "投稿エラー",
          description: result.error || "ツイートの投稿に失敗しました",
          variant: "destructive",
        })
      }
    } catch (error) {
      showToast({
        title: "エラー",
        description: "投稿中にエラーが発生しました",
        variant: "destructive",
      })
    } finally {
      setIsPosting(false)
    }
  }

  // Schedule post
  const handleSchedule = async (postId: string, scheduledTime: Date) => {
    const post = drafts.find(d => d.id === postId)
    if (!post || !selectedAccountId || !user) return
    
    try {
      const result = await scheduleTweet(
        user.id,
        post.content,
        [],
        scheduledTime.toISOString(),
        selectedAccountId
      )
      
      if (result.success) {
        showToast({
          title: "スケジュール設定完了",
          description: `${scheduledTime.toLocaleString('ja-JP')}に投稿予定`,
          variant: "default",
        })
        setDrafts(prev => prev.filter(d => d.id !== postId))
      } else {
        showToast({
          title: "スケジュールエラー",
          description: result.error || "スケジュール設定に失敗しました",
          variant: "destructive",
        })
      }
    } catch (error) {
      showToast({
        title: "エラー",
        description: "スケジュール設定中にエラーが発生しました",
        variant: "destructive",
      })
    }
  }

  // Save draft
  const handleSaveDraft = async (postId: string) => {
    const post = drafts.find(d => d.id === postId)
    if (!post || !user) return
    
    try {
      await savePostToHistory(
        user.id,
        post.content,
        [],
        post.naturalness_score,
        currentTrend,
        currentPurpose,
        selectedAccountId
      )
      showToast({
        title: "保存完了",
        description: "下書きを保存しました",
        variant: "default",
      })
    } catch (error) {
      showToast({
        title: "エラー",
        description: "保存中にエラーが発生しました",
        variant: "destructive",
      })
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
      showToast({
        title: "エラー",
        description: "Twitter連携URLの取得に失敗しました",
        variant: "destructive",
      })
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
        <OnboardingTour 
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingComplete}
        />
      )}

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
        />

        {/* Main Content */}
        <main className="flex-1 min-h-screen p-4 md:p-6 lg:p-8 ml-16 md:ml-64 transition-all duration-300">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Create View */}
            {activeView === "create" && (
              <>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                      <Sparkles className="h-7 w-7 text-green-500" />
                      投稿を作成
                    </h1>
                    <p className="text-muted-foreground mt-1">
                      AIを活用してエンゲージメントの高い投稿を生成
                    </p>
                  </div>
                </div>

                {/* Generate Form */}
                <ModernGenerateForm
                  onGenerate={handleGenerate}
                  isLoading={isGenerating}
                  memoFlowEnabled={memoFlowEnabled}
                  onMemoFlowToggle={setMemoFlowEnabled}
                  promotionUrl={promotionUrl}
                />

                {/* Generated Posts */}
                {drafts.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-foreground">
                        生成された投稿 ({drafts.length}件)
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerate(currentTrend, currentPurpose, "grok")}
                        disabled={isGenerating}
                      >
                        <RefreshCw className={cn("h-4 w-4 mr-2", isGenerating && "animate-spin")} />
                        再生成
                      </Button>
                    </div>

                    {/* Post Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {drafts.map((post, index) => (
                        <PostGenerationCard
                          key={post.id}
                          post={post}
                          index={index}
                          onPost={() => handlePost(post.id)}
                          onSchedule={(time) => handleSchedule(post.id, time)}
                          onSave={() => handleSaveDraft(post.id)}
                          onEdit={(content) => handleEditContent(post.id, content)}
                          isPosting={isPosting}
                          twitterConnected={twitterConnected}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {drafts.length === 0 && !isGenerating && (
                  <Card className="border-dashed border-2 border-border/50 bg-transparent">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                        <Sparkles className="h-8 w-8 text-green-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        投稿を生成しましょう
                      </h3>
                      <p className="text-muted-foreground text-center max-w-md">
                        上のフォームにトレンドキーワードを入力し、目的を選択して
                        「生成」ボタンをクリックしてください
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Loading State */}
                {isGenerating && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                      <Card key={i} className="overflow-hidden">
                        <CardHeader className="pb-2">
                          <Skeleton className="h-4 w-24" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Skeleton className="h-32 w-full" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-8 w-32" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Calendar View */}
            {activeView === "calendar" && (
              <EnhancedCalendar
                userId={user?.id || ""}
                selectedAccountId={selectedAccountId}
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
