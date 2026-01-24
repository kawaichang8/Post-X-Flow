"use client"

import { useState, useEffect } from "react"
import { AlertCircle, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface ErrorInfo {
  message: string
  retryable?: boolean
  retryAfter?: number // seconds
  onRetry?: () => void | Promise<void>
}

interface ErrorDisplayProps {
  error: ErrorInfo | null
  onDismiss?: () => void
  className?: string
}

export function ErrorDisplay({ error, onDismiss, className }: ErrorDisplayProps) {
  const [countdown, setCountdown] = useState<number | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    if (error?.retryAfter && error.retryable) {
      setCountdown(error.retryAfter)
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(interval)
            return null
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(interval)
    } else {
      setCountdown(null)
    }
  }, [error?.retryAfter, error?.retryable])

  if (!error) return null

  const handleRetry = async () => {
    if (!error.onRetry || isRetrying) return

    setIsRetrying(true)
    try {
      await error.onRetry()
    } finally {
      setIsRetrying(false)
    }
  }

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return `${mins}分${secs}秒`
    }
    return `${secs}秒`
  }

  return (
    <Card className={cn("border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <CardTitle className="text-lg text-red-900 dark:text-red-100">
              エラーが発生しました
            </CardTitle>
          </div>
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <CardDescription className="text-red-800 dark:text-red-200">
          {error.message}
        </CardDescription>

        {error.retryable && error.onRetry && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying || (countdown !== null && countdown > 0)}
              className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900"
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isRetrying && "animate-spin")} />
              {isRetrying ? "再試行中..." : countdown !== null && countdown > 0 ? `再試行まで ${formatCountdown(countdown)}` : "再試行"}
            </Button>
            {countdown !== null && countdown > 0 && (
              <span className="text-sm text-red-600 dark:text-red-400">
                自動的に再試行します...
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
