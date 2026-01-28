"use client"

import { useState, useMemo } from "react"
import Calendar from "react-calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
} from "lucide-react"
import "react-calendar/dist/Calendar.css"

interface ScheduledPost {
  id: string
  content: string
  scheduled_for: Date
  status: "pending" | "posted" | "failed"
}

interface EnhancedCalendarProps {
  scheduledPosts: ScheduledPost[]
  onDateSelect: (date: Date) => void
  onPostSelect: (post: ScheduledPost) => void
  onDeletePost: (id: string) => void
  onEditPost: (post: ScheduledPost) => void
  onAddNew: (date: Date) => void
}

export function EnhancedCalendar({
  scheduledPosts,
  onDateSelect,
  onPostSelect,
  onDeletePost,
  onEditPost,
  onAddNew,
}: EnhancedCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [currentView, setCurrentView] = useState<Date>(new Date())

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
    onDateSelect(date)
  }

  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view !== "month") return ""
    
    const posts = getPostsForDate(date)
    if (posts.length > 0) {
      const hasPending = posts.some(p => p.status === "pending")
      const hasPosted = posts.some(p => p.status === "posted")
      const hasFailed = posts.some(p => p.status === "failed")
      
      if (hasFailed) return "calendar-cell-failed"
      if (hasPending) return "calendar-cell-scheduled"
      if (hasPosted) return "calendar-cell-posted"
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

  const selectedDatePosts = selectedDate ? getPostsForDate(selectedDate) : []

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2 rounded-2xl border border-border shadow-soft overflow-hidden">
          <CardHeader className="border-b border-border bg-gradient-to-r from-green-50 to-white dark:from-green-950/30 dark:to-card">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarIcon className="h-5 w-5 text-primary" />
                スケジュールカレンダー
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
                <span className="text-sm font-medium min-w-[120px] text-center">
                  {currentView.toLocaleDateString("ja-JP", {
                    year: "numeric",
                    month: "long",
                  })}
                </span>
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
              .calendar-cell-posted {
                background: hsl(142 76% 36% / 0.3) !important;
              }
              .calendar-cell-failed {
                background: hsl(0 84% 60% / 0.15) !important;
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
                        className="group p-3 bg-accent/50 rounded-xl space-y-2 cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => onPostSelect(post)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm line-clamp-2 flex-1">
                            {post.content}
                          </p>
                          <Badge
                            variant={
                              post.status === "posted"
                                ? "default"
                                : post.status === "failed"
                                ? "destructive"
                                : "secondary"
                            }
                            className="shrink-0 text-xs"
                          >
                            {post.status === "posted"
                              ? "投稿済"
                              : post.status === "failed"
                              ? "失敗"
                              : "予約中"}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {new Date(post.scheduled_for).toLocaleTimeString(
                              "ja-JP",
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onEditPost(post)
                                  }}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>編集</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onDeletePost(post.id)
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>削除</TooltipContent>
                            </Tooltip>
                          </div>
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
                  onClick={() => onAddNew(selectedDate)}
                  className="w-full rounded-xl"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  新規予約を追加
                </Button>
              </div>
            ) : (
              <div className="text-center py-12">
                <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  カレンダーから日付を選択してください
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
