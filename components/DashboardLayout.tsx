"use client"

import { ReactNode, useState, useEffect } from "react"
import { ModernSidebar } from "@/components/ModernSidebar"
import { OnboardingTour, useOnboarding } from "@/components/OnboardingTour"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { TwitterAccount } from "@/app/actions"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DashboardLayoutProps {
  children: ReactNode
  user?: { id: string; email?: string } | null
  twitterConnected?: boolean
  twitterAccounts?: TwitterAccount[]
  selectedAccountId?: string | null
  onConnectTwitter?: () => void
  onSelectAccount?: (accountId: string) => void
  onLogout?: () => void
  activeView?: string
  onNavigate?: (view: string) => void
}

export function DashboardLayout({
  children,
  user,
  twitterConnected,
  twitterAccounts,
  selectedAccountId,
  onConnectTwitter,
  onSelectAccount,
  onLogout,
  activeView,
  onNavigate,
}: DashboardLayoutProps) {
  const { shouldShow: showOnboarding, isLoading: onboardingLoading } = useOnboarding()
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [isDark, setIsDark] = useState(false)

  // Initialize dark mode from system preference or localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("freexboost_theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    
    if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
      setIsDark(true)
      document.documentElement.classList.add("dark")
    }
  }, [])

  // Show onboarding on first load
  useEffect(() => {
    if (!onboardingLoading && showOnboarding) {
      setIsOnboardingOpen(true)
    }
  }, [onboardingLoading, showOnboarding])

  const toggleDarkMode = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    
    if (newIsDark) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("freexboost_theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("freexboost_theme", "light")
    }
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-brand">
        {/* Sidebar */}
        <ModernSidebar
          user={user}
          twitterConnected={twitterConnected}
          twitterAccounts={twitterAccounts}
          selectedAccountId={selectedAccountId}
          onConnectTwitter={onConnectTwitter}
          onSelectAccount={onSelectAccount}
          onLogout={onLogout}
          activeView={activeView}
          onNavigate={onNavigate}
        />

        {/* Main Content */}
        <main className="lg:pl-64 min-h-screen transition-all duration-300">
          {/* Top Bar */}
          <div className="sticky top-0 z-30 bg-card/80 backdrop-blur-lg border-b border-border">
            <div className="flex items-center justify-between px-4 lg:px-6 py-3">
              <div className="flex-1" />
              
              {/* Dark Mode Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                className="h-9 w-9 rounded-xl"
              >
                {isDark ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Page Content */}
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>

        {/* Onboarding Tour */}
        {isOnboardingOpen && (
          <OnboardingTour
            onComplete={() => setIsOnboardingOpen(false)}
            isOpen={isOnboardingOpen}
          />
        )}
      </div>
    </TooltipProvider>
  )
}
