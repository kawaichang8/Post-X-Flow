"use client"

import { useEffect, useState, useMemo, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { GenerateForm } from "@/components/GenerateForm"
import { PostDraft as PostDraftComponent } from "@/components/PostDraft"
import { PostDraft } from "@/lib/ai-generator"
import { generatePostDrafts, approveAndPostTweet, approveAndPostTweetWithImage, savePostToHistory, scheduleTweet, getHighEngagementPosts, getPostHistory, getPostPerformanceStats, PostPerformanceStats, updateAllTweetEngagements, getScheduledTweets, updateScheduledTweet, deleteScheduledTweet, getQuotedTweets, saveQuotedTweet, deleteQuotedTweet, QuotedTweet, postQuotedTweet, getOptimalPostingTimes, OptimalPostingTime, getTwitterAccounts, getDefaultTwitterAccount, getTwitterAccountById, setDefaultTwitterAccount, deleteTwitterAccount, TwitterAccount, getImprovementSuggestions, ImprovementSuggestion, generateSyntaxFormat, updateDraft, deleteDraft, searchLocations } from "@/app/actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LogOut, History, TrendingUp, RefreshCw, Copy, Twitter, BarChart3, Calendar, FileText, Zap, Clock, Edit, Trash2, Settings, HelpCircle, Search, Filter, ArrowUpDown, List, CalendarDays, CheckSquare, Square, X, Plus, Bookmark, MessageSquare, Lightbulb, BookOpen, User, Code2, AlertTriangle, BarChart2, Layers, Image as ImageIcon, MapPin } from "lucide-react"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { CalendarWithSchedules } from "@/components/CalendarWithSchedules"
import { openTwitterCompose } from "@/lib/twitter-client"
import { useToast } from "@/components/ui/toast"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import { QuotedTweetsModal } from "@/components/QuotedTweetsModal"
import { QuotedTweetCompose } from "@/components/QuotedTweetCompose"
import { OptimalTimeSuggestions } from "@/components/OptimalTimeSuggestions"
import { ImageGenerator } from "@/components/ImageGenerator"
import { TweetPreview } from "@/components/TweetPreview"
import { cn } from "@/lib/utils"

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
  engagement_score: number
  impression_count: number | null
  reach_count: number | null
  engagement_rate: number | null
  like_count: number
  retweet_count: number
  reply_count: number
  quote_count: number
  created_at: string
}

