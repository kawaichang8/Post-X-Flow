"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  MessageSquare, 
  Calendar, 
  BarChart3,
  CheckCircle2
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface TourStep {
  id: string
  title: string
  description: string
  icon: typeof Sparkles
  highlight?: string // CSS selector or element id
  position?: "top" | "bottom" | "left" | "right"
}

const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "FreeXBoostへようこそ！",
    description: "AIを活用してX（Twitter）の投稿を効率的に作成・管理できます。簡単なツアーで使い方をご紹介します。",
    icon: Sparkles,
  },
  {
    id: "trend",
    title: "トレンドを入力",
    description: "投稿に関連するトレンドやキーワードを入力してください。例：「#日曜劇場リブート」「AIトレンド」など",
    icon: MessageSquare,
    highlight: "trend-input",
    position: "bottom",
  },
  {
    id: "purpose",
    title: "投稿の目的を選択",
    description: "情報発信、ファン向け、プロモーションなど、目的に合わせた投稿を生成できます。",
    icon: MessageSquare,
    highlight: "purpose-select",
    position: "bottom",
  },
  {
    id: "generate",
    title: "AIで投稿を生成",
    description: "「生成する」ボタンをクリックすると、AIが3つの投稿案を自動生成します。各投稿は編集可能です。",
    icon: Sparkles,
    highlight: "generate-button",
    position: "top",
  },
  {
    id: "schedule",
    title: "スケジュール投稿",
    description: "カレンダーから投稿日時を設定して、最適なタイミングで自動投稿できます。",
    icon: Calendar,
    highlight: "calendar-nav",
    position: "right",
  },
  {
    id: "analytics",
    title: "分析機能",
    description: "投稿のパフォーマンスを分析し、より効果的な投稿戦略を立てましょう。",
    icon: BarChart3,
    highlight: "analytics-nav",
    position: "right",
  },
  {
    id: "complete",
    title: "準備完了！",
    description: "これで基本操作は完了です。さっそくAIを使って投稿を作成してみましょう！",
    icon: CheckCircle2,
  },
]

interface OnboardingTourProps {
  onComplete: () => void
  isOpen?: boolean
}

export function OnboardingTour({ onComplete, isOpen = true }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isVisible, setIsVisible] = useState(isOpen)

  const step = tourSteps[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === tourSteps.length - 1
  const Icon = step.icon

  const handleNext = useCallback(() => {
    if (isLast) {
      handleComplete()
    } else {
      setCurrentStep((prev) => prev + 1)
    }
  }, [isLast])

  const handlePrevious = () => {
    if (!isFirst) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleComplete = () => {
    setIsVisible(false)
    localStorage.setItem("freexboost_onboarding_completed", "true")
    onComplete()
  }

  const handleSkip = () => {
    handleComplete()
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return
      if (e.key === "ArrowRight" || e.key === "Enter") handleNext()
      if (e.key === "ArrowLeft") handlePrevious()
      if (e.key === "Escape") handleSkip()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isVisible, handleNext])

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100]"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        {/* Tour Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="absolute inset-0 flex items-center justify-center p-4"
        >
          <div className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden">
            {/* Close button */}
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-accent transition-colors z-10"
              aria-label="ツアーをスキップ"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Progress indicator */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Content */}
            <div className="p-8 pt-10">
              {/* Icon */}
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex justify-center mb-6"
              >
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center",
                  "bg-gradient-to-br from-green-500 to-emerald-600"
                )}>
                  <Icon className="h-8 w-8 text-white" />
                </div>
              </motion.div>

              {/* Title */}
              <motion.h2
                key={`title-${step.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="text-xl font-bold text-center mb-3"
              >
                {step.title}
              </motion.h2>

              {/* Description */}
              <motion.p
                key={`desc-${step.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="text-muted-foreground text-center leading-relaxed"
              >
                {step.description}
              </motion.p>

              {/* Step indicators */}
              <div className="flex justify-center gap-1.5 mt-6">
                {tourSteps.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentStep(index)}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all duration-200",
                      index === currentStep
                        ? "bg-primary w-6"
                        : index < currentStep
                        ? "bg-primary/50"
                        : "bg-muted"
                    )}
                    aria-label={`ステップ ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="px-8 pb-8 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={handlePrevious}
                disabled={isFirst}
                className="rounded-xl"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                戻る
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  className="text-muted-foreground rounded-xl"
                >
                  スキップ
                </Button>
                <Button
                  onClick={handleNext}
                  className="rounded-xl bg-primary hover:bg-primary/90"
                >
                  {isLast ? "始める" : "次へ"}
                  {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Hook to check if onboarding should be shown
export function useOnboarding() {
  const [shouldShow, setShouldShow] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const completed = localStorage.getItem("freexboost_onboarding_completed")
    setShouldShow(!completed)
    setIsLoading(false)
  }, [])

  const resetOnboarding = () => {
    localStorage.removeItem("freexboost_onboarding_completed")
    setShouldShow(true)
  }

  return { shouldShow, isLoading, resetOnboarding }
}
