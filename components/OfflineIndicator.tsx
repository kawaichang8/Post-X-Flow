"use client"

import { useState, useEffect } from "react"
import { WifiOff, Wifi } from "lucide-react"
import { setupOnlineStatusListener } from "@/lib/pwa-installer"
import { cn } from "@/lib/utils"

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const cleanup = setupOnlineStatusListener((online) => {
      setIsOnline(online)
    })

    return cleanup
  }, [])

  if (isOnline) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white px-4 py-2 text-sm text-center flex items-center justify-center gap-2 animate-slide-down">
      <WifiOff className="h-4 w-4" />
      <span>オフラインです。下書きは自動的に保存されます。</span>
    </div>
  )
}
