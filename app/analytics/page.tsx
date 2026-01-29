"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  getAnalyticsPosts,
  getABTestGroups,
  getOptimizationAdvice,
  generateOptimizedVersion,
  type AnalyticsPost,
  type ABTestGroup,
  type OptimizationAdvice,
  type OptimizedVersionResult,
} from "@/app/actions-analytics"
import { updateAllTweetEngagements, getDefaultTwitterAccount, getTwitterAccounts } from "@/app/actions"
import { useSubscription } from "@/hooks/useSubscription"
import { ProCard } from "@/components/ProCard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  BarChart3,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Sparkles,
  TrendingUp,
  Eye,
  Heart,
  Repeat2,
  MessageCircle,
  ChevronUp,
  ChevronDown,
  Lightbulb,
  Zap,
  Lock,
  FlaskConical,
  Trophy,
} from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import dynamic from "next/dynamic"

const Line = dynamic(() => import("react-chartjs-2").then((mod) => mod.Line), { ssr: false })
const Bar = dynamic(() => import("react-chartjs-2").then((mod) => mod.Bar), { ssr: false })

// Chart.js registration (client-only)
if (typeof window !== "undefined") {
  try {
    const ChartJS = require("chart.js")
    ChartJS.Chart.register(
      ChartJS.CategoryScale,
      ChartJS.LinearScale,
      ChartJS.PointElement,
      ChartJS.LineElement,
      ChartJS.BarElement,
      ChartJS.Title,
      ChartJS.Tooltip,
      ChartJS.Legend,
      ChartJS.Filler
    )
  } catch {
    // chart.js not installed
  }
}

type SortKey = "created_at" | "impression_count" | "engagement_score"
type SortDir = "asc" | "desc"

interface User {
  id: string
  email?: string
}

