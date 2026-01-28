"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { 
  Home,
  FileText, 
  Calendar, 
  BarChart3, 
  Settings, 
  HelpCircle, 
  LogOut,
  Menu,
  X,
  Plus,
  User,
  Users,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { TwitterAccount } from "@/app/actions"

interface ModernSidebarProps {
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

export function ModernSidebar({
  user,
  twitterConnected,
  twitterAccounts = [],
  selectedAccountId,
  onConnectTwitter,
  onSelectAccount,
  onLogout,
  activeView = "create",
  onNavigate,
}: ModernSidebarProps) {
  const router = useRouter()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  
  const selectedAccount = twitterAccounts.find(acc => acc.id === selectedAccountId) || twitterAccounts.find(acc => acc.is_default)

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false)
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const handleNavClick = (view: string) => {
    if (onNavigate) {
      onNavigate(view)
    }
    setIsMobileOpen(false)
  }

  const mainNavItems = [
    {
      id: "create",
      label: "ホーム",
      icon: Home,
      description: "投稿を作成",
    },
    {
      id: "history",
      label: "投稿",
      icon: FileText,
      description: "投稿履歴を表示",
    },
    {
      id: "scheduled",
      label: "カレンダー",
      icon: Calendar,
      description: "スケジュール管理",
    },
    {
      id: "analytics",
      label: "分析",
      icon: BarChart3,
      description: "パフォーマンス分析",
    },
    {
      id: "community",
      label: "コミュニティ",
      icon: Users,
      description: "テンプレート共有",
    },
  ]

  const bottomNavItems = [
    {
      id: "settings",
      label: "設定",
      icon: Settings,
      onClick: () => router.push("/settings"),
    },
    {
      id: "help",
      label: "ヘルプ",
      icon: HelpCircle,
      onClick: () => router.push("/help"),
    },
  ]

  const NavItem = ({ item, isBottom = false }: { item: typeof mainNavItems[0] | typeof bottomNavItems[0]; isBottom?: boolean }) => {
    const Icon = item.icon
    const isActive = !isBottom && activeView === item.id
    const onClick = isBottom ? (item as typeof bottomNavItems[0]).onClick : () => handleNavClick(item.id)

    const button = (
      <button
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200",
          isCollapsed ? "justify-center p-3" : "px-4 py-3",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-foreground hover:scale-105"
        )}
      >
        <Icon className={cn("shrink-0", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
      </button>
    )

    if (isCollapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.label}
          </TooltipContent>
        </Tooltip>
      )
    }

    return button
  }

  return (
    <TooltipProvider>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="bg-card border border-border rounded-xl shadow-soft h-10 w-10"
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
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full bg-card border-r border-border z-40 transition-all duration-300 flex flex-col",
          isCollapsed ? "w-[72px]" : "w-64",
          "lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo/Header */}
        <div className={cn(
          "flex items-center border-b border-border shrink-0",
          isCollapsed ? "justify-center p-4" : "justify-between px-4 py-4"
        )}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-lg">FreeXBoost</span>
              </div>
              <button
                onClick={() => setIsCollapsed(true)}
                className="hidden lg:flex p-1.5 rounded-lg hover:bg-accent transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <button
                onClick={() => setIsCollapsed(false)}
                className="hidden lg:flex p-1.5 rounded-lg hover:bg-accent transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {mainNavItems.map((item) => (
            <NavItem key={item.id} item={item} />
          ))}
        </nav>

        {/* Twitter Account Selection */}
        {twitterConnected && twitterAccounts.length > 0 && !isCollapsed && (
          <div className="p-3 border-t border-border">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2 block">
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
              <SelectTrigger className="w-full h-10 rounded-xl bg-accent/50 border-0 text-sm">
                <div className="flex items-center gap-2">
                  {selectedAccount?.profile_image_url ? (
                    <img
                      src={selectedAccount.profile_image_url}
                      alt={selectedAccount.username || ""}
                      className="h-5 w-5 rounded-full"
                    />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                  <SelectValue>
                    {selectedAccount?.account_name || selectedAccount?.username || "選択"}
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {twitterAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id} className="rounded-lg">
                    <div className="flex items-center gap-2">
                      {account.profile_image_url ? (
                        <img
                          src={account.profile_image_url}
                          alt={account.username || ""}
                          className="h-5 w-5 rounded-full"
                        />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                      <span>{account.account_name || account.username || "無名"}</span>
                      {account.is_default && (
                        <span className="text-xs text-muted-foreground">(デフォルト)</span>
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
                className="w-full mt-2 rounded-xl text-xs h-9"
                size="sm"
              >
                <Plus className="h-3 w-3 mr-1.5" />
                アカウント追加
              </Button>
            )}
          </div>
        )}

        {/* Collapsed Account Icon */}
        {twitterConnected && twitterAccounts.length > 0 && isCollapsed && (
          <div className="p-3 border-t border-border flex justify-center">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <button className="p-2 rounded-xl hover:bg-accent transition-colors">
                  {selectedAccount?.profile_image_url ? (
                    <img
                      src={selectedAccount.profile_image_url}
                      alt={selectedAccount.username || ""}
                      className="h-6 w-6 rounded-full"
                    />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {selectedAccount?.account_name || selectedAccount?.username || "アカウント"}
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Twitter Connection */}
        {!twitterConnected && onConnectTwitter && (
          <div className={cn("p-3 border-t border-border", isCollapsed && "flex justify-center")}>
            {isCollapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onConnectTwitter}
                    className="w-10 h-10 p-0 rounded-xl bg-primary hover:bg-primary/90"
                    size="icon"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">X連携</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                onClick={onConnectTwitter}
                className="w-full rounded-xl bg-primary hover:bg-primary/90 font-medium"
              >
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                X連携
              </Button>
            )}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="p-3 border-t border-border space-y-1 shrink-0">
          {bottomNavItems.map((item) => (
            <NavItem key={item.id} item={item} isBottom />
          ))}
          
          {/* User Avatar & Logout */}
          {user && (
            <div className={cn(
              "flex items-center gap-3 mt-3 pt-3 border-t border-border",
              isCollapsed && "justify-center"
            )}>
              {!isCollapsed ? (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {user.email?.split("@")[0] || "ユーザー"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                  {onLogout && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onLogout}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  )}
                </>
              ) : (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onLogout}
                      className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
                    >
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">ログアウト</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
