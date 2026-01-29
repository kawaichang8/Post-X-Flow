"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getInspirationPosts, generateQuoteRTDraft, postQuoteRT, InspirationPost, QuoteRTDraft } from "@/app/actions-inspiration"
import { getTwitterAccounts, getDefaultTwitterAccount, getTwitterAccountById, TwitterAccount } from "@/app/actions"
import { useSubscription } from "@/hooks/useSubscription"
import { UpgradeBanner } from "@/components/UpgradeBanner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import {
  ArrowLeft,
  Quote,
  Heart,
  Repeat2,
  MessageCircle,
  Eye,
  Sparkles,
  Loader2,
  Send,
  Calendar,
  RefreshCw,
  Lock,
} from "lucide-react"

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

  // Twitter
  const [twitterAccounts, setTwitterAccounts] = useState<TwitterAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)

  // Quote RT draft
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [draft, setDraft] = useState<QuoteRTDraft | null>(null)
  const [editedComment, setEditedComment] = useState("")
  const [userContext, setUserContext] = useState("")
  const [posting, setPosting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

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

  useEffect(() => {
    if (!user) return
    loadPosts()
    loadTwitterAccounts()
  }, [user])

  const loadPosts = async () => {
    if (!user) return
    setLoadingPosts(true)
    try {
      const data = await getInspirationPosts(user.id)
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
    if (!user || !isPro) {
      showToast("この機能はProプランで利用可能です", "error")
      return
    }
    setGeneratingFor(post.id)
    setDraft(null)
    try {
      const result = await generateQuoteRTDraft(user.id, post, userContext || undefined)
      if (result) {
        setDraft(result)
        setEditedComment(result.generatedComment)
      } else {
        showToast("コメントの生成に失敗しました", "error")
      }
    } catch (e) {
      showToast("エラーが発生しました", "error")
    } finally {
      setGeneratingFor(null)
    }
  }

  const handlePost = async () => {
    if (!user || !draft || !selectedAccountId) return
    
    const account = await getTwitterAccountById(selectedAccountId, user.id)
    if (!account?.access_token) {
      showToast("Twitterアカウントが見つかりません", "error")
      return
    }

    if (!draft.originalPost.tweet_id) {
      showToast("元ツイートIDが不明です", "error")
      return
    }

    setPosting(true)
    try {
      const result = await postQuoteRT(
        user.id,
        editedComment,
        draft.originalPost.tweet_id,
        account.access_token,
        selectedAccountId
      )
      if (result.success) {
        showToast("引用RTを投稿しました！", "success")
        setDraft(null)
        setEditedComment("")
        setShowConfirm(false)
      } else {
        showToast(result.error || "投稿に失敗しました", "error")
      }
    } catch (e) {
      showToast("投稿中にエラーが発生しました", "error")
    } finally {
      setPosting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50/10 to-background dark:from-green-950/20 dark:to-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/10 to-background dark:from-green-950/20 dark:to-background">
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <Button
          variant="ghost"
          className="rounded-xl gap-2 -ml-2"
          onClick={() => router.push("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
          ダッシュボードに戻る
        </Button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Quote className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">インスピレーション</h1>
            <p className="text-muted-foreground text-sm">
              過去の人気投稿から引用RTのアイデアを生成
            </p>
          </div>
        </div>

        {!isPro && upgradeEnabled && (
          <UpgradeBanner
            trialDaysRemaining={0}
            generationsRemaining={0}
            generationsLimit={3}
            onUpgrade={handleUpgrade}
            variant="compact"
            dismissible={false}
          />
        )}

        {/* Context Input */}
        <Card className="rounded-2xl border-0 shadow-lg bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              追加コンテキスト（任意）
            </CardTitle>
            <CardDescription>
              AI生成時に考慮してほしい内容を入力
            </CardDescription>
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

        {/* Posts List */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            人気の投稿
            {posts.length > 0 && (
              <Badge variant="secondary" className="ml-2">{posts.length}件</Badge>
            )}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={loadPosts}
            disabled={loadingPosts}
            className="rounded-xl"
          >
            <RefreshCw className={cn("h-4 w-4 mr-1.5", loadingPosts && "animate-spin")} />
            更新
          </Button>
        </div>

        {loadingPosts ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="rounded-2xl border-dashed">
            <CardContent className="py-12 text-center">
              <Quote className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                まだ投稿がありません。ダッシュボードから投稿を作成してください。
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card
                key={post.id}
                className={cn(
                  "rounded-2xl border-0 shadow-md bg-card/80 backdrop-blur-sm transition-all",
                  draft?.originalPost.id === post.id && "ring-2 ring-purple-500"
                )}
              >
                <CardContent className="p-4">
                  <p className="text-sm whitespace-pre-wrap mb-4">{post.text}</p>
                  
                  {/* Engagement Stats */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5 text-red-400" />
                      {post.like_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <Repeat2 className="h-3.5 w-3.5 text-green-400" />
                      {post.retweet_count}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5 text-blue-400" />
                      {post.reply_count}
                    </span>
                    {post.impression_count && (
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {post.impression_count.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Generate Button */}
                  <Button
                    onClick={() => handleGenerateQuoteRT(post)}
                    disabled={generatingFor === post.id || !isPro}
                    className={cn(
                      "w-full rounded-xl",
                      isPro
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        : "opacity-60"
                    )}
                  >
                    {generatingFor === post.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : !isPro ? (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Pro限定
                      </>
                    ) : (
                      <>
                        <Quote className="h-4 w-4 mr-2" />
                        引用RTを生成
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Draft Preview */}
        {draft && (
          <Card className="rounded-2xl border-2 border-purple-500/30 shadow-xl bg-card/90 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                引用RTプレビュー
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Editable Comment */}
              <div className="space-y-2">
                <label className="text-sm font-medium">あなたのコメント</label>
                <Textarea
                  value={editedComment}
                  onChange={(e) => setEditedComment(e.target.value)}
                  rows={3}
                  className="rounded-xl resize-none"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className={cn(
                    editedComment.length > 140 ? "text-red-500" : "text-muted-foreground"
                  )}>
                    {editedComment.length}/280
                  </span>
                </div>
              </div>

              {/* Naturalness Score */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>自然さスコア</span>
                  <span className={cn(
                    "font-medium",
                    draft.naturalnessScore >= 80 ? "text-green-500" :
                    draft.naturalnessScore >= 60 ? "text-yellow-500" : "text-red-500"
                  )}>
                    {draft.naturalnessScore}/100
                  </span>
                </div>
                <Progress
                  value={draft.naturalnessScore}
                  className={cn(
                    "h-2",
                    draft.naturalnessScore >= 80 ? "[&>div]:bg-green-500" :
                    draft.naturalnessScore >= 60 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500"
                  )}
                />
              </div>

              {/* Original Tweet Preview */}
              <div className="p-3 rounded-xl bg-muted/50 border">
                <p className="text-xs text-muted-foreground mb-1">引用元</p>
                <p className="text-sm">{draft.originalPost.text}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setDraft(null)}
                  className="flex-1 rounded-xl"
                >
                  キャンセル
                </Button>
                <Button
                  onClick={() => setShowConfirm(true)}
                  disabled={!editedComment.trim() || editedComment.length > 280}
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                >
                  <Send className="h-4 w-4 mr-2" />
                  投稿する
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>引用RTを投稿しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                この投稿は即座にXに公開されます。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={handlePost}
                disabled={posting}
                className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {posting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "投稿する"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
