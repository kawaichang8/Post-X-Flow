"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToast } from "@/components/ui/toast"
import {
  Download,
  FileText,
  ExternalLink,
  Loader2,
  Info,
  Calendar,
  BarChart3,
  History,
  Quote,
} from "lucide-react"
import {
  generateObsidianMarkdown,
  generateObsidianUri,
  downloadAsFile,
  generateExportFileName,
  type ObsidianExportData,
  type DraftForExport,
  type ScheduledPostForExport,
  type AnalyticsSummary,
  type QuoteRTCandidateForExport,
} from "@/lib/obsidian-export"
import { getScheduledTweets, getPostHistory } from "@/app/actions"
import { getGenerationHistory, type GenerationHistoryItem } from "@/app/actions-generation-history"
import { getObsidianVaultName } from "@/app/actions-user-settings"
import { getInspirationPosts } from "@/app/actions-inspiration"

interface ObsidianExportProps {
  userId: string
  currentDrafts?: DraftForExport[]
  className?: string
}

export function ObsidianExport({ userId, currentDrafts, className }: ObsidianExportProps) {
  const { showToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [vaultName, setVaultName] = useState("")
  
  // Export options
  const [includeDrafts, setIncludeDrafts] = useState(true)
  const [includeScheduled, setIncludeScheduled] = useState(true)
  const [includeQuoteRT, setIncludeQuoteRT] = useState(true)
  const [includeAnalytics, setIncludeAnalytics] = useState(true)
  const [includeHistory, setIncludeHistory] = useState(false)

  // Load vault name on dialog open
  const handleOpenChange = useCallback(async (open: boolean) => {
    setIsOpen(open)
    if (open) {
      try {
        const savedVaultName = await getObsidianVaultName(userId)
        if (savedVaultName) {
          setVaultName(savedVaultName)
        }
      } catch (e) {
        console.warn("Failed to load vault name:", e)
      }
    }
  }, [userId])

  // Gather export data
  const gatherExportData = async (): Promise<ObsidianExportData> => {
    const data: ObsidianExportData = {}

    // Current drafts
    if (includeDrafts && currentDrafts && currentDrafts.length > 0) {
      data.drafts = currentDrafts
    }

    // Scheduled posts
    if (includeScheduled) {
      try {
        const scheduled = await getScheduledTweets(userId)
        if (scheduled.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.scheduledPosts = scheduled.map((p: any) => ({
            id: p.id,
            text: p.text,
            scheduled_for: p.scheduled_for,
            status: p.status,
            naturalness_score: p.naturalness_score,
            trend: p.trend,
            purpose: p.purpose,
          })) as ScheduledPostForExport[]
        }
      } catch (e) {
        console.warn("Failed to load scheduled posts:", e)
      }
    }

    // Quote RT candidates
    if (includeQuoteRT) {
      try {
        const candidates = await getInspirationPosts(userId, 10, true)
        if (candidates.length > 0) {
          data.quoteRTCandidates = candidates.map((c) => ({
            id: c.id,
            originalText: c.text,
            originalTweetId: c.tweet_id,
            originalAuthor: c.author_name || c.author_handle,
            likeCount: c.like_count,
            retweetCount: c.retweet_count,
            impressionCount: c.impression_count,
          })) as QuoteRTCandidateForExport[]
        }
      } catch (e) {
        console.warn("Failed to load quote RT candidates:", e)
      }
    }

    // Analytics summary
    if (includeAnalytics) {
      try {
        const history = await getPostHistory(userId, 50)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const postedItems = history.filter((p: any) => p.status === "posted")
        
        if (postedItems.length > 0) {
          const totalImpressions = postedItems.reduce(
            (sum, p) => sum + (p.impression_count || 0),
            0
          )
          const totalEngagements = postedItems.reduce(
            (sum, p) => sum + ((p.like_count || 0) + (p.retweet_count || 0) + (p.reply_count || 0)),
            0
          )
          const avgEngagementRate = totalImpressions > 0
            ? (totalEngagements / totalImpressions) * 100
            : 0

          // Find top performing post
          const sortedByEngagement = [...postedItems].sort(
            (a, b) => ((b.like_count || 0) + (b.retweet_count || 0)) - ((a.like_count || 0) + (a.retweet_count || 0))
          )
          const topPost = sortedByEngagement[0]

          data.analytics = {
            totalImpressions,
            totalEngagements,
            avgEngagementRate,
            topPerformingPost: topPost?.text,
            improvementSuggestions: [
              "投稿時間を最適化して、フォロワーがアクティブな時間帯を狙いましょう",
              "質問形式の投稿はエンゲージメントが高くなる傾向があります",
              "ハッシュタグは2-3個に絞ると効果的です",
            ],
          }
        }
      } catch (e) {
        console.warn("Failed to gather analytics:", e)
      }
    }

    // Generation history
    if (includeHistory) {
      try {
        const { data: genHistory } = await getGenerationHistory(userId, { limit: 20 })
        if (genHistory.length > 0) {
          data.generationHistory = genHistory.map((item: GenerationHistoryItem) => ({
            trend: item.trend || "",
            purpose: item.purpose || "",
            created_at: item.created_at,
            drafts: (item.drafts || []).map((d, idx) => ({
              id: `gen-${item.id}-${idx}`,
              content: d.text || "",
              naturalness_score: d.naturalness_score,
              purpose: item.purpose || undefined,
              trend: item.trend || undefined,
            })),
          }))
        }
      } catch (e) {
        console.warn("Failed to load generation history:", e)
      }
    }

    return data
  }

  // Handle download
  const handleDownload = async () => {
    setIsExporting(true)
    try {
      const data = await gatherExportData()
      
      if (!data.drafts?.length && !data.scheduledPosts?.length && !data.analytics && !data.generationHistory?.length) {
        showToast("エクスポートするデータがありません", "warning")
        return
      }

      const markdown = generateObsidianMarkdown(data)
      const fileName = generateExportFileName()
      downloadAsFile(markdown, fileName)
      
      showToast("Markdownファイルをダウンロードしました", "success")
      setIsOpen(false)
    } catch (e) {
      console.error("Export failed:", e)
      showToast("エクスポートに失敗しました", "error")
    } finally {
      setIsExporting(false)
    }
  }

  // Handle open in Obsidian
  const handleOpenInObsidian = async () => {
    if (!vaultName.trim()) {
      showToast("Vault名を入力してください", "warning")
      return
    }

    setIsExporting(true)
    try {
      const data = await gatherExportData()
      
      if (!data.drafts?.length && !data.scheduledPosts?.length && !data.analytics && !data.generationHistory?.length) {
        showToast("エクスポートするデータがありません", "warning")
        return
      }

      const markdown = generateObsidianMarkdown(data)
      const fileName = generateExportFileName().replace(".md", "")
      const uri = generateObsidianUri(vaultName, fileName, markdown)
      
      // Open Obsidian URI
      window.location.href = uri
      
      showToast("Obsidianで開いています...", "info")
      setIsOpen(false)
    } catch (e) {
      console.error("Obsidian open failed:", e)
      showToast("Obsidianで開けませんでした", "error")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className={`rounded-xl ${className}`}
          >
            <Download className="h-4 w-4 mr-2" />
            Obsidianエクスポート
          </Button>
        </DialogTrigger>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-500" />
              Obsidianエクスポート
            </DialogTitle>
            <DialogDescription>
              投稿データをMarkdown形式でエクスポートします
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Export options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">エクスポート内容</Label>
              
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 bg-accent/30 rounded-xl cursor-pointer hover:bg-accent/50 transition-colors">
                  <Checkbox
                    id="includeDrafts"
                    checked={includeDrafts}
                    onCheckedChange={(checked) => setIncludeDrafts(checked === true)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">生成ドラフト</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      現在の生成済みドラフト{currentDrafts?.length ? `（${currentDrafts.length}件）` : ""}
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-accent/30 rounded-xl cursor-pointer hover:bg-accent/50 transition-colors">
                  <Checkbox
                    id="includeScheduled"
                    checked={includeScheduled}
                    onCheckedChange={(checked) => setIncludeScheduled(checked === true)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">スケジュール投稿</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      予約中の投稿をカレンダー形式で
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-accent/30 rounded-xl cursor-pointer hover:bg-accent/50 transition-colors">
                  <Checkbox
                    id="includeQuoteRT"
                    checked={includeQuoteRT}
                    onCheckedChange={(checked) => setIncludeQuoteRT(checked === true)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Quote className="h-4 w-4 text-pink-500" />
                      <span className="text-sm font-medium">引用RT候補</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      おすすめの引用候補リスト
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-accent/30 rounded-xl cursor-pointer hover:bg-accent/50 transition-colors">
                  <Checkbox
                    id="includeAnalytics"
                    checked={includeAnalytics}
                    onCheckedChange={(checked) => setIncludeAnalytics(checked === true)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">分析サマリー</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      インプレッション・エンゲージメント統計
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-accent/30 rounded-xl cursor-pointer hover:bg-accent/50 transition-colors">
                  <Checkbox
                    id="includeHistory"
                    checked={includeHistory}
                    onCheckedChange={(checked) => setIncludeHistory(checked === true)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-violet-500" />
                      <span className="text-sm font-medium">生成履歴</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      過去の生成セッション（最大20件）
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Obsidian Vault Name */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="vaultName" className="text-sm font-medium">
                  Obsidian Vault名（任意）
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      Vault名を入力すると「Obsidianで開く」ボタンでObsidianアプリに直接ファイルを作成できます。
                      設定ページで保存しておくこともできます。
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="vaultName"
                value={vaultName}
                onChange={(e) => setVaultName(e.target.value)}
                placeholder="例: MyNotes"
                className="rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={isExporting}
              className="rounded-xl flex-1"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              ダウンロード
            </Button>
            <Button
              onClick={handleOpenInObsidian}
              disabled={isExporting || !vaultName.trim()}
              className="rounded-xl flex-1 bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              Obsidianで開く
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
