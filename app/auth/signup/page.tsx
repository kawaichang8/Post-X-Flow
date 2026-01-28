"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      })

      if (error) throw error

      // If session is not created (email confirmation required), try to sign in automatically
      if (data.user && !data.session) {
        // Wait a moment for user to be created
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Try to sign in with the same credentials
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          // If sign in fails, email confirmation is required
          setError(
            "メール確認が必要です。メールボックスを確認してください。\n" +
            "開発環境では、Supabaseダッシュボードの「Authentication」→「Providers」→「Email」で「Enable email confirmations」をオフにしてください。"
          )
          return
        }

        if (signInData.session) {
          // Successfully signed in
          router.push("/dashboard")
          router.refresh()
          return
        }
      }

      // If session was created directly, redirect to dashboard
      if (data.session) {
        router.push("/dashboard")
        router.refresh()
      } else {
        setError("メール確認が必要です。メールボックスを確認してください。")
      }
    } catch (error: any) {
      if (error.message?.includes("Email not confirmed")) {
        setError(
          "メール確認が必要です。メールボックスを確認してください。\n" +
          "開発環境では、Supabaseダッシュボードの「Authentication」→「Providers」→「Email」で「Enable email confirmations」をオフにしてください。"
        )
      } else {
        setError(error.message || "登録に失敗しました")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">新規登録</CardTitle>
          <CardDescription>
            postXflowアカウントを作成
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive whitespace-pre-line">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                メールアドレス
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                パスワード
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                パスワードは6文字以上で入力してください
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "登録中..." : "新規登録"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <span className="text-muted-foreground">既にアカウントをお持ちの方は</span>{" "}
            <Link href="/auth/login" className="text-primary underline">
              ログイン
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
