"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorClassName?: string
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        "h-full w-full flex-1 transition-all duration-500 ease-out",
        indicatorClassName
      )}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

// Naturalness Score Progress Component
interface NaturalnessScoreProps {
  score: number
  showLabel?: boolean
  size?: "sm" | "md" | "lg"
}

const NaturalnessScore = React.forwardRef<HTMLDivElement, NaturalnessScoreProps>(
  ({ score, showLabel = true, size = "md" }, ref) => {
    const getScoreColor = (score: number) => {
      if (score >= 80) return "bg-green-500"
      if (score >= 60) return "bg-emerald-500"
      if (score >= 40) return "bg-yellow-500"
      return "bg-red-500"
    }

    const getScoreLabel = (score: number) => {
      if (score >= 80) return "自然"
      if (score >= 60) return "良好"
      if (score >= 40) return "普通"
      return "要改善"
    }

    const sizeClasses = {
      sm: "h-1.5",
      md: "h-2",
      lg: "h-3",
    }

    return (
      <div ref={ref} className="space-y-1.5">
        {showLabel && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">自然さスコア</span>
            <span
              className={cn(
                "font-medium",
                score >= 80
                  ? "text-green-600 dark:text-green-400"
                  : score >= 60
                  ? "text-emerald-600 dark:text-emerald-400"
                  : score >= 40
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {score}点 ({getScoreLabel(score)})
            </span>
          </div>
        )}
        <Progress
          value={score}
          className={cn("bg-muted", sizeClasses[size])}
          indicatorClassName={getScoreColor(score)}
        />
      </div>
    )
  }
)
NaturalnessScore.displayName = "NaturalnessScore"

export { Progress, NaturalnessScore }
