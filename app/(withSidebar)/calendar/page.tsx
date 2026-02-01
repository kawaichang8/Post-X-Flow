"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import Calendar from "react-calendar"
import { supabase } from "@/lib/supabase"
import { 
  getScheduledTweets, 
  deleteScheduledTweet, 
  updateScheduledTweet, 
  postScheduledTweet 
} from "@/app/actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar as CalendarIcon,
  Plus,
  FileText,
  Trash2,
  Edit3,
  Send,
  Eye,
  Loader2,
  CalendarDays,
  GripVertical,
  Info,
} from "lucide-react"
import "react-calendar/dist/Calendar.css"

interface ScheduledPost {
  id: string
  text: string
  scheduled_for: string
  status: "scheduled" | "posted" | "failed" | "deleted"
  trend?: string | null
  purpose?: string | null
  naturalness_score?: number
  impression_count?: number | null
  created_at: string
}

interface User {
  id: string
  email?: string
}

export default function CalendarPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [currentView, setCurrentView] = useState<Date>(new Date())
  
  // Edit/Delete states
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null)
  const [newScheduleDate, setNewScheduleDate] = useState("")
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPosting, setIsPosting] = useState(false)
  
  // Post preview modal
  const [previewPost, setPreviewPost] = useState<ScheduledPost | null>(null)
  
  // Drag state (simple implementation)
  const [draggedPost, setDraggedPost] = useState<ScheduledPost | null>(null)

  // Check auth
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push("/auth/login")
        return
      }
      setUser({ id: session.user.id, email: session.user.email })
      setIsLoading(false)
    }
    checkUser()
  }, [router])

  // Load scheduled posts
  const loadScheduledPosts = useCallback(async () => {
    if (!user) return
    try {
      const data = await getScheduledTweets(user.id)
      setScheduledPosts(data as ScheduledPost[])
    } catch (e) {
      console.error("Failed to load scheduled posts:", e)
      showToast("スケジュール投稿の取得に失敗しました", "error")
    }
  }, [user, showToast])

  useEffect(() => {
    if (user) loadScheduledPosts()
  }, [user, loadScheduledPosts])

  // Group posts by date
  const postsByDate = useMemo(() => {
    const grouped: Record<string, ScheduledPost[]> = {}
    scheduledPosts.forEach((post) => {
      const dateKey = new Date(post.scheduled_for).toDateString()
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(post)
    })
    return grouped
  }, [scheduledPosts])

  const getPostsForDate = (date: Date): ScheduledPost[] => {
    return postsByDate[date.toDateString()] || []
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
  }

  // Calendar tile styling
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view !== "month") return ""
    
    const posts = getPostsForDate(date)
    if (posts.length > 0) {
      return "calendar-cell-scheduled"
    }
    
    return ""
  }

  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view !== "month") return null
    
    const posts = getPostsForDate(date)
    if (posts.length === 0) return null

    return (
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
        {posts.slice(0, 3).map((_, i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-green-500"
          />
        ))}
        {posts.length > 3 && (
          <span className="text-[8px] text-green-600 font-medium">+{posts.length - 3}</span>
        )}
      </div>
    )
  }

  // Handle reschedule
  const handleReschedule = async () => {
    if (!editingPost || !newScheduleDate) return
    setIsUpdating(true)
    try {
      await updateScheduledTweet(editingPost.id, new Date(newScheduleDate))
      showToast("スケジュールを変更しました", "success")
      setEditingPost(null)
      setNewScheduleDate("")
      loadScheduledPosts()
    } catch (e) {
      console.error("Failed to reschedule:", e)
      showToast("スケジュール変更に失敗しました", "error")
    } finally {
      setIsUpdating(false)
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!deletingPostId) return
    setIsDeleting(true)
    try {
      await deleteScheduledTweet(deletingPostId)
      showToast("スケジュールを削除しました", "success")
      setDeletingPostId(null)
      loadScheduledPosts()
    } catch (e) {
      console.error("Failed to delete:", e)
      showToast("削除に失敗しました", "error")
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle post now
  const handlePostNow = async (post: ScheduledPost) => {
    if (!user) return
    setIsPosting(true)
    try {
      const result = await postScheduledTweet(user.id, post.id)
      if (result.success) {
        showToast("投稿しました！", "success")
        loadScheduledPosts()
      } else {
        showToast(result.error || "投稿に失敗しました", "error")
      }
    } catch (e) {
      console.error("Failed to post:", e)
      showToast("投稿に失敗しました", "error")
    } finally {
      setIsPosting(false)
    }
  }

  // Drag and drop handlers (simple version)
  const handleDragStart = (post: ScheduledPost) => {
    setDraggedPost(post)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDropOnDate = async (targetDate: Date) => {
    if (!draggedPost) return
    
    // Keep the same time, just change the date
    const originalDate = new Date(draggedPost.scheduled_for)
    const newDate = new Date(targetDate)
    newDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0)
    
    setIsUpdating(true)
    try {
      await updateScheduledTweet(draggedPost.id, newDate)
      showToast("スケジュールを移動しました", "success")
      loadScheduledPosts()
    } catch (e) {
      console.error("Failed to move post:", e)
      showToast("移動に失敗しました", "error")
    } finally {
      setDraggedPost(null)
      setIsUpdating(false)
    }
  }

  // Navigate to dashboard to create new post
  const handleAddNew = () => {
    router.push("/dashboard")
  }

  const selectedDatePosts = selectedDate ? getPostsForDate(selectedDate) : []

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-green-500" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                <CalendarDays className="h-5 w-5 text-white" />
              </div>
              スケジュールカレンダー
            </h1>
            <p className="text-muted-foreground mt-1">
              予約投稿の管理・確認ができます
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl" onClick={loadScheduledPosts}>
                  <Loader2 className={cn("h-4 w-4", isLoading && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>更新</TooltipContent>
            </Tooltip>
            <Button 
              onClick={handleAddNew}
              className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              新規予約
            </Button>
          </div>
        </div>

        {/* Drag hint */}
        {scheduledPosts.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-accent/30 rounded-xl px-4 py-2">
            <Info className="h-4 w-4" />
            <span>予約投稿をドラッグして別の日に移動できます</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-2 rounded-2xl border border-border shadow-soft overflow-hidden">
            <CardHeader className="border-b border-border bg-gradient-to-r from-green-50 to-white dark:from-green-950/30 dark:to-card">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  {currentView.toLocaleDateString("ja-JP", {
                    year: "numeric",
                    month: "long",
                  })}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => {
                      const newDate = new Date(currentView)
                      newDate.setMonth(newDate.getMonth() - 1)
                      setCurrentView(newDate)
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-lg text-xs"
                    onClick={() => setCurrentView(new Date())}
                  >
                    今日
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    onClick={() => {
                      const newDate = new Date(currentView)
                      newDate.setMonth(newDate.getMonth() + 1)
                      setCurrentView(newDate)
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <style jsx global>{`
                .react-calendar {
                  width: 100%;
                  border: none;
                  background: transparent;
                  font-family: inherit;
                }
                .react-calendar__navigation {
                  display: none;
                }
                .react-calendar__month-view__weekdays {
                  text-align: center;
                  font-size: 0.75rem;
                  font-weight: 500;
                  color: hsl(var(--muted-foreground));
                  padding-bottom: 0.5rem;
                }
                .react-calendar__month-view__weekdays__weekday {
                  padding: 0.5rem;
                }
                .react-calendar__month-view__weekdays__weekday abbr {
                  text-decoration: none;
                }
                .react-calendar__tile {
                  position: relative;
                  aspect-ratio: 1;
                  padding: 0.5rem;
                  font-size: 0.875rem;
                  border-radius: 0.75rem;
                  transition: all 0.2s;
                }
                .react-calendar__tile:hover {
                  background: hsl(var(--accent));
                }
                .react-calendar__tile--now {
                  background: hsl(var(--accent)) !important;
                  font-weight: 600;
                }
                .react-calendar__tile--active {
                  background: hsl(var(--primary)) !important;
                  color: hsl(var(--primary-foreground)) !important;
                }
                .react-calendar__tile--neighboringMonth {
                  color: hsl(var(--muted-foreground));
                  opacity: 0.5;
                }
                .calendar-cell-scheduled {
                  background: hsl(142 76% 36% / 0.15) !important;
                }
                .calendar-cell-scheduled:hover {
                  background: hsl(142 76% 36% / 0.25) !important;
                }
              `}</style>
              <Calendar
                value={selectedDate}
                onChange={(value) => {
                  if (value instanceof Date) {
                    handleDateClick(value)
                  }
                }}
                activeStartDate={currentView}
                onActiveStartDateChange={({ activeStartDate }) => {
                  if (activeStartDate) {
                    setCurrentView(activeStartDate)
                  }
                }}
                tileClassName={tileClassName}
                tileContent={tileContent}
                locale="ja-JP"
                formatDay={(locale, date) => date.getDate().toString()}
                onClickDay={(date) => handleDropOnDate(date)}
              />
            </CardContent>
          </Card>

          {/* Selected Date Panel */}
          <Card className="rounded-2xl border border-border shadow-soft">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg">
                {selectedDate ? (
                  <span className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    {selectedDate.toLocaleDateString("ja-JP", {
                      month: "long",
                      day: "numeric",
                      weekday: "short",
                    })}
                  </span>
                ) : (
                  <span className="text-muted-foreground">日付を選択</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {selectedDate ? (
                <div className="space-y-3">
                  {selectedDatePosts.length > 0 ? (
                    <>
                      {selectedDatePosts.map((post) => (
                        <div
                          key={post.id}
                          draggable
                          onDragStart={() => handleDragStart(post)}
                          onDragEnd={() => setDraggedPost(null)}
                          className={cn(
                            "group p-3 bg-accent/50 rounded-xl space-y-2 cursor-grab active:cursor-grabbing hover:bg-accent transition-colors",
                            draggedPost?.id === post.id && "opacity-50"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground mt-1 opacity-50 group-hover:opacity-100" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm line-clamp-2">
                                {post.text}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="secondary" className="text-xs">
                                  {new Date(post.scheduled_for).toLocaleTimeString(
                                    "ja-JP",
                                    { hour: "2-digit", minute: "2-digit" }
                                  )}
                                </Badge>
                                {post.naturalness_score && (
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-xs",
                                      post.naturalness_score >= 80 
                                        ? "text-green-600 border-green-300" 
                                        : "text-yellow-600 border-yellow-300"
                                    )}
                                  >
                                    自然度 {post.naturalness_score}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg"
                                  onClick={() => setPreviewPost(post)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>プレビュー</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg"
                                  onClick={() => {
                                    setEditingPost(post)
                                    setNewScheduleDate(new Date(post.scheduled_for).toISOString().slice(0, 16))
                                  }}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>日時変更</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg text-green-600 hover:text-green-700 hover:bg-green-100"
                                  onClick={() => handlePostNow(post)}
                                  disabled={isPosting}
                                >
                                  {isPosting ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Send className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>今すぐ投稿</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeletingPostId(post.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>削除</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground mb-4">
                        この日の予約投稿はありません
                      </p>
                    </div>
                  )}
                  <Button
                    onClick={handleAddNew}
                    className="w-full rounded-xl"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    新規予約を追加
                  </Button>
                </div>
              ) : (
                scheduledPosts.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground mb-2">
                      まだスケジュール投稿がありません
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      生成して予約しよう！
                    </p>
                    <Button onClick={handleAddNew} className="rounded-xl">
                      <Plus className="h-4 w-4 mr-2" />
                      投稿を作成
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      カレンダーから日付を選択してください
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {scheduledPosts.length}件の予約投稿があります
                    </p>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming posts list (mobile-friendly) */}
        <Card className="rounded-2xl border border-border shadow-soft lg:hidden">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              予約一覧
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scheduledPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                まだスケジュール投稿がありません
              </p>
            ) : (
              <div className="space-y-3">
                {scheduledPosts.slice(0, 10).map((post) => (
                  <div
                    key={post.id}
                    className="flex items-start gap-3 p-3 bg-accent/30 rounded-xl"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">{post.text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(post.scheduled_for).toLocaleDateString("ja-JP", {
                          month: "short",
                          day: "numeric",
                          weekday: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-green-600"
                        onClick={() => handlePostNow(post)}
                        disabled={isPosting}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-destructive"
                        onClick={() => setDeletingPostId(post.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Schedule Dialog */}
      <Dialog open={!!editingPost} onOpenChange={(open) => !open && setEditingPost(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>スケジュール変更</DialogTitle>
            <DialogDescription>
              新しい日時を選択してください
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>投稿内容</Label>
              <div className="p-3 bg-accent/50 rounded-xl text-sm line-clamp-3">
                {editingPost?.text}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newScheduleDate">新しい日時</Label>
              <Input
                id="newScheduleDate"
                type="datetime-local"
                value={newScheduleDate}
                onChange={(e) => setNewScheduleDate(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPost(null)} className="rounded-xl">
              キャンセル
            </Button>
            <Button 
              onClick={handleReschedule} 
              disabled={isUpdating || !newScheduleDate}
              className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-500"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              変更する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewPost} onOpenChange={(open) => !open && setPreviewPost(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>投稿プレビュー</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-accent/30 rounded-xl">
              <p className="text-sm whitespace-pre-wrap">{previewPost?.text}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">予定日時:</span>
                <p className="font-medium">
                  {previewPost && new Date(previewPost.scheduled_for).toLocaleString("ja-JP")}
                </p>
              </div>
              {previewPost?.naturalness_score && (
                <div>
                  <span className="text-muted-foreground">自然度スコア:</span>
                  <p className="font-medium">{previewPost.naturalness_score}/100</p>
                </div>
              )}
              {previewPost?.trend && (
                <div>
                  <span className="text-muted-foreground">トレンド:</span>
                  <p className="font-medium">{previewPost.trend}</p>
                </div>
              )}
              {previewPost?.purpose && (
                <div>
                  <span className="text-muted-foreground">目的:</span>
                  <p className="font-medium">{previewPost.purpose}</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewPost(null)} className="rounded-xl">
              閉じる
            </Button>
            <Button 
              onClick={() => {
                if (previewPost) handlePostNow(previewPost)
                setPreviewPost(null)
              }}
              disabled={isPosting}
              className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-500"
            >
              {isPosting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              今すぐ投稿
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPostId} onOpenChange={(open) => !open && setDeletingPostId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>予約投稿を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。予約投稿は完全に削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">キャンセル</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-xl bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
