"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { 
  getInspirationPosts, 
  generateQuoteRTDraft, 
  postQuoteRT, 
  postSimpleRetweet, 
  scheduleRetweet, 
  canGenerateQuoteRT,
  type InspirationPost, 
  type QuoteRTDraft 
} from "@/app/actions-inspiration"
import { getTwitterAccounts, getDefaultTwitterAccount, getTwitterAccountById, TwitterAccount } from "@/app/actions"
import { useSubscription } from "@/hooks/useSubscription"
import { ProCard } from "@/components/ProCard"
import { RetweetModal } from "@/components/RetweetModal"
import { InspirationList } from "@/components/InspirationList"
import { QuoteRTEditor } from "@/components/QuoteRTEditor"
import { ObsidianExport } from "@/components/ObsidianExport"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
import { cn } from "@/lib/utils"
import { Quote, Sparkles, Loader2, Info, Crown } from "lucide-react"

interface User {
  id: string
  email?: string
}

export default function InspirationPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<InspirationPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [twitterAccounts, setTwitterAccounts] = useState<TwitterAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [draft, setDraft] = useState<QuoteRTDraft | null>(null)
  const [userContext, setUserContext] = useState("")
  const [retweetModalPost, setRetweetModalPost] = useState<InspirationPost | null>(null)
  
  // New: Quote RT Editor state
  const [quoteEditorPost, setQuoteEditorPost] = useState<InspirationPost | null>(null)
  const [quoteEditorDraft, setQuoteEditorDraft] = useState<QuoteRTDraft | null>(null)
  const [isQuoteEditorGenerating, setIsQuoteEditorGenerating] = useState(false)
  
  // Free tier usage tracking
  const [generationsRemaining, setGenerationsRemaining] = useState<number>(3)
  const [generationsLimit, setGenerationsLimit] = useState<number>(3)

  const { isPro, startCheckout } = useSubscription(user?.id ?? null)
  const upgradeEnabled = process.env.NEXT_PUBLIC_UPGRADE_ENABLED !== "false"

  const handleUpgrade = async () => {
    try {
      await startCheckout()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "アップグレードを開始できませんでした"
      showToast(msg, "error")
    }
  }

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

  // Load usage limits
  const loadUsageLimits = useCallback(async () => {
    if (!user) return
    try {
      const result = await canGenerateQuoteRT(user.id, isPro)
      setGenerationsRemaining(result.remaining === Infinity ? 999 : result.remaining)
      setGenerationsLimit(result.limit === Infinity ? 999 : result.limit)
    } catch (e) {
      console.warn("Failed to load usage limits:", e)
    }
  }, [user, isPro])

  useEffect(() => {
    if (!user) return
    loadPosts()
    loadTwitterAccounts()
    loadUsageLimits()
  }, [user, isPro, loadUsageLimits])

  const loadPosts = async () => {
    if (!user) return
    setLoadingPosts(true)
    try {
      const data = await getInspirationPosts(user.id, 20, isPro)
      setPosts(data)
    } catch (e) {
      showToast("投稿の取得に失敗しました", "error")
    } finally {
      setLoadingPosts(false)
    }
  }

  const loadTwitterAccounts = async () => {
    if (!user) return
    try {
      const accounts = await getTwitterAccounts(user.id)
      setTwitterAccounts(accounts)
      if (accounts.length > 0) {
        const defaultAcc = await getDefaultTwitterAccount(user.id)
        setSelectedAccountId(defaultAcc?.id || accounts[0].id)
      }
    } catch (e) {
      console.error("Failed to load Twitter accounts:", e)
    }
  }

  const handleGenerateQuoteRT = async (post: InspirationPost) => {
    // Check free tier limits
    if (!isPro && generationsRemaining <= 0) {
      showToast("本日のAI生成回数の上限に達しました。Proにアップグレードすると無制限に利用できます。", "error")
      return
    }
    
    // Open the quote editor modal
    setQuoteEditorPost(post)
    setQuoteEditorDraft(null)
  }
  
  // Handle AI generation in Quote RT Editor
  const handleQuoteEditorGenerate = async (context?: string) => {
    if (!user || !quoteEditorPost) return
    
    // Check free tier limits again
    if (!isPro && generationsRemaining <= 0) {
      showToast("本日のAI生成回数の上限に達しました", "error")
      return
    }
    
    setIsQuoteEditorGenerating(true)
    try {
      const result = await generateQuoteRTDraft(user.id, quoteEditorPost, context, isPro)
      if (result) {
        setQuoteEditorDraft(result)
        // Refresh usage limits after generation
        await loadUsageLimits()
      } else {
        showToast("コメントの生成に失敗しました", "error")
      }
    } catch (e) {
      showToast("エラーが発生しました", "error")
    } finally {
      setIsQuoteEditorGenerating(false)
    }
  }
  
  // Handle post from Quote RT Editor
  const handleQuoteEditorPost = async (comment: string) => {
    if (!user || !selectedAccountId || !quoteEditorPost?.tweet_id) {
      return { success: false, error: "必要な情報が不足しています" }
    }
    
    const account = await getTwitterAccountById(selectedAccountId, user.id)
    if (!account?.access_token) {
      return { success: false, error: "Twitterアカウントが見つかりません" }
    }
    
    const result = await postQuoteRT(user.id, comment, quoteEditorPost.tweet_id, account.access_token, selectedAccountId)
    if (result.success) {
      showToast("引用RTを投稿しました！", "success")
      loadPosts()
    }
    return result
  }
  
  // Handle schedule from Quote RT Editor
  const handleQuoteEditorSchedule = async (comment: string, scheduledFor: Date) => {
    if (!user || !quoteEditorPost?.tweet_id) {
      return { success: false, error: "必要な情報が不足しています" }
    }
    
    const result = await scheduleRetweet(user.id, quoteEditorPost.tweet_id, "quote", {
      comment,
      scheduledFor,
      twitterAccountId: selectedAccountId ?? undefined,
    })
    
    if (result.success) {
      showToast(`引用RTを ${scheduledFor.toLocaleString("ja-JP")} に予約しました`, "success")
    }
    return result
  }

  const handlePostSimpleRetweet = async (tweetId: string) => {
    if (!user || !selectedAccountId) return { success: false, error: "アカウントを選択してください。" }
    const account = await getTwitterAccountById(selectedAccountId, user.id)
    if (!account?.access_token) return { success: false, error: "Twitterアカウントが見つかりません。" }
    return postSimpleRetweet(user.id, tweetId, account.access_token, selectedAccountId)
  }

  const handlePostQuoteRetweet = async (tweetId: string, comment: string) => {
    if (!user || !selectedAccountId) return { success: false, error: "アカウントを選択してください。" }
    const account = await getTwitterAccountById(selectedAccountId, user.id)
    if (!account?.access_token) return { success: false, error: "Twitterアカウントが見つかりません。" }
    const result = await postQuoteRT(user.id, comment, tweetId, account.access_token, selectedAccountId)
    return { success: result.success, error: result.error }
  }

  const handleScheduleRetweet = async (
    tweetId: string,
    type: "simple" | "quote",
    options: { comment?: string; scheduledFor: Date }
  ) => {
    if (!user) return { success: false, error: "ログインしてください。" }
    return scheduleRetweet(user.id, tweetId, type, {
      comment: options.comment,
      scheduledFor: options.scheduledFor,
      twitterAccountId: selectedAccountId ?? undefined,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Quote className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">インスピレーション</h1>
            <p className="text-muted-foreground text-sm">過去の人気投稿から引用RTのアイデアを生成</p>
          </div>
        </div>
        
        {user && (
          <ObsidianExport
            userId={user.id}
            className="border-2 shadow-sm"
          />
        )}
      </div>

      {/* Free tier usage info */}
      {!isPro && (
        <Card className="rounded-2xl border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium">無料プランの利用状況</p>
                  <p className="text-xs text-muted-foreground">
                    本日のAI生成: {generationsLimit === 999 ? "無制限" : `${generationsLimit - generationsRemaining}/${generationsLimit}回`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge 
                  variant={generationsRemaining > 0 ? "secondary" : "destructive"}
                  className="rounded-lg"
                >
                  残り {generationsRemaining === 999 ? "∞" : generationsRemaining} 回
                </Badge>
                {upgradeEnabled && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUpgrade}
                    className="rounded-xl border-purple-500/50 text-purple-600 hover:bg-purple-500/10"
                  >
                    <Crown className="h-3.5 w-3.5 mr-1.5" />
                    無制限にする
                  </Button>
                )}
              </div>
            </div>
            {generationsRemaining < generationsLimit && (
              <Progress 
                value={(generationsRemaining / generationsLimit) * 100} 
                className="h-1.5 mt-3 [&>div]:bg-purple-500" 
              />
            )}
          </CardContent>
        </Card>
      )}

      {!isPro && upgradeEnabled && (
        <ProCard config={{ spotsLeft: 5, spotsTotal: 5, currentPlan: "Free" }} onUpgrade={handleUpgrade} variant="compact" showAsUpgrade={true} />
      )}

      <Card className="rounded-2xl border-0 shadow-lg bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            追加コンテキスト（任意）
          </CardTitle>
          <CardDescription>AI生成時に考慮してほしい内容を入力</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="例：今日の気分、宣伝したいこと、視点など"
            value={userContext}
            onChange={(e) => setUserContext(e.target.value)}
            className="rounded-xl"
          />
        </CardContent>
      </Card>

      <InspirationList
        posts={posts}
        loading={loadingPosts}
        isPro={isPro}
        onRefresh={loadPosts}
        onAutoRetweet={(post) => {
          if (!isPro) {
            showToast("自動リツイートはProプランで利用できます", "error")
            return
          }
          if (!post.tweet_id) {
            showToast("元ツイートIDがありません", "error")
            return
          }
          setRetweetModalPost(post)
        }}
        onGenerateQuote={handleGenerateQuoteRT}
        generatingForId={generatingFor}
      />

      <RetweetModal
        post={retweetModalPost}
        isOpen={!!retweetModalPost}
        onClose={() => setRetweetModalPost(null)}
        onPostSimple={async (tweetId) => {
          const result = await handlePostSimpleRetweet(tweetId)
          if (result.success) {
            showToast("リツイートしました", "success")
            loadPosts()
          } else {
            showToast(result.error ?? "リツイートに失敗しました", "error")
          }
          return result
        }}
        onPostQuote={async (tweetId, comment) => {
          const result = await handlePostQuoteRetweet(tweetId, comment)
          if (result.success) {
            showToast("引用RTを投稿しました", "success")
            loadPosts()
          } else {
            showToast(result.error ?? "引用RTに失敗しました", "error")
          }
          return result
        }}
        onSchedule={async (tweetId, type, options) => {
          const result = await handleScheduleRetweet(tweetId, type, options)
          if (result.success) {
            showToast(`自動リツイートを ${new Date(options.scheduledFor).toLocaleString("ja-JP")} に予約しました`, "success")
            loadPosts()
          } else {
            showToast(result.error ?? "予約に失敗しました", "error")
          }
          return result
        }}
      />

      {/* Quote RT Editor Modal */}
      <QuoteRTEditor
        isOpen={!!quoteEditorPost}
        onClose={() => {
          setQuoteEditorPost(null)
          setQuoteEditorDraft(null)
        }}
        post={quoteEditorPost}
        draft={quoteEditorDraft}
        isGenerating={isQuoteEditorGenerating}
        onGenerate={handleQuoteEditorGenerate}
        onRegenerate={() => handleQuoteEditorGenerate(userContext)}
        onPost={handleQuoteEditorPost}
        onSchedule={handleQuoteEditorSchedule}
      />
    </div>
  )
}
