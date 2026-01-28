"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Book, HelpCircle, MessageSquare, Shield, Zap, BarChart3, Clock } from "lucide-react"

export default function HelpPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              ダッシュボードに戻る
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Book className="h-8 w-8" />
                ヘルプ・使い方
              </h1>
              <p className="text-muted-foreground">
                postXflowの使い方をご案内します
              </p>
            </div>
          </div>
        </div>

        {/* Quick Start */}
        <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors duration-200 animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              クイックスタート
            </CardTitle>
            <CardDescription>初めての方へ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">1. アカウント作成</h3>
              <p className="text-sm text-muted-foreground">
                メールアドレスとパスワードでアカウントを作成します。
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">2. Twitter連携（任意）</h3>
              <p className="text-sm text-muted-foreground">
                ダッシュボードの「Twitter連携」ボタンから、Twitterアカウントを連携できます。
                連携すると、直接投稿機能が利用できます。
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">3. ツイート生成</h3>
              <p className="text-sm text-muted-foreground">
                トレンドキーワードと投稿目的を入力して、「ツイートを生成」ボタンをクリックします。
                AIが自然なツイートドラフトを3案生成します。
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">4. 投稿</h3>
              <p className="text-sm text-muted-foreground">
                生成されたドラフトから選択し、「承認して投稿」ボタンで投稿します。
                確認ダイアログが表示されるので、内容を確認してから投稿してください。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              主な機能
            </CardTitle>
            <CardDescription>postXflowの機能一覧</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <h3 className="font-semibold">AIツイート生成</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Claude APIを使用して、自然なツイートドラフトを3案生成します。
                  トレンドに合わせた内容で、自然さスコアも表示されます。
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-green-600" />
                  <h3 className="font-semibold">パフォーマンス分析</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  投稿統計、平均エンゲージメント、最高パフォーマンス投稿などを表示します。
                  エンゲージメント更新ボタンで最新データを取得できます。
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-purple-600" />
                  <h3 className="font-semibold">スケジュール投稿</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  未来の日時にツイートをスケジュールできます。
                  スケジュール管理画面で編集・削除も可能です。
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-orange-600" />
                  <h3 className="font-semibold">投稿履歴</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  過去に生成・投稿したツイートを確認できます。
                  再投稿やコピーも簡単にできます。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Safety */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              安全機能
            </CardTitle>
            <CardDescription>Xポリシー準拠の安全機能</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">承認必須（Human-in-the-Loop）</h3>
              <p className="text-sm text-muted-foreground">
                すべての投稿は人間の承認が必要です。確認ダイアログが表示され、
                内容を確認してから投稿できます。完全自動投稿は禁止されています。
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">自然さスコア</h3>
              <p className="text-sm text-muted-foreground">
                AIが生成したツイートのスパムリスクを0-100のスコアで評価します。
                スコアが低い場合は、内容を確認してから投稿してください。
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">言い回しの変動</h3>
              <p className="text-sm text-muted-foreground">
                毎回異なる言い回しでツイートを生成するため、
                同じ内容の繰り返し投稿を避けられます。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              よくある質問（FAQ）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Q: Twitter連携は必須ですか？</h3>
              <p className="text-sm text-muted-foreground">
                A: 必須ではありません。Twitter連携なしでも、生成したツイートをコピーして
                手動で投稿できます。連携すると、直接投稿機能が利用できます。
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Q: エンゲージメントスコアはどう計算されますか？</h3>
              <p className="text-sm text-muted-foreground">
                A: いいね、リツイート、返信、引用ツイートの合計です。
                「エンゲージメント更新」ボタンで最新データを取得できます。
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Q: スケジュール投稿は自動で投稿されますか？</h3>
              <p className="text-sm text-muted-foreground">
                A: 現在はスケジュール機能のみで、自動投稿は実装されていません。
                スケジュールされた投稿は履歴に保存され、手動で確認できます。
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Q: 自然さスコアが低い場合はどうすればいいですか？</h3>
              <p className="text-sm text-muted-foreground">
                A: スコアが60未満の場合は、内容を確認してから投稿してください。
                別のドラフトを選択するか、手動で編集することをおすすめします。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              お問い合わせ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              問題が発生した場合や、ご質問がある場合は、
              GitHubのIssuesまたはメールでお問い合わせください。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
