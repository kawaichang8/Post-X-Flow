"use client"

import { cn } from "@/lib/utils"

interface ProgressBarProps {
  value: number // 0-100
  max?: number
  className?: string
  showLabel?: boolean
  label?: string
  size?: "sm" | "md" | "lg"
  variant?: "default" | "success" | "warning" | "error"
}

export function ProgressBar({
  value,
  max = 100,
  className,
  showLabel = true,
  label,
  size = "md",
  variant = "default",
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  
  const sizeClasses = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  }
  
  const variantClasses = {
    default: "bg-blue-500",
    success: "bg-green-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
  }

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {label || `${Math.round(percentage)}%`}
          </span>
          {label && (
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          "w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden",
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            "h-full transition-all duration-300 ease-out rounded-full",
            variantClasses[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  }

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-gray-300 border-t-blue-500",
        sizeClasses[size],
        className
      )}
    />
  )
}

interface LoadingOverlayProps {
  isLoading: boolean
  message?: string
  progress?: number
}

export function LoadingOverlay({ isLoading, message, progress }: LoadingOverlayProps) {
  if (!isLoading) return null

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
        <div className="flex flex-col items-center space-y-4">
          <LoadingSpinner size="lg" />
          {message && (
            <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
              {message}
            </p>
          )}
          {progress !== undefined && (
            <ProgressBar
              value={progress}
              size="sm"
              className="w-full"
              showLabel={false}
            />
          )}
        </div>
      </div>
    </div>
  )
}