interface User {
  id: string
  email?: string
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [drafts, setDrafts] = useState<PostDraft[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  const [currentTrend, setCurrentTrend] = useState("")
  const [currentPurpose, setCurrentPurpose] = useState("")
  const [twitterConnected, setTwitterConnected] = useState(false)
  const [twitterAccessToken, setTwitterAccessToken] = useState<string | null>(null)
  const [twitterAccounts, setTwitterAccounts] = useState<TwitterAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [highEngagementPosts, setHighEngagementPosts] = useState<PostHistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showScheduled, setShowScheduled] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showCreate, setShowCreate] = useState(true) // デフォルトでツイート作成画面を表示
  const [showDrafts, setShowDrafts] = useState(false)
  const [showQuotedTweets, setShowQuotedTweets] = useState(false)
  const [showTrends, setShowTrends] = useState(false)
  const [showAccounts, setShowAccounts] = useState(false)
  const [postHistory, setPostHistory] = useState<PostHistoryItem[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [performanceStats, setPerformanceStats] = useState<PostPerformanceStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [isUpdatingEngagement, setIsUpdatingEngagement] = useState(false)
  const [scheduledTweets, setScheduledTweets] = useState<PostHistoryItem[]>([])
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null)
  const [editScheduleDateTime, setEditScheduleDateTime] = useState("")
  const [historySearchQuery, setHistorySearchQuery] = useState("")
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("all")
  const [historySortBy, setHistorySortBy] = useState<string>("newest")
  const [scheduleSearchQuery, setScheduleSearchQuery] = useState("")
  const [scheduleDateFilter, setScheduleDateFilter] = useState<string>("all") // all, today, week, month
  const [selectedSchedules, setSelectedSchedules] = useState<Set<string>>(new Set())
  const [scheduleViewMode, setScheduleViewMode] = useState<"list" | "timeline" | "calendar">("calendar")
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(undefined)
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date())
  const [quotedTweets, setQuotedTweets] = useState<QuotedTweet[]>([])
  const [isLoadingQuotedTweets, setIsLoadingQuotedTweets] = useState(false)
  const [showQuotedTweetsModal, setShowQuotedTweetsModal] = useState(false)
  const [selectedQuotedTweet, setSelectedQuotedTweet] = useState<QuotedTweet | null>(null)
  const [optimalPostingTimes, setOptimalPostingTimes] = useState<OptimalPostingTime[]>([])
  const [isLoadingOptimalTimes, setIsLoadingOptimalTimes] = useState(false)
  const [selectedOptimalTime, setSelectedOptimalTime] = useState<Date | null>(null)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)
  const [draftImages, setDraftImages] = useState<Map<number, string | null>>(new Map())
  const [improvementSuggestions, setImprovementSuggestions] = useState<ImprovementSuggestion[]>([])
  const [isLoadingImprovements, setIsLoadingImprovements] = useState(false)
  const [manualTweetText, setManualTweetText] = useState("")
  const [manualTweetImage, setManualTweetImage] = useState<string | null>(null)
  const [manualTweetGif, setManualTweetGif] = useState<File | null>(null)
  const [isGeneratingSyntax, setIsGeneratingSyntax] = useState(false)
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)
  const [editingDraftText, setEditingDraftText] = useState("")
  const [showPoll, setShowPoll] = useState(false)
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""])
  const [pollDuration, setPollDuration] = useState<number>(1440) // 1 day default
  const [threadTweets, setThreadTweets] = useState<string[]>([""])
  const [showLocation, setShowLocation] = useState(false)
  const [locationQuery, setLocationQuery] = useState("")
  const [selectedLocation, setSelectedLocation] = useState<{ id: string; name: string; fullName: string } | null>(null)
  const [isSearchingLocation, setIsSearchingLocation] = useState(false)

  useEffect(() => {
    checkUser()
    checkTwitterConnection()
    loadHighEngagementPosts()
    loadPerformanceStats()
    
    // Check URL parameters for view
    const view = searchParams.get("view")
    // Reset all views
    setShowHistory(false)
    setShowScheduled(false)
    setShowAnalytics(false)
    setShowCreate(false)
    setShowDrafts(false)
    setShowQuotedTweets(false)
    setShowTrends(false)
    setShowAccounts(false)
    
    if (view === "create") {
      setShowCreate(true)
    } else if (view === "history") {
      setShowHistory(true)
    } else if (view === "scheduled") {
      setShowScheduled(true)
    } else if (view === "analytics") {
      setShowAnalytics(true)
    } else if (view === "drafts") {
      setShowDrafts(true)
    } else if (view === "quoted") {
      setShowQuotedTweets(true)
    } else if (view === "trends") {
      setShowTrends(true)
    } else if (view === "accounts") {
      setShowAccounts(true)
    } else {
      // デフォルトでツイート作成画面を表示
      setShowCreate(true)
    }
    
    // Check for URL parameters
    const error = searchParams.get("error")
    const details = searchParams.get("details")
    const twitterConnected = searchParams.get("twitter_connected")
    
    if (error) {
      let message = "エラーが発生しました。"
      if (error === "twitter_oauth_error") {
        message = `Twitter認証エラー: ${details || "認証に失敗しました"}`
      } else if (error === "no_code") {
        message = "認証コードが取得できませんでした。"
      } else if (error === "invalid_state") {
        message = "セキュリティ検証に失敗しました。もう一度お試しください。"
      } else if (error === "no_code_verifier") {
        message = "認証情報が見つかりませんでした。もう一度お試しください。"
      } else if (error === "no_user_id") {
        message = "ユーザー情報が見つかりませんでした。ログインし直してください。"
      } else if (error === "storage_failed") {
        message = `トークンの保存に失敗しました: ${details || "データベースエラー"}`
      } else if (error === "oauth_failed") {
        message = `OAuth認証に失敗しました: ${details || "不明なエラー"}`
      } else if (error === "oauth_init_failed") {
        message = `Twitter認証の開始に失敗しました: ${details || "不明なエラー"}`
      } else if (error === "session_not_found") {
        message = "認証セッションが見つかりませんでした。もう一度お試しください。"
      } else if (error === "session_storage_failed") {
        message = "認証セッションの保存に失敗しました。もう一度お試しください。"
      }
      setErrorMessage(message)
      showToast(message, "error")
      // Clear URL parameters
      router.replace("/dashboard")
    }
    
    if (twitterConnected === "true") {
      setSuccessMessage("Twitter連携が完了しました！")
      showToast("Twitter連携が完了しました！", "success")
      // Refresh connection status and reload data
      const refreshData = async () => {
        await checkTwitterConnection()
        await loadTwitterAccounts() // アカウント一覧を更新
        loadPerformanceStats()
        loadHighEngagementPosts()
        
        // アカウント管理画面を表示している場合は、そのまま表示
        if (showAccounts) {
          // アカウント管理画面を再読み込み
        }
      }
      refreshData()
      // Clear URL parameters
      router.replace("/dashboard")
    }
  }, [searchParams, router])

  useEffect(() => {
    if (showHistory && user) {
      loadPostHistory()
    }
  }, [showHistory, user])

  useEffect(() => {
    if (showAnalytics && user) {
      loadImprovementSuggestions()
    }
  }, [showAnalytics, user])

  const loadImprovementSuggestions = async () => {
    if (!user) return
    setIsLoadingImprovements(true)
    try {
      const suggestions = await getImprovementSuggestions(user.id, 5)
      setImprovementSuggestions(suggestions)
    } catch (error) {
      console.error("Error loading improvement suggestions:", error)
    } finally {
      setIsLoadingImprovements(false)
    }
  }

  useEffect(() => {
    if (showScheduled && user) {
      loadScheduledTweets()
    }
  }, [showScheduled, user])

  useEffect(() => {
    if (showCreate && user) {
      loadQuotedTweets()
      loadOptimalPostingTimes()
    }
  }, [showCreate, user])

  const loadOptimalPostingTimes = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session) {
      setIsLoadingOptimalTimes(true)
      try {
        const times = await getOptimalPostingTimes(session.user.id, 5)
        setOptimalPostingTimes(times)
      } catch (error) {
        console.error("Error loading optimal posting times:", error)
      } finally {
        setIsLoadingOptimalTimes(false)
      }
    }
  }

  const loadQuotedTweets = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session) {
      setIsLoadingQuotedTweets(true)
      try {
        const tweets = await getQuotedTweets(session.user.id)
        setQuotedTweets(tweets)
      } catch (error) {
        console.error("Error loading quoted tweets:", error)
      } finally {
        setIsLoadingQuotedTweets(false)
      }
    }
  }

  const handleUseQuotedTweet = (quotedTweet: QuotedTweet) => {
    setSelectedQuotedTweet(quotedTweet)
    setShowQuotedTweetsModal(false)
    // フローティングウィンドウで投稿画面を表示（QuotedTweetComposeコンポーネントで処理）
  }

  const handlePostQuotedTweet = async (text: string, quoteTweetId: string | null) => {
    if (!user || !twitterAccessToken) {
      showToast("Twitter連携が必要です", "warning")
      return
    }

    try {
      // Use Server Action to post quoted tweet
      const result = await postQuotedTweet(user.id, text, twitterAccessToken, quoteTweetId)

      if (!result.success) {
        throw new Error(result.error || "投稿に失敗しました")
      }

      // Update stats
      loadPerformanceStats()
      if (showHistory) {
        loadPostHistory()
      }

      setSelectedQuotedTweet(null)
      showToast("引用ツイートを投稿しました！", "success")
    } catch (error) {
      console.error("Error posting quoted tweet:", error)
      const errorMessage = error instanceof Error ? error.message : "投稿に失敗しました"
      showToast(errorMessage, "error")
      throw error
    }
  }

  const checkUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push("/")
      return
    }
    setUser(session.user)
  }

  const loadTwitterAccounts = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session) {
      try {
        const accounts = await getTwitterAccounts(session.user.id)
        setTwitterAccounts(accounts)
        
        if (accounts.length > 0) {
          setTwitterConnected(true)
          
          // Set selected account (use stored selection or default)
          const defaultAccount = accounts.find(acc => acc.is_default) || accounts[0]
          if (!selectedAccountId || !accounts.find(acc => acc.id === selectedAccountId)) {
            setSelectedAccountId(defaultAccount.id)
            setTwitterAccessToken(defaultAccount.access_token || null)
          } else {
            // Use selected account's token
            const selectedAccount = accounts.find(acc => acc.id === selectedAccountId)
            if (selectedAccount) {
              setTwitterAccessToken(selectedAccount.access_token || null)
            }
          }
        } else {
          setTwitterConnected(false)
          setTwitterAccessToken(null)
          setSelectedAccountId(null)
        }
      } catch (error) {
        console.error("Error loading Twitter accounts:", error)
        setTwitterConnected(false)
        setTwitterAccessToken(null)
      }
    }
  }

  const checkTwitterConnection = async () => {
    await loadTwitterAccounts()
  }

  const handleSelectAccount = async (accountId: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) return

    try {
      const account = await getTwitterAccountById(accountId, session.user.id)
      if (account) {
        setSelectedAccountId(accountId)
        setTwitterAccessToken(account.access_token || null)
        
        // Optionally set as default
        await setDefaultTwitterAccount(accountId, session.user.id)
        await loadTwitterAccounts() // Refresh to update is_default flags
      }
    } catch (error) {
      console.error("Error selecting account:", error)
      showToast("アカウントの選択に失敗しました", "error")
    }
  }

  const loadHighEngagementPosts = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session) {
      const posts = await getHighEngagementPosts(session.user.id)
      setHighEngagementPosts(posts)
    }
  }

  const loadPostHistory = async () => {
    if (!user) return
    setIsLoadingHistory(true)
    try {
      const history = await getPostHistory(user.id, 50)
      setPostHistory(history as PostHistoryItem[])
    } catch (error) {
      console.error("Error loading post history:", error)
      const errorMessage = error instanceof Error ? error.message : "履歴の読み込みに失敗しました"
      showToast(errorMessage, "error")
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const loadPerformanceStats = async () => {
    if (!user) return
    setIsLoadingStats(true)
    try {
      const stats = await getPostPerformanceStats(user.id)
      setPerformanceStats(stats)
    } catch (error) {
      console.error("Error loading performance stats:", error)
      const errorMessage = error instanceof Error ? error.message : "統計情報の読み込みに失敗しました"
      showToast(errorMessage, "error")
    } finally {
      setIsLoadingStats(false)
    }
  }

  const handleUpdateEngagements = async () => {
    if (!user || !twitterAccessToken) {
      showToast("Twitter連携が必要です", "warning")
      return
    }

    setIsUpdatingEngagement(true)
    try {
      const result = await updateAllTweetEngagements(user.id, twitterAccessToken)
      if (result.updated > 0) {
        showToast(`エンゲージメントを更新しました（更新: ${result.updated}件、失敗: ${result.failed}件）`, "success")
      } else {
        showToast("更新できるエンゲージメントがありませんでした", "info")
      }
      loadPerformanceStats()
      loadHighEngagementPosts()
      if (showHistory) {
        loadPostHistory()
      }
    } catch (error) {
      console.error("Error updating engagements:", error)
      const errorMessage = error instanceof Error ? error.message : "エンゲージメントの更新に失敗しました"
      showToast(errorMessage, "error")
    } finally {
      setIsUpdatingEngagement(false)
    }
  }

  const loadScheduledTweets = async () => {
    if (!user) return
    setIsLoadingScheduled(true)
    try {
      const scheduled = await getScheduledTweets(user.id)
      setScheduledTweets(scheduled as PostHistoryItem[])
    } catch (error) {
      console.error("Error loading scheduled tweets:", error)
      const errorMessage = error instanceof Error ? error.message : "スケジュールの読み込みに失敗しました"
      showToast(errorMessage, "error")
    } finally {
      setIsLoadingScheduled(false)
    }
  }

  const handleEditSchedule = (post: PostHistoryItem) => {
    if (!post.scheduled_for) return
    setEditingSchedule(post.id)
    setEditScheduleDateTime(new Date(post.scheduled_for).toISOString().slice(0, 16))
  }

  const handleSaveSchedule = async (postId: string) => {
    if (!editScheduleDateTime) {
      showToast("スケジュール日時を入力してください", "warning")
      return
    }

    const scheduleDate = new Date(editScheduleDateTime)
    if (isNaN(scheduleDate.getTime()) || scheduleDate < new Date()) {
      showToast("有効な未来の日時を入力してください", "error")
      return
    }

    try {
      await updateScheduledTweet(postId, scheduleDate)
      showToast("スケジュールを更新しました", "success")
      setEditingSchedule(null)
      setEditScheduleDateTime("")
      loadScheduledTweets()
      loadPerformanceStats()
    } catch (error) {
      console.error("Error updating schedule:", error)
      showToast("スケジュールの更新に失敗しました", "error")
    }
  }

  const handleDeleteSchedule = async (postId: string) => {
    const confirmed = window.confirm("このスケジュールを削除しますか？")
    if (!confirmed) return

    try {
      await deleteScheduledTweet(postId)
      showToast("スケジュールを削除しました", "success")
      loadScheduledTweets()
      loadPerformanceStats()
      setSelectedSchedules(new Set())
    } catch (error) {
      console.error("Error deleting schedule:", error)
      showToast("スケジュールの削除に失敗しました", "error")
    }
  }

  const handleBulkDelete = async () => {
    if (selectedSchedules.size === 0) {
      showToast("削除するスケジュールを選択してください", "warning")
      return
    }

    const confirmed = window.confirm(
      `${selectedSchedules.size}件のスケジュールを削除しますか？`
    )
    if (!confirmed) return

    try {
      const deletePromises = Array.from(selectedSchedules).map(id => deleteScheduledTweet(id))
      await Promise.all(deletePromises)
      showToast(`${selectedSchedules.size}件のスケジュールを削除しました`, "success")
      loadScheduledTweets()
      loadPerformanceStats()
      setSelectedSchedules(new Set())
    } catch (error) {
      console.error("Error bulk deleting schedules:", error)
      showToast("スケジュールの削除に失敗しました", "error")
    }
  }

  const handleToggleSelect = (postId: string) => {
    const newSelected = new Set(selectedSchedules)
    if (newSelected.has(postId)) {
      newSelected.delete(postId)
    } else {
      newSelected.add(postId)
    }
    setSelectedSchedules(newSelected)
  }

  const handleSelectAll = (filteredSchedules?: PostHistoryItem[]) => {
    const schedulesToSelect = filteredSchedules || scheduledTweets
    const allSelected = schedulesToSelect.every(p => selectedSchedules.has(p.id))
    
    if (allSelected) {
      // Deselect all filtered schedules
      const newSelected = new Set(selectedSchedules)
      schedulesToSelect.forEach(p => newSelected.delete(p.id))
      setSelectedSchedules(newSelected)
    } else {
      // Select all filtered schedules
      const newSelected = new Set(selectedSchedules)
      schedulesToSelect.forEach(p => newSelected.add(p.id))
      setSelectedSchedules(newSelected)
    }
  }

  const handleGenerate = async (trend: string, purpose: string): Promise<PostDraft[]> => {
    setIsLoading(true)
    setCurrentTrend(trend)
    setCurrentPurpose(purpose)
    try {
      const generatedDrafts = await generatePostDrafts(trend, purpose)
      setDrafts(generatedDrafts)

      // Save drafts to history
      if (user) {
        for (const draft of generatedDrafts) {
          await savePostToHistory(user.id, draft, trend, purpose, 'draft')
        }
      }
      return generatedDrafts
    } catch (error) {
      console.error("Error generating drafts:", error)
      const errorMessage = error instanceof Error ? error.message : "ツイートの生成に失敗しました"
      showToast(errorMessage, "error")
      return []
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprove = async (draft: PostDraft, scheduleFor?: Date) => {
    if (!user) return

    if (scheduleFor) {
      // Schedule tweet
      try {
        await scheduleTweet(user.id, draft, scheduleFor, currentTrend, currentPurpose)
        showToast(`ツイートを ${scheduleFor.toLocaleString('ja-JP')} にスケジュールしました！`, "success")
        setDrafts([])
        loadPerformanceStats()
        if (showScheduled) {
          loadScheduledTweets()
        }
        if (showHistory) {
          loadPostHistory()
        }
      } catch (error) {
        console.error("Error scheduling tweet:", error)
        const errorMessage = error instanceof Error ? error.message : "スケジュールの設定に失敗しました"
        showToast(errorMessage, "error")
      }
      return
    }

    if (!twitterConnected || !twitterAccessToken) {
      // Fallback: Open Twitter compose window
      openTwitterCompose(draft.text)
      return
    }

    setIsPosting(true)
    try {
      // Get image URL for this draft if available
      const draftIndex = drafts.findIndex(d => d.text === draft.text)
      const imageUrl = draftIndex >= 0 ? draftImages.get(draftIndex) || null : null

      let result
      if (imageUrl) {
        // Post with image
        result = await approveAndPostTweetWithImage(
          user.id,
          draft,
          twitterAccessToken,
          currentTrend,
          currentPurpose,
          imageUrl
        )
      } else {
        // Post without image
        result = await approveAndPostTweet(
          user.id,
          draft,
          twitterAccessToken,
          currentTrend,
          currentPurpose
        )
      }
      
      if (result.success) {
        showToast("ツイートを投稿しました！", "success")
        setDrafts([])
        setDraftImages(new Map())
        setSelectedImageUrl(null)
        loadHighEngagementPosts()
        loadPerformanceStats()
        if (showHistory) {
          loadPostHistory()
        }
      } else {
        // Show specific error message
        const errorMessage = result.error || "ツイートの投稿に失敗しました"
        showToast(errorMessage, "error")
        
        // If it's an authentication error, suggest reconnecting
        if (errorMessage.includes("認証") || errorMessage.includes("401")) {
          showToast("Twitter連携を再度行ってください", "warning")
        } else {
          // Fallback: Open Twitter compose window for other errors
          showToast("Twitter compose windowを開きます", "info")
          openTwitterCompose(draft.text)
        }
      }
    } catch (error) {
      console.error("Error posting tweet:", error)
      const errorMessage = error instanceof Error ? error.message : "ツイートの投稿に失敗しました"
      showToast(`${errorMessage}。Twitter compose windowを開きます。`, "warning")
      openTwitterCompose(draft.text)
    } finally {
      setIsPosting(false)
    }
  }

  const handleSchedule = async (draft: PostDraft, scheduleFor: Date) => {
    if (!user) return
    await handleApprove(draft, scheduleFor)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const handleConnectTwitter = async () => {
    try {
      // Ensure we have a user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        showToast("ログインが必要です", "warning")
        router.push("/auth/login")
        return
      }

      const userId = user?.id || session.user.id
      if (!userId) {
        showToast("ユーザー情報の取得に失敗しました", "error")
        return
      }

      // Redirect to Twitter OAuth
      window.location.href = `/api/auth/twitter?userId=${userId}`
    } catch (error) {
      console.error("Error connecting to Twitter:", error)
      const errorMessage = error instanceof Error ? error.message : "Twitter連携の開始に失敗しました"
      showToast(errorMessage, "error")
    }
  }

  const handleRepost = (post: PostHistoryItem) => {
    const confirmed = window.confirm(
      "このツイートを再投稿しますか？\n\n" +
      "内容:\n" + post.text.substring(0, 100) + "..."
    )
    if (confirmed) {
      if (twitterConnected && twitterAccessToken && user) {
        // Try to post directly
        approveAndPostTweet(
          user.id,
          {
            text: post.text,
            naturalnessScore: post.naturalness_score || 0,
            hashtags: post.hashtags || []
          },
          twitterAccessToken,
          post.trend || "",
          post.purpose || ""
        ).then(() => {
          showToast("ツイートを再投稿しました！", "success")
          loadPostHistory()
          loadHighEngagementPosts()
          loadPerformanceStats()
        }).catch((error) => {
          console.error("Error reposting:", error)
          showToast("再投稿に失敗しました。Twitter compose windowを開きます。", "warning")
          openTwitterCompose(post.text)
        })
      } else {
        openTwitterCompose(post.text)
      }
    }
  }

  const handleCopyFromHistory = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast("コピーしました！", "success")
    } catch (error) {
      console.error("Error copying text:", error)
      showToast("コピーに失敗しました", "error")
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return '下書き'
      case 'posted': return '投稿済み'
      case 'scheduled': return 'スケジュール済み'
      case 'deleted': return '削除済み'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      case 'posted': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'scheduled': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'deleted': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleNavigation = (path: string) => {
    // Reset all views
    setShowHistory(false)
    setShowScheduled(false)
    setShowAnalytics(false)
    setShowCreate(false)
    setShowDrafts(false)
    setShowQuotedTweets(false)
    setShowTrends(false)
    setShowAccounts(false)
    
    if (path === "create") {
      setShowCreate(true)
      router.replace("/dashboard?view=create")
    } else if (path === "history") {
      setShowHistory(true)
      router.replace("/dashboard?view=history")
    } else if (path === "scheduled") {
      setShowScheduled(true)
      router.replace("/dashboard?view=scheduled")
    } else if (path === "analytics") {
      setShowAnalytics(true)
      router.replace("/dashboard?view=analytics")
    } else if (path === "drafts") {
      setShowDrafts(true)
      router.replace("/dashboard?view=drafts")
    } else if (path === "quoted") {
      setShowQuotedTweets(true)
      router.replace("/dashboard?view=quoted")
    } else if (path === "trends") {
      setShowTrends(true)
      router.replace("/dashboard?view=trends")
    } else if (path === "accounts") {
      setShowAccounts(true)
      router.replace("/dashboard?view=accounts")
    } else {
      // デフォルトでツイート作成画面に遷移
      setShowCreate(true)
      router.replace("/dashboard?view=create")
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black flex">
      {/* Sidebar */}
      <DashboardSidebar
        user={user}
                twitterConnected={twitterConnected}
                twitterAccounts={twitterAccounts}
                selectedAccountId={selectedAccountId}
                onSelectAccount={handleSelectAccount}
        onConnectTwitter={handleConnectTwitter}
        onLogout={handleLogout}
        showHistory={showHistory}
        showScheduled={showScheduled}
        showAnalytics={showAnalytics}
        showCreate={showCreate}
        showDrafts={showDrafts}
        showQuotedTweets={showQuotedTweets}
        showTrends={showTrends}
        showAccounts={showAccounts}
        onNavigate={handleNavigation}
      />

      {/* Main Content */}
      <main className="flex-1 lg:ml-56 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">

          {/* Error/Success Messages */}
          {errorMessage && (
            <Card className="border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 rounded-2xl">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-red-800 dark:text-red-200">{errorMessage}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setErrorMessage(null)}
                  >
                    閉じる
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {successMessage && (
            <Card className="border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 rounded-2xl">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSuccessMessage(null)}
                  >
                    閉じる
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Create View - Tweet Generation Only */}
          {showCreate && (
            <div className="space-y-6">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-500/5 dark:via-purple-500/5 dark:to-pink-500/5 rounded-2xl blur-2xl"></div>
                <div className="relative">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent mb-2">
                    ツイート作成
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    ✨ トレンドと目的を入力して、AIがインプレッション最大化フォーマットでツイートを生成します
                  </p>
                </div>
              </div>

              {/* Quoted Tweets Button - Enhanced */}
              <Card className="group relative border-2 border-purple-200/50 dark:border-purple-800/50 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-2xl hover:shadow-xl hover:shadow-purple-500/20 transition-all duration-300 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 to-pink-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardContent className="pt-6 relative">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">引用リツイート機能</span>
                    </div>
                    <p className="text-xs text-purple-600/70 dark:text-purple-400/70 mb-3 leading-relaxed">
                      💡 <strong>引用リツイートとは？</strong><br />
                      他の人のツイートを引用しながら、自分のコメントを添えて投稿できます。よく使う引用元ツイートを登録しておくと便利です。
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setShowQuotedTweetsModal(true)}
                      className="w-full rounded-full border-purple-300 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:border-purple-400 dark:hover:border-purple-600 transition-all"
                    >
                      <FileText className="mr-2 h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-purple-700 dark:text-purple-300 font-medium">引用ツイートを選択</span>
                      {quotedTweets.length > 0 && (
                        <span className="ml-2 px-2.5 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-xs font-semibold shadow-lg">
                          {quotedTweets.length}
                        </span>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Optimal Posting Time Suggestions */}
              <OptimalTimeSuggestions
                optimalTimes={optimalPostingTimes}
                isLoading={isLoadingOptimalTimes}
                onSelectTime={(date) => {
                  setSelectedOptimalTime(date)
                  showToast(`${date.toLocaleString('ja-JP')} に設定しました。スケジュールボタンで確定してください。`, "info")
                }}
              />

              <GenerateForm 
                onGenerate={handleGenerate} 
                isLoading={isLoading}
                twitterAccessToken={twitterAccessToken}
                userId={user?.id || null}
              />

              {/* Manual Tweet Creation with Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input Section */}
                <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl">
                  <CardHeader className="border-b border-gray-200 dark:border-gray-800">
                    <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">
                      手動でツイート作成
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                      直接テキストを入力して、リアルタイムでプレビューを確認できます
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          ツイート内容
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            if (!manualTweetText.trim()) {
                              showToast("テキストを入力してから構文を生成してください", "warning")
                              return
                            }
                            setIsGeneratingSyntax(true)
                            try {
                              const format = await generateSyntaxFormat(manualTweetText, currentPurpose || undefined)
                              if (format) {
                                setManualTweetText(format.formattedText)
                                showToast("構文フォーマットを適用しました", "success")
                              } else {
                                showToast("構文の生成に失敗しました", "error")
                              }
                            } catch (error) {
                              console.error("Error generating syntax:", error)
                              showToast("構文の生成に失敗しました", "error")
                            } finally {
                              setIsGeneratingSyntax(false)
                            }
                          }}
                          disabled={isGeneratingSyntax || !manualTweetText.trim()}
                          className="rounded-full text-xs"
                        >
                          <Code2 className={cn("mr-1.5 h-3.5 w-3.5", isGeneratingSyntax && "animate-spin")} />
                          構文
                        </Button>
                      </div>
                      <textarea
                        value={manualTweetText}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value.length <= 280) {
                            setManualTweetText(value)
                          }
                        }}
                        placeholder="今何してる？"
                        className={cn(
                          "w-full min-h-[200px] px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-xl",
                          "text-base bg-white dark:bg-black text-gray-900 dark:text-white",
                          "resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                          "placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        )}
                        style={{ fontSize: '20px', lineHeight: '1.5' }}
                      />
                      <div className="space-y-1">
                        {/* 140文字警告 */}
                        {manualTweetText.length > 140 && (
                          <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                              ※140文字を超えています。タイムラインでは全文が表示されない場合があります。
                            </p>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">
                            {280 - manualTweetText.length}文字残り
                          </span>
                          <span className={cn(
                            "font-medium",
                            (280 - manualTweetText.length) < 20 && (280 - manualTweetText.length) >= 0 && "text-orange-500",
                            (280 - manualTweetText.length) < 0 && "text-red-500"
                          )}>
                            {manualTweetText.length}/280
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Image/GIF Upload Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          画像・GIF（オプション）
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                if (file.type === 'image/gif') {
                                  setManualTweetGif(file)
                                  setManualTweetImage(null)
                                } else {
                                  const reader = new FileReader()
                                  reader.onloadend = () => {
                                    setManualTweetImage(reader.result as string)
                                    setManualTweetGif(null)
                                  }
                                  reader.readAsDataURL(file)
                                }
                              }
                            }}
                            className="hidden"
                            id="manual-tweet-image"
                          />
                          <label
                            htmlFor="manual-tweet-image"
                            className="cursor-pointer"
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-full text-xs"
                            >
                              <ImageIcon className="mr-1 h-3.5 w-3.5" />
                              画像/GIF
                            </Button>
                          </label>
                        </div>
                      </div>
                      {manualTweetImage && (
                        <div className="relative">
                          <img
                            src={manualTweetImage}
                            alt="Tweet media"
                            className="w-full h-48 object-cover rounded-xl border border-gray-200 dark:border-gray-800"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setManualTweetImage(null)
                              setManualTweetGif(null)
                            }}
                            className="absolute top-2 right-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {manualTweetGif && (
                        <div className="relative">
                          <img
                            src={URL.createObjectURL(manualTweetGif)}
                            alt="Tweet GIF"
                            className="w-full h-48 object-cover rounded-xl border border-gray-200 dark:border-gray-800"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setManualTweetGif(null)
                              setManualTweetImage(null)
                            }}
                            className="absolute top-2 right-2 rounded-full bg-black/50 hover:bg-black/70 text-white"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 rounded text-xs text-white">
                            GIF
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Location Section */}
                    {showLocation && (
                      <div className="space-y-2 p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            位置情報
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowLocation(false)
                              setSelectedLocation(null)
                              setLocationQuery("")
                            }}
                            className="rounded-full h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        {selectedLocation ? (
                          <div className="p-3 bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {selectedLocation.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {selectedLocation.fullName}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedLocation(null)
                                  setLocationQuery("")
                                }}
                                className="rounded-full"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <Input
                                value={locationQuery}
                                onChange={(e) => setLocationQuery(e.target.value)}
                                placeholder="場所を検索（例: 東京、Tokyo）"
                                className="flex-1 text-sm"
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter' && locationQuery.trim() && twitterAccessToken) {
                                    setIsSearchingLocation(true)
                                    try {
                                      const places = await searchLocations(locationQuery.trim(), twitterAccessToken)
                                      if (places.length > 0) {
                                        setSelectedLocation(places[0])
                                        showToast("位置情報を選択しました", "success")
                                      } else {
                                        showToast("位置情報が見つかりませんでした", "warning")
                                      }
                                    } catch (error) {
                                      showToast("位置情報の検索に失敗しました", "error")
                                    } finally {
                                      setIsSearchingLocation(false)
                                    }
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  if (!locationQuery.trim() || !twitterAccessToken) return
                                  setIsSearchingLocation(true)
                                  try {
                                    const places = await searchLocations(locationQuery.trim(), twitterAccessToken)
                                    if (places.length > 0) {
                                      setSelectedLocation(places[0])
                                      showToast("位置情報を選択しました", "success")
                                    } else {
                                      showToast("位置情報が見つかりませんでした", "warning")
                                    }
                                  } catch (error) {
                                    showToast("位置情報の検索に失敗しました", "error")
                                  } finally {
                                    setIsSearchingLocation(false)
                                  }
                                }}
                                disabled={isSearchingLocation || !locationQuery.trim()}
                                className="rounded-full"
                              >
                                {isSearchingLocation ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Search className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              場所名を入力してEnterキーを押すか、検索ボタンをクリックしてください
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Poll Section */}
                    {showPoll && (
                      <div className="space-y-2 p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <BarChart2 className="h-4 w-4" />
                            アンケート
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowPoll(false)
                              setPollOptions(["", ""])
                            }}
                            className="rounded-full h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {pollOptions.map((option, idx) => (
                            <div key={idx} className="flex gap-2">
                              <Input
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...pollOptions]
                                  newOptions[idx] = e.target.value
                                  setPollOptions(newOptions)
                                }}
                                placeholder={`選択肢 ${idx + 1}`}
                                maxLength={25}
                                className="text-sm"
                              />
                              {pollOptions.length > 2 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setPollOptions(pollOptions.filter((_, i) => i !== idx))
                                  }}
                                  className="rounded-full h-8 w-8 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                          {pollOptions.length < 4 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPollOptions([...pollOptions, ""])
                              }}
                              className="w-full rounded-full text-xs"
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              選択肢を追加
                            </Button>
                          )}
                        </div>
                        <Select value={pollDuration.toString()} onValueChange={(v) => setPollDuration(Number(v))}>
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">5分</SelectItem>
                            <SelectItem value="15">15分</SelectItem>
                            <SelectItem value="30">30分</SelectItem>
                            <SelectItem value="60">1時間</SelectItem>
                            <SelectItem value="1440">1日</SelectItem>
                            <SelectItem value="10080">7日</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Thread Section */}
                    {threadTweets.length > 1 && (
                      <div className="space-y-2 p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Layers className="h-4 w-4" />
                            スレッド ({threadTweets.length}件)
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setThreadTweets([""])
                            }}
                            className="rounded-full h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {threadTweets.map((tweet, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold">
                                  {idx + 1}
                                </span>
                                <span>{tweet.length}/280文字</span>
                              </div>
                              <textarea
                                value={tweet}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (value.length <= 280) {
                                    const newTweets = [...threadTweets]
                                    newTweets[idx] = value
                                    setThreadTweets(newTweets)
                                  }
                                }}
                                placeholder={`ツイート ${idx + 1}...`}
                                className={cn(
                                  "w-full min-h-[80px] px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg",
                                  "text-sm bg-white dark:bg-black text-gray-900 dark:text-white",
                                  "resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                )}
                              />
                            </div>
                          ))}
                          {threadTweets.length < 25 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setThreadTweets([...threadTweets, ""])
                              }}
                              className="w-full rounded-full text-xs"
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              ツイートを追加
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPoll(!showPoll)}
                        className="rounded-full text-xs"
                      >
                        <BarChart2 className="mr-1 h-3.5 w-3.5" />
                        アンケート
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (threadTweets.length === 1 && !threadTweets[0]) {
                            setThreadTweets(["", ""])
                          } else {
                            setThreadTweets([...threadTweets, ""])
                          }
                        }}
                        className="rounded-full text-xs"
                      >
                        <Layers className="mr-1 h-3.5 w-3.5" />
                        スレッド
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowLocation(!showLocation)}
                        className="rounded-full text-xs"
                      >
                        <MapPin className="mr-1 h-3.5 w-3.5" />
                        位置情報
                      </Button>
                      <Button
                        onClick={async () => {
                          if (!manualTweetText.trim()) {
                            showToast("ツイート内容を入力してください", "warning")
                            return
                          }
                          if (!user) return
                          
                          setIsPosting(true)
                          try {
                            const draft: PostDraft = {
                              text: manualTweetText.trim(),
                              naturalnessScore: 100,
                              hashtags: []
                            }
                            
                            if (manualTweetImage) {
                              await approveAndPostTweetWithImage(
                                user.id,
                                draft,
                                manualTweetImage,
                                currentTrend || "",
                                currentPurpose || ""
                              )
                            } else {
                              if (!twitterAccessToken) {
                                showToast("Twitter連携が必要です", "warning")
                                return
                              }
                              await approveAndPostTweet(
                                user.id,
                                draft,
                                twitterAccessToken,
                                currentTrend || "",
                                currentPurpose || ""
                              )
                            }
                            
                            showToast("ツイートを投稿しました！", "success")
                            setManualTweetText("")
                            setManualTweetImage(null)
                            loadPerformanceStats()
                          } catch (error) {
                            console.error("Error posting tweet:", error)
                            const errorMessage = error instanceof Error ? error.message : "投稿に失敗しました"
                            showToast(errorMessage, "error")
                          } finally {
                            setIsPosting(false)
                          }
                        }}
                        disabled={!manualTweetText.trim() || isPosting}
                        className="flex-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white"
                      >
                        {isPosting ? "投稿中..." : "投稿する"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setManualTweetText("")
                          setManualTweetImage(null)
                        }}
                        disabled={isPosting}
                        className="rounded-full"
                      >
                        クリア
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Preview Section */}
                <div className="sticky top-6 h-fit">
                  <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl">
                    <CardHeader className="border-b border-gray-200 dark:border-gray-800">
                      <CardTitle className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Twitter className="h-5 w-5 text-blue-500" />
                        プレビュー
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                        実際のTwitterでの表示を確認できます
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <TweetPreview
                        text={manualTweetText}
                        imageUrl={manualTweetImage}
                        quotedTweet={selectedQuotedTweet ? {
                          author_name: selectedQuotedTweet.author_name || undefined,
                          author_handle: selectedQuotedTweet.author_handle || undefined,
                          author_avatar_url: selectedQuotedTweet.author_avatar_url || undefined,
                          tweet_text: selectedQuotedTweet.tweet_text,
                          media_url: selectedQuotedTweet.media_url || undefined
                        } : null}
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Generated Drafts - Enhanced */}
              {drafts.length > 0 && (
                <div className="space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-teal-500/10 dark:from-blue-500/5 dark:via-cyan-500/5 dark:to-teal-500/5 rounded-xl blur-xl"></div>
                    <div className="relative">
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 dark:from-blue-400 dark:via-cyan-400 dark:to-teal-400 bg-clip-text text-transparent mb-1">
                        生成されたドラフト
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {drafts.length}件のドラフトが生成されました。最適なものを選択してください。
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {drafts.map((draft, index) => (
                      <div key={index} className="space-y-4 group">
                        <div className="relative">
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl opacity-0 group-hover:opacity-20 blur transition-opacity duration-300"></div>
                          <div className="relative">
                            <PostDraftComponent
                              draft={draft}
                              index={index}
                              onApprove={handleApprove}
                              onSchedule={handleSchedule}
                              isPosting={isPosting}
                              suggestedTime={selectedOptimalTime}
                            />
                          </div>
                        </div>
                        
                        {/* Image Generator for each draft */}
                        <div className="relative">
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 rounded-xl opacity-0 group-hover:opacity-20 blur transition-opacity duration-300"></div>
                          <div className="relative">
                            <ImageGenerator
                              tweetText={draft.text}
                              trend={currentTrend}
                              purpose={currentPurpose}
                              onImageSelect={(imageUrl) => {
                                const newMap = new Map(draftImages)
                                newMap.set(index, imageUrl)
                                setDraftImages(newMap)
                              }}
                              selectedImageUrl={draftImages.get(index) || null}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}


          {/* Analytics View - Enhanced */}
          {showAnalytics && performanceStats && (
            <Card className="group relative border-2 border-indigo-200/50 dark:border-indigo-800/50 bg-gradient-to-br from-white via-indigo-50/30 to-blue-50/30 dark:from-black dark:via-indigo-950/20 dark:to-blue-950/20 rounded-2xl hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-400/10 to-blue-400/10 rounded-full blur-3xl"></div>
              <CardHeader className="relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 dark:from-indigo-400/30 dark:to-blue-400/30 rounded-xl border border-indigo-300/50 dark:border-indigo-700/50">
                      <BarChart3 className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2 text-xl bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-400 dark:to-blue-400 bg-clip-text text-transparent">
                        投稿パフォーマンス分析
                      </CardTitle>
                      <CardDescription className="text-indigo-600/70 dark:text-indigo-400/70 mt-1">
                        📊 投稿統計とパフォーマンス分析
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {twitterConnected && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUpdateEngagements}
                        disabled={isUpdatingEngagement}
                        title="Twitter APIから最新のエンゲージメント（いいね、リツイート、返信数）を取得して更新します"
                        className="rounded-full border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isUpdatingEngagement ? 'animate-spin' : ''}`} />
                        エンゲージメント更新
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadPerformanceStats}
                      disabled={isLoadingStats}
                      className="rounded-full border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingStats ? 'animate-spin' : ''}`} />
                      更新
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingStats ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="p-4 border rounded-lg space-y-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-8 w-16" />
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Stats Grid - Enhanced with Gradients & Animations */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="group relative p-5 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/50 rounded-2xl hover:shadow-xl hover:shadow-blue-500/20 hover:scale-105 transition-all duration-300 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative flex items-center gap-2 mb-3">
                          <div className="p-2 bg-blue-500/20 dark:bg-blue-400/20 rounded-lg">
                            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">総投稿数</span>
                        </div>
                        <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">{performanceStats.totalPosts}</p>
                      </div>
                      <div className="group relative p-5 bg-gradient-to-br from-cyan-50 to-teal-100 dark:from-cyan-950/30 dark:to-teal-950/30 border border-cyan-200/50 dark:border-cyan-800/50 rounded-2xl hover:shadow-xl hover:shadow-cyan-500/20 hover:scale-105 transition-all duration-300 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative flex items-center gap-2 mb-3">
                          <div className="p-2 bg-cyan-500/20 dark:bg-cyan-400/20 rounded-lg">
                            <Twitter className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                          </div>
                          <span className="text-xs font-medium text-cyan-700 dark:text-cyan-300">投稿済み</span>
                        </div>
                        <p className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-teal-600 dark:from-cyan-400 dark:to-teal-400 bg-clip-text text-transparent">{performanceStats.postedCount}</p>
                      </div>
                      <div className="group relative p-5 bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200/50 dark:border-purple-800/50 rounded-2xl hover:shadow-xl hover:shadow-purple-500/20 hover:scale-105 transition-all duration-300 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative flex items-center gap-2 mb-3">
                          <div className="p-2 bg-purple-500/20 dark:bg-purple-400/20 rounded-lg">
                            <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <span className="text-xs font-medium text-purple-700 dark:text-purple-300">下書き</span>
                        </div>
                        <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">{performanceStats.draftCount}</p>
                      </div>
                      <div className="group relative p-5 bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200/50 dark:border-orange-800/50 rounded-2xl hover:shadow-xl hover:shadow-orange-500/20 hover:scale-105 transition-all duration-300 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative flex items-center gap-2 mb-3">
                          <div className="p-2 bg-orange-500/20 dark:bg-orange-400/20 rounded-lg">
                            <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                          </div>
                          <span className="text-xs font-medium text-orange-700 dark:text-orange-300">スケジュール</span>
                        </div>
                        <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 dark:from-orange-400 dark:to-amber-400 bg-clip-text text-transparent">{performanceStats.scheduledCount}</p>
                      </div>
                    </div>

                    {/* Engagement Stats - Enhanced */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="group relative p-5 bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-950/30 dark:to-green-950/30 border border-emerald-200/50 dark:border-emerald-800/50 rounded-2xl hover:shadow-xl hover:shadow-emerald-500/20 hover:scale-105 transition-all duration-300 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative flex items-center gap-2 mb-3">
                          <div className="p-2 bg-emerald-500/20 dark:bg-emerald-400/20 rounded-lg animate-pulse">
                            <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">平均エンゲージメント</span>
                        </div>
                        <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 dark:from-emerald-400 dark:to-green-400 bg-clip-text text-transparent">{performanceStats.averageEngagement}</p>
                      </div>
                      <div className="group relative p-5 bg-gradient-to-br from-rose-50 to-red-100 dark:from-rose-950/30 dark:to-red-950/30 border border-rose-200/50 dark:border-rose-800/50 rounded-2xl hover:shadow-xl hover:shadow-rose-500/20 hover:scale-105 transition-all duration-300 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-rose-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative flex items-center gap-2 mb-3">
                          <div className="p-2 bg-rose-500/20 dark:bg-rose-400/20 rounded-lg">
                            <TrendingUp className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                          </div>
                          <span className="text-xs font-medium text-rose-700 dark:text-rose-300">最高エンゲージメント</span>
                        </div>
                        <p className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-red-600 dark:from-rose-400 dark:to-red-400 bg-clip-text text-transparent">{performanceStats.highestEngagement}</p>
                      </div>
                      <div className="group relative p-5 bg-gradient-to-br from-violet-50 to-fuchsia-100 dark:from-violet-950/30 dark:to-fuchsia-950/30 border border-violet-200/50 dark:border-violet-800/50 rounded-2xl hover:shadow-xl hover:shadow-violet-500/20 hover:scale-105 transition-all duration-300 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="relative flex items-center gap-2 mb-3">
                          <div className="p-2 bg-violet-500/20 dark:bg-violet-400/20 rounded-lg">
                            <Calendar className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                          </div>
                          <span className="text-xs font-medium text-violet-700 dark:text-violet-300">週間投稿数</span>
                        </div>
                        <p className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 dark:from-violet-400 dark:to-fuchsia-400 bg-clip-text text-transparent">{performanceStats.weeklyPosts}</p>
                        <p className="text-xs text-violet-600/70 dark:text-violet-400/70 mt-2 font-medium">月間: {performanceStats.monthlyPosts}</p>
                      </div>
                    </div>

                    {/* Top Post - Enhanced */}
                    {performanceStats.topPost && (
                      <div className="group relative p-6 bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-950/20 dark:via-amber-950/20 dark:to-orange-950/20 border-2 border-amber-200/50 dark:border-amber-800/50 rounded-2xl hover:shadow-2xl hover:shadow-amber-500/30 hover:scale-[1.02] transition-all duration-300 overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/20 to-yellow-400/20 rounded-full blur-3xl"></div>
                        <div className="relative">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-amber-500/20 dark:bg-amber-400/20 rounded-lg">
                                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                              </div>
                              <span className="text-sm font-bold bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">最高パフォーマンス投稿</span>
                            </div>
                            <div className="px-3 py-1 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 dark:from-amber-500/30 dark:to-yellow-500/30 rounded-full border border-amber-300/50 dark:border-amber-700/50">
                              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                ⚡ {performanceStats.topPost.engagement_score}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-900 dark:text-white leading-relaxed mb-3 line-clamp-3 font-medium">
                            {performanceStats.topPost.text.length > 150
                              ? performanceStats.topPost.text.substring(0, 150) + "..."
                              : performanceStats.topPost.text}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-amber-700/70 dark:text-amber-300/70">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(performanceStats.topPost.created_at).toLocaleString('ja-JP')}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Auto-Improvement Suggestions - Enhanced */}
                    {improvementSuggestions.length > 0 && (
                      <div className="relative p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950/50 dark:via-blue-950/30 dark:to-indigo-950/30 border-2 border-indigo-200/50 dark:border-indigo-800/50 rounded-2xl overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-400/20 to-blue-400/20 rounded-full blur-3xl"></div>
                        <div className="relative">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-blue-500/20 dark:from-indigo-400/30 dark:to-blue-400/30 rounded-xl border border-indigo-300/50 dark:border-indigo-700/50">
                                <Zap className="h-5 w-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                              </div>
                              <div>
                                <h3 className="text-base font-bold bg-gradient-to-r from-indigo-600 to-blue-600 dark:from-indigo-400 dark:to-blue-400 bg-clip-text text-transparent">
                                  自動改善提案
                                </h3>
                                <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-0.5">
                                  AIが低パフォーマンス投稿を分析して改善案を提案
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={loadImprovementSuggestions}
                              disabled={isLoadingImprovements}
                              className="rounded-full text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                            >
                              <RefreshCw className={`mr-1 h-3 w-3 ${isLoadingImprovements ? 'animate-spin' : ''}`} />
                              更新
                            </Button>
                          </div>
                          <div className="space-y-4">
                            {improvementSuggestions.map((suggestion, idx) => (
                              <div
                                key={suggestion.postId}
                                className="group relative p-5 bg-white/80 dark:bg-black/80 backdrop-blur-sm border border-indigo-200/50 dark:border-indigo-800/50 rounded-xl hover:shadow-xl hover:shadow-indigo-500/20 hover:scale-[1.01] transition-all duration-300 overflow-hidden"
                                style={{ animationDelay: `${idx * 100}ms` }}
                              >
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <div className="relative space-y-4">
                                  {/* Original Post */}
                                  <div className="p-3 bg-gray-50 dark:bg-gray-950/50 rounded-lg border border-gray-200/50 dark:border-gray-800/50">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">元の投稿</p>
                                    </div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2 leading-relaxed">
                                      {suggestion.originalText}
                                    </p>
                                  </div>
                                  
                                  {/* Arrow */}
                                  <div className="flex justify-center">
                                    <div className="p-2 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-full border border-green-300/50 dark:border-green-700/50">
                                      <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    </div>
                                  </div>
                                  
                                  {/* Improved Post */}
                                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border-2 border-green-200/50 dark:border-green-800/50">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                      <p className="text-xs font-bold text-green-700 dark:text-green-400">✨ 改善案</p>
                                    </div>
                                    <p className="text-sm text-gray-900 dark:text-white leading-relaxed font-medium">
                                      {suggestion.improvedText}
                                    </p>
                                  </div>
                                  
                                  {/* Changes */}
                                  {suggestion.changes.length > 0 && (
                                    <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
                                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">変更点</p>
                                      <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1.5">
                                        {suggestion.changes.map((change: string, idx: number) => (
                                          <li key={idx} className="flex items-start gap-2">
                                            <span className="text-green-500 font-bold mt-0.5">✓</span>
                                            <span className="leading-relaxed">{change}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {/* Expected Improvement */}
                                  <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-lg border border-purple-200/50 dark:border-purple-800/50">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-full border border-green-300/50 dark:border-green-700/50">
                                      <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                      <span className="text-xs font-bold text-green-700 dark:text-green-400">+{suggestion.expectedImprovement.engagement}%</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full border border-blue-300/50 dark:border-blue-700/50">
                                      <Zap className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                      <span className="text-xs font-bold text-blue-700 dark:text-blue-400">+{suggestion.expectedImprovement.impressions}%</span>
                                    </div>
                                  </div>
                                  
                                  {/* Reason */}
                                  <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border border-amber-200/50 dark:border-amber-800/50">
                                    <p className="text-xs text-amber-700 dark:text-amber-300 italic leading-relaxed">
                                      💡 {suggestion.reason}
                                    </p>
                                  </div>
                                  
                                  {/* Actions */}
                                  <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setDrafts([{
                                          text: suggestion.improvedText,
                                          naturalnessScore: 85,
                                          hashtags: []
                                        }])
                                        handleNavigation("create")
                                      }}
                                      className="flex-1 rounded-full text-xs bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white shadow-lg shadow-indigo-500/30"
                                    >
                                      <Plus className="mr-1 h-3 w-3" />
                                      改善版で作成
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        navigator.clipboard.writeText(suggestion.improvedText)
                                        showToast("改善案をコピーしました", "success")
                                      }}
                                      className="rounded-full text-xs border-indigo-300 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {isLoadingImprovements && (
                      <div className="relative p-6 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 border-2 border-indigo-200/50 dark:border-indigo-800/50 rounded-2xl overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/10 to-blue-400/10 animate-pulse"></div>
                        <div className="relative flex items-center gap-3">
                          <div className="p-2 bg-indigo-500/20 dark:bg-indigo-400/20 rounded-lg">
                            <RefreshCw className="h-5 w-5 animate-spin text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">改善提案を生成中...</span>
                            <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-0.5">AIが投稿を分析しています</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* High Engagement Posts - Repost Suggestions */}
                    {highEngagementPosts.length > 0 && (
                      <div className="p-4 border border-gray-200 dark:border-gray-800 rounded-xl">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          再投稿提案
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          過去の高エンゲージメント投稿を再投稿できます
                        </p>
                        <div className="space-y-2">
                          {highEngagementPosts.slice(0, 5).map((post) => (
                            <div
                              key={post.id}
                              className="p-3 border border-gray-200 dark:border-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <p className="text-sm text-gray-900 dark:text-white line-clamp-2 mb-2 leading-relaxed">
                                    {post.text.substring(0, 120)}...
                                  </p>
                                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                    <span>エンゲージ: {post.engagement_score}</span>
                                    {post.impression_count && (
                                      <span>インプ: {post.impression_count.toLocaleString('ja-JP')}</span>
                                    )}
                                    {post.trend && <span>トレンド: {post.trend}</span>}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRepost(post)}
                                  className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors text-xs shrink-0"
                                >
                                  再投稿
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Scheduled Tweets View */}
          {showScheduled && (
            <div className="space-y-6">
              {/* Header with Stats */}
              <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        スケジュール管理
                      </CardTitle>
                      <CardDescription>予定投稿の一覧・編集・削除</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (scheduleViewMode === "calendar") {
                            setScheduleViewMode("timeline")
                          } else if (scheduleViewMode === "timeline") {
                            setScheduleViewMode("list")
                          } else {
                            setScheduleViewMode("calendar")
                          }
                        }}
                        className="rounded-full"
                      >
                        {scheduleViewMode === "calendar" ? (
                          <>
                            <CalendarDays className="mr-2 h-4 w-4" />
                            タイムライン
                          </>
                        ) : scheduleViewMode === "timeline" ? (
                          <>
                            <List className="mr-2 h-4 w-4" />
                            リスト
                          </>
                        ) : (
                          <>
                            <Calendar className="mr-2 h-4 w-4" />
                            カレンダー
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadScheduledTweets}
                        disabled={isLoadingScheduled}
                        className="rounded-full"
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingScheduled ? 'animate-spin' : ''}`} />
                        更新
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Stats */}
                  {(() => {
                    const now = new Date()
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                    const weekEnd = new Date(today)
                    weekEnd.setDate(weekEnd.getDate() + 7)
                    const monthEnd = new Date(today)
                    monthEnd.setMonth(monthEnd.getMonth() + 1)

                    const todayCount = scheduledTweets.filter(p => {
                      const scheduled = new Date(p.scheduled_for!)
                      return scheduled >= today && scheduled < new Date(today.getTime() + 24 * 60 * 60 * 1000)
                    }).length

                    const weekCount = scheduledTweets.filter(p => {
                      const scheduled = new Date(p.scheduled_for!)
                      return scheduled >= today && scheduled < weekEnd
                    }).length

                    const monthCount = scheduledTweets.filter(p => {
                      const scheduled = new Date(p.scheduled_for!)
                      return scheduled >= today && scheduled < monthEnd
                    }).length

                    return (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-3 border border-gray-200 dark:border-gray-800 rounded-xl">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">今日</div>
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">{todayCount}</div>
                        </div>
                        <div className="p-3 border border-gray-200 dark:border-gray-800 rounded-xl">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">今週</div>
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">{weekCount}</div>
                        </div>
                        <div className="p-3 border border-gray-200 dark:border-gray-800 rounded-xl">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">今月</div>
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">{monthCount}</div>
                        </div>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>

              {/* Search and Filter */}
              <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search Input */}
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="投稿内容、トレンド、目的で検索..."
                        value={scheduleSearchQuery}
                        onChange={(e) => setScheduleSearchQuery(e.target.value)}
                        className="pl-10 bg-white dark:bg-black border-gray-200 dark:border-gray-800"
                      />
                    </div>

                    {/* Date Filter */}
                    <Select value={scheduleDateFilter} onValueChange={setScheduleDateFilter}>
                      <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-black border-gray-200 dark:border-gray-800">
                        <Calendar className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="期間" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">すべて</SelectItem>
                        <SelectItem value="today">今日</SelectItem>
                        <SelectItem value="week">今週</SelectItem>
                        <SelectItem value="month">今月</SelectItem>
                        <SelectItem value="future">未来</SelectItem>
                        <SelectItem value="past">過去</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Scheduled Tweets List */}
              <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl">
                <CardContent className="pt-6">
                  {isLoadingScheduled ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="border rounded-lg p-4 space-y-3">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                          <div className="flex gap-2">
                            <Skeleton className="h-8 w-16" />
                            <Skeleton className="h-8 w-16" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (() => {
                    // Filter and sort scheduled tweets
                    let filteredSchedules = [...scheduledTweets]

                    // Search filter
                    if (scheduleSearchQuery.trim()) {
                      const query = scheduleSearchQuery.toLowerCase()
                      filteredSchedules = filteredSchedules.filter(post =>
                        post.text.toLowerCase().includes(query) ||
                        post.trend?.toLowerCase().includes(query) ||
                        post.purpose?.toLowerCase().includes(query)
                      )
                    }

                    // Date filter
                    const now = new Date()
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                    const weekEnd = new Date(today)
                    weekEnd.setDate(weekEnd.getDate() + 7)
                    const monthEnd = new Date(today)
                    monthEnd.setMonth(monthEnd.getMonth() + 1)

                    if (scheduleDateFilter !== "all") {
                      filteredSchedules = filteredSchedules.filter(post => {
                        const scheduled = new Date(post.scheduled_for!)
                        switch (scheduleDateFilter) {
                          case "today":
                            return scheduled >= today && scheduled < new Date(today.getTime() + 24 * 60 * 60 * 1000)
                          case "week":
                            return scheduled >= today && scheduled < weekEnd
                          case "month":
                            return scheduled >= today && scheduled < monthEnd
                          case "future":
                            return scheduled >= now
                          case "past":
                            return scheduled < now
                          default:
                            return true
                        }
                      })
                    }

                    // Sort by scheduled date
                    filteredSchedules.sort((a, b) => {
                      return new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime()
                    })

                    // For calendar view, always show calendar even if no schedules
                    // For other views, show empty message if no schedules
                    if (filteredSchedules.length === 0 && scheduleViewMode !== "calendar") {
                      return (
                        <div className="text-center py-12">
                          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-muted-foreground mb-2">
                            {scheduleSearchQuery || scheduleDateFilter !== "all"
                              ? "検索条件に一致するスケジュールが見つかりませんでした"
                              : "スケジュール済みの投稿がありません。"}
                          </p>
                          {(scheduleSearchQuery || scheduleDateFilter !== "all") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setScheduleSearchQuery("")
                                setScheduleDateFilter("all")
                              }}
                              className="mt-2"
                            >
                              フィルターをリセット
                            </Button>
                          )}
                        </div>
                      )
                    }

                    // Get scheduled dates for calendar
                    const scheduledDates = scheduledTweets
                      .map(post => new Date(post.scheduled_for!))
                      .filter(date => !isNaN(date.getTime()))

                    // Filter by selected calendar date
                    let displaySchedules = filteredSchedules
                    if (scheduleViewMode === "calendar" && selectedCalendarDate) {
                      const selectedDateStr = selectedCalendarDate.toDateString()
                      displaySchedules = filteredSchedules.filter(post => {
                        const postDate = new Date(post.scheduled_for!)
                        return postDate.toDateString() === selectedDateStr
                      })
                    }

                    // Group by date for timeline view
                    const groupedByDate = scheduleViewMode === "timeline" 
                      ? displaySchedules.reduce((acc, post) => {
                          const date = new Date(post.scheduled_for!)
                          const dateKey = date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
                          if (!acc[dateKey]) {
                            acc[dateKey] = []
                          }
                          acc[dateKey].push(post)
                          return acc
                        }, {} as Record<string, typeof displaySchedules>)
                      : null

                    return (
                      <div className="space-y-6">
                        {/* Calendar View - X-boost Style */}
                        {scheduleViewMode === "calendar" && (
                          <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl">
                            <CardContent className="pt-6">
                              <CalendarWithSchedules
                                scheduledPosts={scheduledTweets.map(post => ({
                                  id: post.id,
                                  text: post.text,
                                  scheduled_for: post.scheduled_for!,
                                  status: post.status === 'posted' ? 'posted' : post.status === 'deleted' ? 'error' : 'scheduled'
                                }))}
                                currentMonth={calendarMonth}
                                onMonthChange={setCalendarMonth}
                                onDateClick={(date) => {
                                  setSelectedCalendarDate(date)
                                  const postsForDate = scheduledTweets.filter(post => {
                                    const postDate = new Date(post.scheduled_for!)
                                    return postDate.toDateString() === date.toDateString()
                                  })
                                  if (postsForDate.length > 0) {
                                    showToast(`${date.toLocaleDateString('ja-JP')}に${postsForDate.length}件のスケジュールがあります`, "info")
                                  }
                                }}
                                onPostClick={(post) => {
                                  const fullPost = scheduledTweets.find(p => p.id === post.id)
                                  if (fullPost) {
                                    handleEditSchedule(fullPost)
                                  }
                                }}
                              />
                            </CardContent>
                          </Card>
                        )}

                        {/* Bulk Actions */}
                        {selectedSchedules.size > 0 && scheduleViewMode !== "calendar" && (
                          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800">
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {selectedSchedules.size}件を選択中
                            </span>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedSchedules(new Set())}
                                className="rounded-full"
                              >
                                <X className="mr-2 h-4 w-4" />
                                選択解除
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleBulkDelete}
                                className="rounded-full"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                一括削除
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Timeline View */}
                        {scheduleViewMode === "timeline" && groupedByDate ? (
                          <div className="space-y-6">
                            {Object.entries(groupedByDate).map(([dateKey, posts]) => (
                              <div key={dateKey} className="space-y-3">
                                <div className="flex items-center gap-3 sticky top-0 bg-white dark:bg-black z-10 py-2">
                                  <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-3">
                                    {dateKey} ({posts.length}件)
                                  </h3>
                                  <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                                </div>
                                <div className="space-y-3 pl-4 border-l-2 border-gray-200 dark:border-gray-800">
                                  {posts.map((post, idx) => (
                                    <div
                                      key={post.id}
                                      className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors bg-white dark:bg-black"
                                    >
                                      <div className="flex items-start gap-3">
                                        <button
                                          onClick={() => handleToggleSelect(post.id)}
                                          className="mt-1 shrink-0"
                                        >
                                          {selectedSchedules.has(post.id) ? (
                                            <CheckSquare className="h-5 w-5 text-gray-900 dark:text-white" />
                                          ) : (
                                            <Square className="h-5 w-5 text-gray-400" />
                                          )}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" />
                                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                              {new Date(post.scheduled_for!).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                          </div>
                                          <p className="text-sm text-gray-900 dark:text-white mb-2 leading-relaxed">{post.text}</p>
                                          {post.hashtags && post.hashtags.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-2">
                                              {post.hashtags.map((tag: string, i: number) => (
                                                <span
                                                  key={i}
                                                  className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground"
                                                >
                                                  {tag}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                                            {post.trend && <span>トレンド: {post.trend}</span>}
                                            {post.purpose && <span>目的: {post.purpose}</span>}
                                          </div>
                                          <div className="flex gap-2">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleEditSchedule(post)}
                                              className="rounded-full text-xs"
                                            >
                                              <Edit className="mr-1 h-3 w-3" />
                                              編集
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleDeleteSchedule(post.id)}
                                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 rounded-full text-xs"
                                            >
                                              <Trash2 className="mr-1 h-3 w-3" />
                                              削除
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : scheduleViewMode === "list" ? (
                          /* List View */
                          <div className="space-y-3">
                            <div className="flex items-center justify-between mb-4">
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {displaySchedules.length}件のスケジュール
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault()
                                  handleSelectAll(displaySchedules)
                                }}
                                className="rounded-full text-xs"
                              >
                                {displaySchedules.every(p => selectedSchedules.has(p.id)) ? (
                                  <>
                                    <CheckSquare className="mr-1 h-4 w-4" />
                                    すべて解除
                                  </>
                                ) : (
                                  <>
                                    <Square className="mr-1 h-4 w-4" />
                                    すべて選択
                                  </>
                                )}
                              </Button>
                            </div>
                            {displaySchedules.map((post, idx) => (
                              <div
                                key={post.id}
                                className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors bg-white dark:bg-black"
                              >
                                <div className="flex items-start gap-3">
                                  <button
                                    onClick={() => handleToggleSelect(post.id)}
                                    className="mt-1 shrink-0"
                                  >
                                    {selectedSchedules.has(post.id) ? (
                                      <CheckSquare className="h-5 w-5 text-gray-900 dark:text-white" />
                                    ) : (
                                      <Square className="h-5 w-5 text-gray-400" />
                                    )}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" />
                                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {new Date(post.scheduled_for!).toLocaleString('ja-JP')}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-900 dark:text-white mb-2 leading-relaxed">{post.text}</p>
                                    {post.hashtags && post.hashtags.length > 0 && (
                                      <div className="flex flex-wrap gap-2 mb-2">
                                        {post.hashtags.map((tag: string, i: number) => (
                                          <span
                                            key={i}
                                            className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground"
                                          >
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                                      {post.trend && <span>トレンド: {post.trend}</span>}
                                      {post.purpose && <span>目的: {post.purpose}</span>}
                                    </div>
                                    {editingSchedule === post.id ? (
                                      <div className="space-y-2 pt-2 border-t">
                                        <label className="text-sm font-medium">スケジュール日時</label>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                          <input
                                            type="datetime-local"
                                            value={editScheduleDateTime}
                                            onChange={(e) => setEditScheduleDateTime(e.target.value)}
                                            min={new Date().toISOString().slice(0, 16)}
                                            className="flex-1 px-3 py-2 border rounded-md text-sm bg-white dark:bg-black"
                                          />
                                          <div className="flex gap-2">
                                            <Button
                                              size="sm"
                                              onClick={() => handleSaveSchedule(post.id)}
                                              className="flex-1 sm:flex-initial"
                                            >
                                              保存
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => {
                                                setEditingSchedule(null)
                                                setEditScheduleDateTime("")
                                              }}
                                              className="flex-1 sm:flex-initial"
                                            >
                                              キャンセル
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex gap-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleEditSchedule(post)}
                                          className="rounded-full text-xs"
                                        >
                                          <Edit className="mr-1 h-3 w-3" />
                                          編集
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteSchedule(post.id)}
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 rounded-full text-xs"
                                        >
                                          <Trash2 className="mr-1 h-3 w-3" />
                                          削除
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            </div>
          )}

        {/* History */}
          {/* Drafts View */}
          {showDrafts && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    下書き
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    保存された下書きを管理
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadPostHistory}
                  disabled={isLoadingHistory}
                  className="rounded-full"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                  更新
                </Button>
              </div>
              {(() => {
                const drafts = postHistory.filter(post => post.status === 'draft')
                return drafts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {drafts.map((post) => (
                      <Card key={post.id} className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl">
                        <CardContent className="pt-6">
                          <p className="text-sm text-gray-900 dark:text-white mb-4 line-clamp-4">
                            {post.text}
                          </p>
                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                            <span>{new Date(post.created_at).toLocaleDateString('ja-JP')}</span>
                            {post.trend && <span>トレンド: {post.trend}</span>}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingDraftId(post.id)
                                setEditingDraftText(post.text)
                              }}
                              className="flex-1 rounded-full"
                            >
                              編集
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                if (user && twitterAccessToken) {
                                  try {
                                    await approveAndPostTweet(
                                      user.id,
                                      {
                                        text: post.text,
                                        naturalnessScore: post.naturalness_score,
                                        hashtags: post.hashtags
                                      },
                                      twitterAccessToken,
                                      post.trend || "",
                                      post.purpose || ""
                                    )
                                    showToast("ツイートを投稿しました", "success")
                                    await loadPostHistory()
                                  } catch (error) {
                                    showToast("投稿に失敗しました", "error")
                                  }
                                }
                              }}
                              className="flex-1 rounded-full"
                            >
                              投稿
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (user && window.confirm("この下書きを削除しますか？")) {
                                  try {
                                    const result = await deleteDraft(post.id, user.id)
                                    if (result.success) {
                                      showToast("下書きを削除しました", "success")
                                      await loadPostHistory()
                                    } else {
                                      showToast(result.error || "削除に失敗しました", "error")
                                    }
                                  } catch (error) {
                                    showToast("削除に失敗しました", "error")
                                  }
                                }
                              }}
                              className="rounded-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl">
                    <CardContent className="pt-6">
                      <div className="text-center py-12">
                        <Bookmark className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">
                          下書きがありません
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })()}

              {/* Draft Edit Modal */}
              {editingDraftId && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/80 z-50 flex items-center justify-center p-4">
                  <Card className="w-full max-w-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl">
                    <CardHeader className="border-b border-gray-200 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">
                          下書きを編集
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingDraftId(null)
                            setEditingDraftText("")
                          }}
                          className="rounded-full h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <textarea
                        value={editingDraftText}
                        onChange={(e) => {
                          const value = e.target.value
                          if (value.length <= 280) {
                            setEditingDraftText(value)
                          }
                        }}
                        placeholder="ツイート内容を編集..."
                        className={cn(
                          "w-full min-h-[200px] px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-xl",
                          "text-base bg-white dark:bg-black text-gray-900 dark:text-white",
                          "resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                          "placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        )}
                        style={{ fontSize: '20px', lineHeight: '1.5' }}
                      />
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          {280 - editingDraftText.length}文字残り
                        </span>
                        <span className={cn(
                          "font-medium",
                          (280 - editingDraftText.length) < 20 && (280 - editingDraftText.length) >= 0 && "text-orange-500",
                          (280 - editingDraftText.length) < 0 && "text-red-500"
                        )}>
                          {editingDraftText.length}/280
                        </span>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingDraftId(null)
                            setEditingDraftText("")
                          }}
                          className="rounded-full"
                        >
                          キャンセル
                        </Button>
                        <Button
                          onClick={async () => {
                            if (!user || !editingDraftId) return
                            try {
                              const result = await updateDraft(editingDraftId, user.id, editingDraftText)
                              if (result.success) {
                                showToast("下書きを更新しました", "success")
                                setEditingDraftId(null)
                                setEditingDraftText("")
                                await loadPostHistory()
                              } else {
                                showToast(result.error || "更新に失敗しました", "error")
                              }
                            } catch (error) {
                              showToast("更新に失敗しました", "error")
                            }
                          }}
                          className="rounded-full bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          保存
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* Quoted Tweets View */}
          {showQuotedTweets && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    引用ツイート
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    引用ツイートの管理と作成
                  </p>
                </div>
                <Button
                  onClick={() => setShowQuotedTweetsModal(true)}
                  className="rounded-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  新規作成
                </Button>
              </div>
              {quotedTweets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {quotedTweets.map((tweet) => (
                    <Card key={tweet.id} className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl">
                      <CardContent className="pt-6">
                        <p className="text-sm text-gray-900 dark:text-white mb-4 line-clamp-3">
                          {tweet.tweet_text}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(tweet.created_at).toLocaleDateString('ja-JP')}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedQuotedTweet(tweet)
                              setShowQuotedTweetsModal(false)
                            }}
                          >
                            使用
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl">
                  <CardContent className="pt-6">
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400 mb-4">
                        引用ツイートがありません
                      </p>
                      <Button
                        onClick={() => setShowQuotedTweetsModal(true)}
                        variant="outline"
                        className="rounded-full"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        新規作成
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Trends View */}
          {showTrends && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    トレンド
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    現在のトレンドを確認
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNavigation("create")}
                  className="rounded-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  ツイート作成
                </Button>
              </div>
              <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl">
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Lightbulb className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      トレンド機能は準備中です
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Accounts View */}
          {showAccounts && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    アカウント管理
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Twitterアカウントの管理（複数アカウント対応）
                  </p>
                </div>
                <Button
                  onClick={handleConnectTwitter}
                  className="rounded-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {twitterConnected ? "アカウントを追加" : "Twitter連携"}
                </Button>
              </div>
              {twitterConnected && twitterAccounts.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {twitterAccounts.map((account) => (
                      <Card key={account.id} className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl hover:shadow-lg transition-shadow">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3 mb-4">
                            {account.profile_image_url ? (
                              <img
                                src={account.profile_image_url}
                                alt={account.username || ""}
                                className="h-12 w-12 rounded-full"
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                                <User className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {account.account_name || account.username || "無名"}
                              </h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                @{account.username || "unknown"}
                              </p>
                            </div>
                            {account.is_default && (
                              <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full">
                                デフォルト
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {!account.is_default && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  if (user) {
                                    await setDefaultTwitterAccount(account.id, user.id)
                                    await loadTwitterAccounts()
                                    showToast("デフォルトアカウントを変更しました", "success")
                                  }
                                }}
                                className="flex-1 rounded-full"
                              >
                                デフォルトに設定
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                handleSelectAccount(account.id)
                                showToast("アカウントを選択しました", "success")
                              }}
                              className="flex-1 rounded-full"
                            >
                              選択
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                if (user && window.confirm("このアカウントを削除しますか？")) {
                                  try {
                                    await deleteTwitterAccount(account.id, user.id)
                                    await loadTwitterAccounts()
                                    showToast("アカウントを削除しました", "success")
                                  } catch (error) {
                                    showToast("アカウントの削除に失敗しました", "error")
                                  }
                                }
                              }}
                              className="rounded-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Card className="border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950/50 rounded-2xl">
                    <CardContent className="pt-6">
                      <div className="text-center py-6">
                        <Button
                          variant="outline"
                          onClick={handleConnectTwitter}
                          className="rounded-full"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          アカウントを追加
                        </Button>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          複数のTwitterアカウントを連携できます
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl">
                  <CardContent className="pt-6">
                    <div className="text-center py-12">
                      <User className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400 mb-4">
                        Twitterアカウントが連携されていません
                      </p>
                      <Button
                        onClick={handleConnectTwitter}
                        className="rounded-full"
                      >
                        <Twitter className="mr-2 h-4 w-4" />
                        Twitter連携
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

        {showHistory && (
          <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors duration-200 animate-fade-in">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>投稿履歴</CardTitle>
                  <CardDescription>過去に生成・投稿したツイート</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadPostHistory}
                  disabled={isLoadingHistory}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                  更新
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Input */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="投稿内容、トレンド、目的、ハッシュタグで検索..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="pl-10 bg-white dark:bg-black border-gray-200 dark:border-gray-800"
                  />
                </div>

                {/* Status Filter */}
                <Select value={historyStatusFilter} onValueChange={setHistoryStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-black border-gray-200 dark:border-gray-800">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="ステータス" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">すべて</SelectItem>
                    <SelectItem value="draft">下書き</SelectItem>
                    <SelectItem value="posted">投稿済み</SelectItem>
                    <SelectItem value="scheduled">スケジュール済み</SelectItem>
                    <SelectItem value="deleted">削除済み</SelectItem>
                  </SelectContent>
                </Select>

                {/* Sort */}
                <Select value={historySortBy} onValueChange={setHistorySortBy}>
                  <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-black border-gray-200 dark:border-gray-800">
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="並び替え" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">新しい順</SelectItem>
                    <SelectItem value="oldest">古い順</SelectItem>
                    <SelectItem value="engagement_high">エンゲージメント高い順</SelectItem>
                    <SelectItem value="engagement_low">エンゲージメント低い順</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isLoadingHistory ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="border rounded-lg p-4 space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-6 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (() => {
                // Filter and sort posts
                let filteredPosts = [...postHistory]

                // Search filter
                if (historySearchQuery.trim()) {
                  const query = historySearchQuery.toLowerCase()
                  filteredPosts = filteredPosts.filter(post =>
                    post.text.toLowerCase().includes(query) ||
                    post.trend?.toLowerCase().includes(query) ||
                    post.purpose?.toLowerCase().includes(query) ||
                    post.hashtags?.some(tag => tag.toLowerCase().includes(query))
                  )
                }

                // Status filter
                if (historyStatusFilter !== "all") {
                  filteredPosts = filteredPosts.filter(post => post.status === historyStatusFilter)
                }

                // Sort
                filteredPosts.sort((a, b) => {
                  switch (historySortBy) {
                    case "newest":
                      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    case "oldest":
                      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    case "engagement_high":
                      return (b.engagement_score || 0) - (a.engagement_score || 0)
                    case "engagement_low":
                      return (a.engagement_score || 0) - (b.engagement_score || 0)
                    default:
                      return 0
                  }
                })

                if (filteredPosts.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-muted-foreground mb-2">
                        {historySearchQuery || historyStatusFilter !== "all"
                          ? "検索条件に一致する投稿が見つかりませんでした"
                          : "履歴がありません。ツイートを生成すると履歴に保存されます。"}
                      </p>
                      {(historySearchQuery || historyStatusFilter !== "all") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setHistorySearchQuery("")
                            setHistoryStatusFilter("all")
                          }}
                          className="mt-2"
                        >
                          フィルターをリセット
                        </Button>
                      )}
                    </div>
                  )
                }

                return (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      {filteredPosts.length}件の投稿が見つかりました
                    </div>
                    {filteredPosts.map((post, idx) => (
                    <div
                      key={post.id}
                      className="border border-gray-200 dark:border-gray-800 rounded-2xl p-4 sm:p-5 space-y-3 hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors duration-200 bg-white dark:bg-black animate-fade-in"
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div className="flex-1 space-y-2 min-w-0">
                          <p className="text-sm sm:text-base whitespace-pre-wrap leading-relaxed break-words text-gray-900 dark:text-white">{post.text}</p>
                          
                          {post.hashtags && post.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {post.hashtags.map((tag, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                            <span className="whitespace-nowrap">作成: {new Date(post.created_at).toLocaleDateString('ja-JP')}</span>
                            {post.trend && <span className="truncate max-w-[150px]">トレンド: {post.trend}</span>}
                            {post.purpose && <span className="truncate max-w-[150px]">目的: {post.purpose}</span>}
                            {post.naturalness_score !== null && (
                              <span>自然さ: {post.naturalness_score}/100</span>
                            )}
                            {post.status === 'posted' && (
                              <span className={`font-semibold whitespace-nowrap ${post.engagement_score > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                                エンゲージ: {post.engagement_score > 0 ? post.engagement_score : '未取得'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 items-end">
                          <span className={`text-xs px-2 py-1 rounded ${getStatusColor(post.status)}`}>
                            {getStatusLabel(post.status)}
                          </span>
                          {post.scheduled_for && (
                            <span className="text-xs text-muted-foreground">
                              予定: {new Date(post.scheduled_for).toLocaleString('ja-JP')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyFromHistory(post.text)}
                          className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors flex-1 sm:flex-initial"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          コピー
                        </Button>
                        {post.status === 'draft' || post.status === 'posted' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRepost(post)}
                            className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors flex-1 sm:flex-initial"
                          >
                            <Twitter className="mr-2 h-4 w-4" />
                            再投稿
                          </Button>
                        ) : null}
                        {post.tweet_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`https://twitter.com/i/web/status/${post.tweet_id}`, '_blank')}
                            className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors flex-1 sm:flex-initial"
                          >
                            ツイートを見る
                          </Button>
                        )}
                      </div>
                    </div>
                    ))}
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        )}
        </div>
      </main>

      {/* Quoted Tweets Modal */}
      {showQuotedTweetsModal && (
        <QuotedTweetsModal
          quotedTweets={quotedTweets}
          isLoading={isLoadingQuotedTweets}
          onUse={handleUseQuotedTweet}
          onClose={() => setShowQuotedTweetsModal(false)}
          onAdd={async (title: string, tweetText: string) => {
            const {
              data: { session },
            } = await supabase.auth.getSession()
            if (session) {
              const result = await saveQuotedTweet(session.user.id, title, tweetText)
              if (result.success) {
                await loadQuotedTweets()
              } else {
                throw new Error(result.error)
              }
            }
          }}
          onDelete={async (id: string) => {
            const result = await deleteQuotedTweet(id)
            if (result.success) {
              await loadQuotedTweets()
            } else {
              throw new Error(result.error)
            }
          }}
        />
      )}

      {/* Quoted Tweet Compose Window (Floating) */}
      {selectedQuotedTweet && (
        <QuotedTweetCompose
          quotedTweet={selectedQuotedTweet}
          onClose={() => setSelectedQuotedTweet(null)}
          onPost={handlePostQuotedTweet}
          isPosting={false}
        />
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
