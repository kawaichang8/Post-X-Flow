"use client"

import { ReactNode } from "react"
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Lock, Crown } from "lucide-react"

interface ProFeatureLockProps {
  children: ReactNode
  isLocked: boolean
  featureName?: string
  className?: string
  showBadge?: boolean
  showOverlay?: boolean
}

export function ProFeatureLock({
  children,
  isLocked,
  featureName = "この機能",
  className,
  showBadge = true,
  showOverlay = true,
}: ProFeatureLockProps) {
  if (!isLocked) {
    return <>{children}</>
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div className={cn("relative", className)}>
            {/* Locked overlay */}
            {showOverlay && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] rounded-inherit z-10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            
            {/* Pro badge */}
            {showBadge && (
              <Badge 
                variant="secondary"
                className="absolute -top-2 -right-2 z-20 px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0"
              >
                <Crown className="h-2.5 w-2.5 mr-0.5" />
                PRO
              </Badge>
            )}
            
            {/* Original content (grayed out) */}
            <div className={cn(
              "pointer-events-none select-none",
              showOverlay ? "opacity-50 grayscale" : "opacity-60"
            )}>
              {children}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="rounded-xl px-4 py-3 bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0"
        >
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4" />
            <span className="font-medium">{featureName}はProプランで利用可能</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Wrapper for locked buttons
interface ProButtonProps {
  children: ReactNode
  isLocked: boolean
  featureName?: string
  onClick?: () => void
  className?: string
}

export function ProButton({
  children,
  isLocked,
  featureName = "この機能",
  onClick,
  className,
}: ProButtonProps) {
  if (!isLocked) {
    return (
      <div className={className} onClick={onClick}>
        {children}
      </div>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "relative cursor-not-allowed",
              className
            )}
          >
            <div className="pointer-events-none opacity-50 grayscale">
              {children}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Badge 
                variant="secondary"
                className="px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0"
              >
                <Lock className="h-2.5 w-2.5 mr-1" />
                PRO
              </Badge>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="rounded-xl px-4 py-3 bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0"
        >
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4" />
            <span className="font-medium">{featureName}はProプランで利用可能</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Usage limit warning
interface UsageLimitWarningProps {
  remaining: number
  limit: number
  type?: "generation" | "media"
}

export function UsageLimitWarning({ remaining, limit, type = "generation" }: UsageLimitWarningProps) {
  if (remaining > 1 || limit === Infinity) return null

  const labels = {
    generation: "生成",
    media: "メディアアップロード",
  }

  return (
    <div className={cn(
      "flex items-center gap-2 p-3 rounded-xl border text-sm",
      remaining === 0 
        ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300"
        : "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800/50 text-yellow-700 dark:text-yellow-300"
    )}>
      {remaining === 0 ? (
        <>
          <Lock className="h-4 w-4 shrink-0" />
          <span>本日の{labels[type]}上限に達しました。明日またはProプランでお試しください。</span>
        </>
      ) : (
        <>
          <Crown className="h-4 w-4 shrink-0" />
          <span>残り{remaining}回の{labels[type]}が可能です。</span>
        </>
      )}
    </div>
  )
}
