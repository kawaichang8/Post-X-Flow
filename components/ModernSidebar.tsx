"use client"

import { useRouter, usePathname } from "next/navigation"
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
  Sparkles,
  Crown,
  Zap,
  Megaphone,
  Quote
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
  // Subscription props
  isPro?: boolean
  isTrialActive?: boolean
  trialDaysRemaining?: number
  onUpgrade?: () => void
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
  isPro = false,
  isTrialActive = false,
  trialDaysRemaining = 0,
  onUpgrade,
}: ModernSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("sidebar_collapsed") === "true"
  })

  const selectedAccount = twitterAccounts.find(acc => acc.id === selectedAccountId) || twitterAccounts.find(acc => acc.is_default)

  // Sync CSS variable --sidebar-width so main content margin matches (collapsed 80px, expanded 280px on lg+)
  useEffect(() => {
    const updateWidth = () => {
      const isLg = typeof window !== "undefined" && window.innerWidth >= 1024
      const w = isLg ? (isCollapsed ? "80px" : "280px") : "5rem"
      document.documentElement.style.setProperty("--sidebar-width", w)
    }
    updateWidth()
    window.addEventListener("resize", updateWidth)
    return () => window.removeEventListener("resize", updateWidth)
  }, [isCollapsed])

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
    if (view === "analytics") {
      router.push("/analytics")
    } else if (onNavigate) {
      onNavigate(view)
    }
    setIsMobileOpen(false)
  }

  // 上段に一本化: ダッシュボード用は onNavigate、外部ページ用は path で router.push
  type NavItemType = {
    id: string
    label: string
    icon: typeof Home
    path?: string
  }
  const allNavItems: NavItemType[] = [
    { id: "create", label: "ホーム", icon: Home },
    { id: "history", label: "投稿", icon: FileText },
    { id: "scheduled", label: "カレンダー", icon: Calendar },
    { id: "analytics", label: "分析", icon: BarChart3, path: "/analytics" },
    { id: "community", label: "コミュニティ", icon: Users },
    { id: "inspiration", label: "インスピレーション", icon: Quote, path: "/inspiration" },
    { id: "promotion", label: "宣伝設定", icon: Megaphone, path: "/settings/promotion" },
    { id: "settings", label: "設定", icon: Settings, path: "/settings" },
    { id: "help", label: "ヘルプ", icon: HelpCircle, path: "/help" },
  ]

  const NavItem = ({ item }: { item: NavItemType }) => {
    const Icon = item.icon
    const isActive = item.path ? pathname === item.path : activeView === item.id
    const onClick = () => {
      if (item.path) {
        router.push(item.path)
      } else {
        handleNavClick(item.id)
      }
      setIsMobileOpen(false)
    }

    const button = (
      <button
        onClick={onClick}
        className={cn(
          "w-full flex items-center gap-3 rounded-2xl text-sm font-medium transition-all duration-300 group",
          isCollapsed ? "justify-center p-3.5" : "px-4 py-3.5",
          isActive
            ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25 glow-ring-green"
            : "text-muted-foreground hover:bg-accent/80 hover:text-foreground hover:scale-[1.02] hover:shadow-soft"
        )}
      >
        <Icon className={cn(
          "shrink-0 transition-transform duration-300",
          isCollapsed ? "h-5 w-5" : "h-[18px] w-[18px]",
          !isActive && "group-hover:scale-110"
        )} />
        {!isCollapsed && (
          <span className="truncate">{item.label}</span>
        )}
      </button>
    )

    if (isCollapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium rounded-xl px-3 py-2">
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
          "fixed left-0 top-0 h-full sidebar-glass border-r border-border/50 z-40 transition-all duration-300 flex flex-col",
          isCollapsed ? "w-[80px]" : "w-[280px]",
          "lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo/Header - Premium */}
        <div className={cn(
          "flex items-center border-b border-border/50 shrink-0",
          isCollapsed ? "justify-center p-4" : "justify-between px-5 py-5"
        )}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-400 via-green-500 to-emerald-600 flex items-center justify-center logo-glow">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <span className="font-bold text-lg bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">postXflow</span>
                  <p className="text-[10px] text-muted-foreground -mt-0.5">X Growth Automation</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCollapsed(true)
                  typeof window !== "undefined" && localStorage.setItem("sidebar_collapsed", "true")
                }}
                className="hidden lg:flex p-2 rounded-xl hover:bg-accent/80 transition-all duration-200 hover:scale-105"
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 via-green-500 to-emerald-600 flex items-center justify-center logo-glow">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <button
                onClick={() => {
                  setIsCollapsed(false)
                  typeof window !== "undefined" && localStorage.setItem("sidebar_collapsed", "false")
                }}
                className="hidden lg:flex p-2 rounded-xl hover:bg-accent/80 transition-all duration-200 hover:scale-105"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation（分析・インスピレーション・宣伝設定・設定・ヘルプも上段に統一） */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {allNavItems.map((item) => (
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

        {/* Upgrade Button for Free Users */}
        {!isPro && onUpgrade && (
          <div className={cn("p-3 border-t border-border", isCollapsed && "flex justify-center")}>
            {isCollapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    onClick={onUpgrade}
                    className="w-10 h-10 p-0 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    size="icon"
                  >
                    <Crown className="h-5 w-5 text-white" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
                  {isTrialActive ? `トライアル残り${trialDaysRemaining}日` : "Proにアップグレード"}
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {isTrialActive ? "トライアル中" : "無料プラン"}
                  </span>
                </div>
                {isTrialActive && (
                  <p className="text-xs text-muted-foreground mb-3">
                    残り{trialDaysRemaining}日
                  </p>
                )}
                <Button
                  onClick={onUpgrade}
                  size="sm"
                  className="w-full h-8 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-medium"
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Proにアップグレード
                </Button>
              </div>
            )}
          </div>
        )}

        {/* User Avatar & Logout */}
        <div className="p-3 border-t border-border shrink-0">
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
