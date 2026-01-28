import { redirect } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function Home() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session) {
    redirect("/dashboard")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">postXflow</CardTitle>
          <CardDescription className="text-base">
            X成長自動化ツール
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            AIで自然なツイートドラフトを生成し、承認後に投稿できます。
            <br />
            セルフホスト対応
          </p>
          <div className="space-y-2">
            <Button asChild className="w-full">
              <Link href="/auth/login">ログイン</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/signup">新規登録</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