export default function AnalyticsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<AnalyticsPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("created_at")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [advice, setAdvice] = useState<OptimizationAdvice | null>(null)
  const [loadingAdvice, setLoadingAdvice] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [optimizingId, setOptimizingId] = useState<string | null>(null)
  const [optimizedResult, setOptimizedResult] = useState<{ postId: string; result: OptimizedVersionResult } | null>(null)
  const [abGroups, setAbGroups] = useState<ABTestGroup[]>([])

  const { isPro, startCheckout } = useSubscription(user?.id ?? null)
  const upgradeEnabled = process.env.NEXT_PUBLIC_UPGRADE_ENABLED !== "false"

  const handleUpgrade = async () => {
    try {
      await startCheckout()
    } catch (e) {
      showToast(e instanceof Error ? e.message : "アップグレードを開始できませんでした", "error")
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
    if (isPro) loadABGroups()
  }, [user, isPro])

  const loadABGroups = async () => {
    if (!user) return
    try {
      const data = await getABTestGroups(user.id, 20)
      setAbGroups(data)
    } catch {
      // non-blocking
    }
  }

  const loadPosts = async () => {
    if (!user) return
    setLoadingPosts(true)
    try {
      const data = await getAnalyticsPosts(user.id, 100)
      setPosts(data)
    } catch (e) {
      showToast("投稿の取得に失敗しました", "error")
    } finally {
      setLoadingPosts(false)
    }
  }

  const sortedPosts = useMemo(() => {
    const arr = [...posts]
    arr.sort((a, b) => {
      let va: number | string = 0
      let vb: number | string = 0
      if (sortKey === "created_at") {
        va = a.created_at
        vb = b.created_at
      } else if (sortKey === "impression_count") {
        va = a.impression_count ?? 0
        vb = b.impression_count ?? 0
      } else {
        va = a.engagement_score ?? 0
        vb = b.engagement_score ?? 0
      }
      if (typeof va === "string") return sortDir === "desc" ? (vb as string).localeCompare(va) : (va as string).localeCompare(vb as string)
      return sortDir === "desc" ? (vb as number) - (va as number) : (va as number) - (vb as number)
    })
    return arr
  }, [posts, sortKey, sortDir])

  const handleRefreshMetrics = async () => {
    if (!user) return
    const account = await getDefaultTwitterAccount(user.id)
    if (!account?.access_token) {
      showToast("X連携が必要です", "error")
      return
    }
    setSyncing(true)
    try {
      const { updated, failed } = await updateAllTweetEngagements(user.id, account.access_token)
      showToast(`インプレッションを更新しました（${updated}件成功${failed ? `、${failed}件スキップ` : ""}）`, "success")
      loadPosts()
      if (isPro) loadABGroups()
    } catch (e) {
      showToast("メトリクスの更新に失敗しました", "error")
    } finally {
      setSyncing(false)
    }
  }

  const handleGetAdvice = async () => {
    if (!user || !isPro) {
      showToast("最適化アドバイスはProプランで利用できます", "error")
      return
    }
    setLoadingAdvice(true)
    try {
      const data = await getOptimizationAdvice(user.id)
      setAdvice(data ?? null)
      if (!data) showToast("アドバイスを取得できませんでした", "warning")
    } catch (e) {
      showToast("アドバイスの取得に失敗しました", "error")
    } finally {
      setLoadingAdvice(false)
    }
  }

  const handleOptimize = async (postId: string) => {
    if (!user || !isPro) {
      showToast("最適化はProプランで利用できます", "error")
      return
    }
    setOptimizingId(postId)
    setOptimizedResult(null)
    try {
      const result = await generateOptimizedVersion(user.id, postId)
      if (result) setOptimizedResult({ postId, result })
      else showToast("最適化の生成に失敗しました", "error")
    } catch (e) {
      showToast("最適化の生成に失敗しました", "error")
    } finally {
      setOptimizingId(null)
    }
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const chartDataImpressions = useMemo(() => {
    const sorted = [...posts].filter((p) => (p.impression_count ?? 0) > 0).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    return {
      labels: sorted.slice(-20).map((p) => new Date(p.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })),
      datasets: [{ label: "インプレッション", data: sorted.slice(-20).map((p) => p.impression_count ?? 0), borderColor: "rgb(34, 197, 94)", backgroundColor: "rgba(34, 197, 94, 0.1)", fill: true }],
    }
  }, [posts])

  const chartDataEngagement = useMemo(() => {
    const top = [...posts].sort((a, b) => (b.engagement_score ?? 0) - (a.engagement_score ?? 0)).slice(0, 10)
    return {
      labels: top.map((p) => p.text.slice(0, 12) + "..."),
      datasets: [{ label: "エンゲージメント", data: top.map((p) => p.engagement_score ?? 0), backgroundColor: "rgba(34, 197, 94, 0.6)" }],
    }
  }, [posts])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50/10 to-background dark:from-green-950/20 dark:to-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/10 to-background dark:from-green-950/20 dark:to-background">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <Button variant="ghost" className="rounded-xl gap-2 -ml-2" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="h-4 w-4" />
          ダッシュボードに戻る
        </Button>

        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">投稿分析</h1>
              <p className="text-sm text-muted-foreground">インプレッション・エンゲージメントと最適化アドバイス</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefreshMetrics} disabled={syncing || !isPro} className="rounded-xl">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
              {isPro ? "メトリクスを更新" : "Proで利用"}
            </Button>
            {!isPro && upgradeEnabled && (
              <ProCard config={{ spotsLeft: 5, spotsTotal: 5, currentPlan: "Free" }} onUpgrade={handleUpgrade} variant="compact" showAsUpgrade />
            )}
          </div>
        </div>

        {/* AI Optimization Advice */}
        <Card className="rounded-2xl border-0 shadow-lg bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-base">最適化アドバイス</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGetAdvice}
                disabled={loadingAdvice || !isPro}
                className="rounded-xl"
              >
                {loadingAdvice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                {isPro ? "AIアドバイスを取得" : <Lock className="h-4 w-4 mr-1.5" />}
              </Button>
            </div>
            <CardDescription>低パフォーマンス投稿への改善提案（書き換え・メディア・タイミング）</CardDescription>
          </CardHeader>
          {advice && (
            <CardContent className="space-y-2">
              <p className="text-sm">{advice.summary}</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {advice.suggestions.map((s, i) => (
                  <li key={i}>
                    <Badge variant="secondary" className="mr-1 rounded-full">{s.type === "rewrite" ? "書き換え" : s.type === "media" ? "メディア" : "タイミング"}</Badge>
                    {s.text}
                  </li>
                ))}
              </ul>
              {advice.lowPerformersCount > 0 && (
                <p className="text-xs text-muted-foreground">対象: 低パフォーマンス投稿 {advice.lowPerformersCount}件</p>
              )}
            </CardContent>
          )}
        </Card>

        {/* Charts */}
        {isPro && posts.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {chartDataImpressions.labels.length > 0 && Line && (
              <Card className="rounded-2xl border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4 text-green-500" />
                    インプレッション推移
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <Line
                      data={chartDataImpressions}
                      options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
            {chartDataEngagement.labels.length > 0 && Bar && (
              <Card className="rounded-2xl border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    エンゲージメント上位
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <Bar
                      data={chartDataEngagement}
                      options={{ responsive: true, maintainAspectRatio: false, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* AB Test comparison (Pro) */}
        {isPro && abGroups.length > 0 && (
          <Card className="rounded-2xl border-0 shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-green-500" />
                ABテスト比較
              </CardTitle>
              <CardDescription>同じテストIDで投稿した複数案のインプレッション・エンゲージメント差</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">テスト</th>
                      <th className="text-left py-3 px-2 font-medium">案</th>
                      <th className="text-right py-3 px-2 font-medium">インプレ</th>
                      <th className="text-right py-3 px-2 font-medium">エンゲージ</th>
                      <th className="text-center py-3 px-2 font-medium">勝者</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abGroups.flatMap((g) =>
                      g.posts.map((p, i) => (
                        <tr key={p.id} className="border-b last:border-0">
                          {i === 0 && (
                            <td className="py-3 px-2 text-muted-foreground align-top" rowSpan={g.posts.length}>
                              {new Date(g.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}
                            </td>
                          )}
                          <td className="py-2 px-2 max-w-[200px]">
                            <p className="truncate text-muted-foreground" title={p.text}>{p.text}</p>
                          </td>
                          <td className="text-right py-2 px-2">{(p.impression_count ?? 0).toLocaleString()}</td>
                          <td className="text-right py-2 px-2">{(p.engagement_score ?? 0).toLocaleString()}</td>
                          <td className="text-center py-2 px-2">
                            {i === g.winnerIndex ? <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 rounded-full"><Trophy className="h-3 w-3 mr-0.5 inline" /> 勝者</Badge> : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Posts table */}
        <Card className="rounded-2xl border-0 shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">投稿一覧</CardTitle>
            <CardDescription>ソートで並び替え可能。Proで最適化ボタンとメトリクス更新が利用できます</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPosts ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : posts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">まだ投稿がありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">投稿</th>
                      <th className="text-right py-3 px-2 font-medium">
                        <button onClick={() => toggleSort("impression_count")} className="flex items-center justify-end gap-1 w-full hover:opacity-80">
                          インプレ <span>{sortKey === "impression_count" ? sortDir === "desc" ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" /> : null}</span>
                        </button>
                      </th>
                      <th className="text-right py-3 px-2 font-medium">
                        <button onClick={() => toggleSort("engagement_score")} className="flex items-center justify-end gap-1 w-full hover:opacity-80">
                          エンゲージ <span>{sortKey === "engagement_score" ? sortDir === "desc" ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" /> : null}</span>
                        </button>
                      </th>
                      <th className="text-right py-3 px-2 font-medium">
                        <button onClick={() => toggleSort("created_at")} className="flex items-center justify-end gap-1 w-full hover:opacity-80">
                          日時 <span>{sortKey === "created_at" ? sortDir === "desc" ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" /> : null}</span>
                        </button>
                      </th>
                      {isPro && <th className="text-right py-3 px-2 font-medium">操作</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPosts.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-3 px-2 max-w-xs">
                          <p className="truncate text-muted-foreground" title={p.text}>{p.text}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-0.5"><Heart className="h-3 w-3 text-red-400" />{p.like_count}</span>
                            <span className="flex items-center gap-0.5"><Repeat2 className="h-3 w-3 text-green-400" />{p.retweet_count}</span>
                            <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3 text-blue-400" />{p.reply_count}</span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-2">{(p.impression_count ?? 0).toLocaleString()}</td>
                        <td className="text-right py-3 px-2">{(p.engagement_score ?? 0).toLocaleString()}</td>
                        <td className="text-right py-3 px-2 text-muted-foreground">{new Date(p.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                        {isPro && (
                          <td className="text-right py-3 px-2">
                            <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => handleOptimize(p.id)} disabled={optimizingId === p.id}>
                              {optimizingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                              最適化
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Optimized result popover-style card */}
        {optimizedResult && (
          <Card className="rounded-2xl border-2 border-green-500/30 shadow-xl bg-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-500" />
                最適化案
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setOptimizedResult(null)}>閉じる</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">期待インプレッション増加: 約 +{optimizedResult.result.expectedImpressionsLiftPercent}%</p>
              {optimizedResult.result.reason && <p className="text-xs text-muted-foreground">{optimizedResult.result.reason}</p>}
              <div className="p-3 rounded-xl bg-muted/50 text-sm whitespace-pre-wrap">{optimizedResult.result.improvedText}</div>
              <p className="text-xs text-muted-foreground">このテキストをコピーしてダッシュボードで新規投稿として利用できます。自動投稿は行いません。</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
