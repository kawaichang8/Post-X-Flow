"use client"

import * as React from "react"
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export type ToastType = "success" | "error" | "info" | "warning"

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastProps {
  toast: Toast
  onClose: (id: string) => void
}

const ToastIcon = ({ type }: { type: ToastType }) => {
  const iconClass = "h-5 w-5"
  switch (type) {
    case "success":
      return <CheckCircle2 className={cn(iconClass, "text-green-600")} />
    case "error":
      return <AlertCircle className={cn(iconClass, "text-red-600")} />
    case "warning":
      return <AlertTriangle className={cn(iconClass, "text-yellow-600")} />
    case "info":
      return <Info className={cn(iconClass, "text-blue-600")} />
  }
}

export function ToastComponent({ toast, onClose }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id)
    }, toast.duration || 5000)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onClose])

  const bgColor = {
    success: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
    error: "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800",
    warning: "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800",
    info: "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
  }

  const textColor = {
    success: "text-green-800 dark:text-green-200",
    error: "text-red-800 dark:text-red-200",
    warning: "text-yellow-800 dark:text-yellow-200",
    info: "text-blue-800 dark:text-blue-200",
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg border shadow-lg min-w-[300px] max-w-md animate-in slide-in-from-top-5",
        bgColor[toast.type]
      )}
      role="alert"
    >
      <ToastIcon type={toast.type} />
      <p className={cn("flex-1 text-sm font-medium", textColor[toast.type])}>
        {toast.message}
      </p>
      <button
        onClick={() => onClose(toast.id)}
        className={cn(
          "p-1 rounded-md hover:bg-black/10 transition-colors",
          textColor[toast.type]
        )}
        aria-label="閉じる"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onClose: (id: string) => void
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastComponent toast={toast} onClose={onClose} />
        </div>
      ))}
    </div>
  )
}

// Toast context and hook
interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const showToast = React.useCallback(
    (message: string, type: ToastType = "info", duration?: number) => {
      const id = Math.random().toString(36).substring(2, 9)
      setToasts((prev) => [...prev, { id, message, type, duration }])
    },
    []
  )

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}
