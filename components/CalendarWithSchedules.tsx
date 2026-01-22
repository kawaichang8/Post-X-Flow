"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Check, X as XIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ScheduledPost {
  id: string
  text: string
  scheduled_for: string
  status?: 'scheduled' | 'posted' | 'error'
}

interface CalendarWithSchedulesProps {
  scheduledPosts: ScheduledPost[]
  currentMonth: Date
  onMonthChange: (date: Date) => void
  onDateClick?: (date: Date) => void
  onPostClick?: (post: ScheduledPost) => void
  className?: string
}

const DAYS_OF_WEEK = ["日", "月", "火", "水", "木", "金", "土"]

export function CalendarWithSchedules({
  scheduledPosts,
  currentMonth,
  onMonthChange,
  onDateClick,
  onPostClick,
  className,
}: CalendarWithSchedulesProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null)

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: (Date | null)[] = []

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }

  const getPostsForDate = (date: Date) => {
    const dateStr = date.toDateString()
    return scheduledPosts.filter(post => {
      const postDate = new Date(post.scheduled_for)
      return postDate.toDateString() === dateStr
    })
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    )
  }

  const goToPreviousMonth = () => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    onMonthChange(newDate)
  }

  const goToNextMonth = () => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    onMonthChange(newDate)
  }

  const goToToday = () => {
    const today = new Date()
    onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(today)
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    onDateClick?.(date)
  }

  const days = getDaysInMonth(currentMonth)
  const monthName = currentMonth.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })

  return (
    <div className={cn("w-full", className)}>
      {/* Header with Navigation */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">投稿カレンダー</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="rounded-full text-xs"
          >
            今日
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPreviousMonth}
              className="h-8 w-8 p-0 rounded-full"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-gray-900 dark:text-white min-w-[120px] text-center">
              {monthName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextMonth}
              className="h-8 w-8 p-0 rounded-full"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-black">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800">
          {DAYS_OF_WEEK.map((day, index) => (
            <div
              key={day}
              className={cn(
                "p-2 text-center text-xs font-medium border-r border-gray-200 dark:border-gray-800 last:border-r-0",
                index === 0 && "text-red-500 dark:text-red-400", // Sunday
                index === 6 && "text-blue-500 dark:text-blue-400" // Saturday
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {days.map((date, index) => {
            if (!date) {
              return (
                <div
                  key={`empty-${index}`}
                  className="min-h-[120px] border-r border-b border-gray-200 dark:border-gray-800 last:border-r-0 bg-gray-50 dark:bg-gray-950"
                />
              )
            }

            const posts = getPostsForDate(date)
            const isTodayDate = isToday(date)
            const isSelected = selectedDate && 
              date.getFullYear() === selectedDate.getFullYear() &&
              date.getMonth() === selectedDate.getMonth() &&
              date.getDate() === selectedDate.getDate()

            // Show max 3 posts, then "+N" for remaining
            const visiblePosts = posts.slice(0, 3)
            const remainingCount = posts.length - 3

            return (
              <div
                key={date.toISOString()}
                onClick={() => handleDateClick(date)}
                className={cn(
                  "min-h-[120px] border-r border-b border-gray-200 dark:border-gray-800 last:border-r-0",
                  "p-2 cursor-pointer transition-colors",
                  "hover:bg-gray-50 dark:hover:bg-gray-900",
                  isSelected && "bg-blue-50 dark:bg-blue-950",
                  isTodayDate && !isSelected && "bg-gray-50 dark:bg-gray-900"
                )}
              >
                {/* Date Number */}
                <div className={cn(
                  "text-sm font-medium mb-1",
                  isTodayDate && "text-blue-600 dark:text-blue-400 font-bold",
                  !isTodayDate && "text-gray-700 dark:text-gray-300"
                )}>
                  {date.getDate()}
                </div>

                {/* Posts List */}
                <div className="space-y-1">
                  {visiblePosts.map((post) => {
                    const postDate = new Date(post.scheduled_for)
                    const timeStr = postDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
                    const status = post.status || 'scheduled'
                    const isSuccess = status === 'posted' || status === 'scheduled'
                    const isError = status === 'error'
                    const shortText = post.text.length > 15 ? post.text.substring(0, 15) + '...' : post.text

                    return (
                      <div
                        key={post.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onPostClick?.(post)
                        }}
                        className={cn(
                          "text-xs p-1.5 rounded cursor-pointer transition-colors",
                          "hover:opacity-80",
                          isSuccess && "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800",
                          isError && "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                        )}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="font-medium">{timeStr}</span>
                          {isSuccess ? (
                            <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                          ) : (
                            <XIcon className="h-3 w-3 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                        <div className="text-xs line-clamp-1">{shortText}</div>
                      </div>
                    )
                  })}
                  {remainingCount > 0 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium pt-1">
                      +{remainingCount}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
