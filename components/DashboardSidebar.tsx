"use client"

import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { 
  History, 
  Clock, 
  BarChart3, 
  Settings, 
  HelpCircle, 
  Twitter,
  LogOut,
  Menu,
  X,
  Plus,
  ChevronDown,
  User,
  Check,
  FileText,
  Bookmark,
  MessageSquare,
  Lightbulb,
  BookOpen,
  Users
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TwitterAccount } from "@/app/actions"

interface DashboardSidebarProps {
  user?: { id: string; email?: string } | null
  twitterConnected?: boolean
  twitterAccounts?: TwitterAccount[]
  selectedAccountId?: string | null
  onConnectTwitter?: () => void
  onSelectAccount?: (accountId: string) => void
  onLogout?: () => void
  showHistory?: boolean
  showScheduled?: boolean
  showAnalytics?: boolean
  showCreate?: boolean
  showDrafts?: boolean
  showQuotedTweets?: boolean
  showTrends?: boolean
  showAccounts?: boolean
  showCommunity?: boolean
  onNavigate?: (path: string) => void
}

export function DashboardSidebar({
  user,
  twitterConnected,
  twitterAccounts = [],
  selectedAccountId,
  onConnectTwitter,
  onSelectAccount,
  onLogout,
  showHistory,
  showScheduled,
  showAnalytics,
  showCreate,
  showDrafts,
  showQuotedTweets,
  showTrends,
  showAccounts,
  showCommunity,
  onNavigate,
}: DashboardSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  
  const selectedAccount = twitterAccounts.find(acc => acc.id === selectedAccountId) || twitterAccounts.find(acc => acc.is_default)

  const handleNavClick = (onClick: () => void) => {
    onClick()
    setIsMobileOpen(false)
  }

  const navItems = [
    {
      id: "create",
      label: "ツイート",
      icon: Plus,
      onClick: () => {
        if (onNavigate) {
          onNavigate("create")
        } else {
          router.push("/dashboard?view=create")
        }
      },
      active: showCreate,
    },
    {
      id: "history",
      label: "履歴",
      icon: FileText,
      onClick: () => {
        if (onNavigate) {
          onNavigate("history")
        } else {
          router.push("/dashboard?view=history")
        }
      },
      active: showHistory,
    },
    {
      id: "scheduled",
      label: "スケジュール",
      icon: Clock,
      onClick: () => {
        if (onNavigate) {
          onNavigate("scheduled")
        } else {
          router.push("/dashboard?view=scheduled")
        }
      },
      active: showScheduled,
    },
    {
      id: "drafts",
      label: "下書き",
      icon: Bookmark,
      onClick: () => {
        if (onNavigate) {
          onNavigate("drafts")
        } else {
          router.push("/dashboard?view=drafts")
        }
      },
      active: showDrafts,
    },
    {
      id: "quoted",
      label: "引用ツイート",
      icon: MessageSquare,
      onClick: () => {
        if (onNavigate) {
          onNavigate("quoted")
        } else {
          router.push("/dashboard?view=quoted")
        }
      },
      active: showQuotedTweets,
    },
    {
      id: "trends",
      label: "トレンド",
      icon: Lightbulb,
      onClick: () => {
        if (onNavigate) {
          onNavigate("trends")
        } else {
          router.push("/dashboard?view=trends")
        }
      },
      active: showTrends,
    },
    {
      id: "analytics",
      label: "分析",
      icon: BarChart3,
      onClick: () => {
        if (onNavigate) {
          onNavigate("analytics")
        } else {
          router.push("/dashboard?view=analytics")
        }
      },
      active: showAnalytics,
    },
    {
      id: "accounts",
      label: "アカウント",
      icon: User,
      onClick: () => {
        if (onNavigate) {
          onNavigate("accounts")
        } else {
          router.push("/dashboard?view=accounts")
        }
      },
      active: showAccounts,
    },
    {
      id: "community",
      label: "コミュニティ",
      icon: Users,
      onClick: () => {
        if (onNavigate) {
          onNavigate("community")
        } else {
          router.push("/dashboard?view=community")
        }
      },
      active: showCommunity,
    },
  ]

  const bottomItems = [
    {
      id: "help",
      label: "ヘルプ",
      icon: BookOpen,
      onClick: () => {
        router.push("/help")
        setIsMobileOpen(false)
      },
    },
    {
      id: "settings",
      label: "設定",
      icon: Settings,
      onClick: () => {
        router.push("/settings")
        setIsMobileOpen(false)
      },
    },
  ]

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-full shadow-sm"
        >
          {isMobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-56 bg-white dark:bg-black border-r border-gray-200 dark:border-gray-800 z-40 transition-transform duration-300",
          "lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Post-X-Flow
            </h2>
            {user?.email && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                {user.email}
              </p>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.onClick)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    item.active
                      ? "bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-950"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Twitter Account Selection */}
          {twitterConnected && twitterAccounts.length > 0 && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-800">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
                  アカウント
                </label>
                <Select
                  value={selectedAccountId || selectedAccount?.id || ""}
                  onValueChange={(value) => {
                    if (onSelectAccount) {
                      onSelectAccount(value)
                    }
                  }}
                >
                  <SelectTrigger className="w-full h-9 text-xs bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      {selectedAccount?.profile_image_url ? (
                        <img
                          src={selectedAccount.profile_image_url}
                          alt={selectedAccount.username || ""}
                          className="h-4 w-4 rounded-full"
                        />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                      <SelectValue>
                        {selectedAccount?.account_name || selectedAccount?.username || "アカウントを選択"}
                      </SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {twitterAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          {account.profile_image_url ? (
                            <img
                              src={account.profile_image_url}
                              alt={account.username || ""}
                              className="h-4 w-4 rounded-full"
                            />
                          ) : (
                            <User className="h-4 w-4" />
                          )}
                          <span>{account.account_name || account.username || "無名"}</span>
                          {account.is_default && (
                            <span className="text-xs text-gray-500">(デフォルト)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {onConnectTwitter && (
                  <Button
                    onClick={onConnectTwitter}
                    variant="outline"
                    className="w-full text-xs py-1.5 h-8"
                    size="sm"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    アカウント追加
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Twitter Connection */}
          {!twitterConnected && onConnectTwitter && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-800">
              <Button
                onClick={onConnectTwitter}
                className="w-full bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-semibold text-xs py-2"
                size="sm"
              >
                <Twitter className="h-3.5 w-3.5 mr-1.5" />
                X連携
              </Button>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-0.5">
            {bottomItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors"
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              )
            })}
            {onLogout && (
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>ログアウト</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
