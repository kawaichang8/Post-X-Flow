"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { User, Bell, Shield, Trash2, Megaphone } from "lucide-react"
import { useToast } from "@/components/ui/toast"

interface User {
  id: string
  email?: string
}

export default function SettingsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push("/")
      return
    }
    setUser(session.user as User)
    setIsLoading(false)
  }

  const handleDisconnectTwitter = async () => {
    if (!user) return
    
    const confirmed = window.confirm("Twitter連携を解除しますか？")
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from("user_twitter_tokens")
        .delete()
        .eq("user_id", user.id)

      if (error) throw error

      showToast("Twitter連携を解除しました", "success")
      router.push("/dashboard")
    } catch (error) {
      console.error("Error disconnecting Twitter:", error)
      showToast("Twitter連携の解除に失敗しました", "error")
    }
  }

  const handleDeleteAccount = async () => {
    if (!user) return

    const confirmed = window.confirm(
      "アカウントを削除しますか？\n\n" +
      "この操作は取り消せません。すべてのデータが削除されます。"
    )
    if (!confirmed) return

    try {
      // Note: Supabaseでは通常、auth.usersテーブルからの削除は管理者権限が必要
      // ここではユーザーにSupabaseダッシュボードでの削除を案内
      showToast("アカウント削除は管理者にお問い合わせください", "info")
    } catch (error) {
      console.error("Error deleting account:", error)
      showToast("アカウントの削除に失敗しました", "error")
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="mx-auto max-w-4xl">
          <div className="text-center py-20">読み込み中...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">設定</h1>
        <p className="text-muted-foreground">
          アカウント設定とアプリの設定を管理
        </p>
      </div>

      {/* Account Settings */}
        <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors duration-200 animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              アカウント設定
            </CardTitle>
            <CardDescription>アカウント情報の管理</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">メールアドレス</label>
              <div className="p-3 border rounded-lg bg-muted">
                <p className="text-sm">{user?.email || "未設定"}</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">ユーザーID</label>
              <div className="p-3 border rounded-lg bg-muted">
                <p className="text-sm font-mono text-xs">{user?.id || "未設定"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Twitter Integration */}
        <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors duration-200 animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Twitter連携
            </CardTitle>
            <CardDescription>Twitterアカウントの連携管理</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">連携状態</p>
                <p className="text-xs text-muted-foreground">
                  Twitter連携を解除すると、直接投稿機能が利用できなくなります
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleDisconnectTwitter}
                className="text-red-600 hover:text-red-700"
              >
                <Shield className="mr-2 h-4 w-4" />
                連携解除
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Promotion Settings */}
        <Link href="/settings/promotion">
          <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors duration-200 animate-fade-in cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5" />
                宣伝設定
              </CardTitle>
              <CardDescription>
                生成投稿に自分の商品・リンクを誘導する文言を追加（Pro）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                宣伝ON、商品名・URL・誘導文テンプレートを設定 → 投稿作成
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Notification Settings */}
        <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors duration-200 animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              通知設定
            </CardTitle>
            <CardDescription>アプリからの通知を管理</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">投稿成功通知</p>
                <p className="text-xs text-muted-foreground">
                  ツイート投稿成功時に通知を表示
                </p>
              </div>
              <div className="p-2 border rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">常に有効</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">エラー通知</p>
                <p className="text-xs text-muted-foreground">
                  エラー発生時に通知を表示
                </p>
              </div>
              <div className="p-2 border rounded-lg bg-muted">
                <p className="text-xs text-muted-foreground">常に有効</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              危険な操作
            </CardTitle>
            <CardDescription>取り消せない操作</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">アカウント削除</p>
                  <p className="text-xs text-muted-foreground">
                    アカウントとすべてのデータを削除します
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleDeleteAccount}
                  className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  アカウント削除
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  )
}
