"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Github, Send, AlertCircle, CheckCircle2 } from "lucide-react"
import { submitUserSuggestion } from "@/app/actions-community"
import { useToast } from "@/components/ui/toast"

interface UserSuggestionFormProps {
  userId?: string | null
}

export function UserSuggestionForm({ userId }: UserSuggestionFormProps) {
  const { showToast } = useToast()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<string>("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedIssueUrl, setSubmittedIssueUrl] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!title.trim()) {
      showToast("タイトルを入力してください", "error")
      return
    }

    if (!description.trim()) {
      showToast("説明を入力してください", "error")
      return
    }

    if (!category) {
      showToast("カテゴリを選択してください", "error")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await submitUserSuggestion(userId || null, {
        title: title.trim(),
        description: description.trim(),
        category,
        isAnonymous,
      })

      if (result.success) {
        if (result.issueUrl) {
          setSubmittedIssueUrl(result.issueUrl)
          showToast("提案をGitHub Issuesに送信しました！", "success")
        } else {
          showToast(
            result.error || "提案を保存しました（GitHub送信はスキップされました）",
            "success"
          )
        }
        // フォームをリセット
        setTitle("")
        setDescription("")
        setCategory("")
        setIsAnonymous(false)
      } else {
        showToast(result.error || "提案の送信に失敗しました", "error")
      }
    } catch (error) {
      console.error("Error submitting suggestion:", error)
      showToast("予期しないエラーが発生しました", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submittedIssueUrl) {
    return (
      <Card className="border border-gray-200 dark:border-gray-800">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                提案を送信しました！
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                GitHub Issuesに提案が作成されました
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => window.open(submittedIssueUrl, "_blank")}
                >
                  <Github className="h-4 w-4 mr-2" />
                  Issueを確認
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSubmittedIssueUrl(null)
                    setTitle("")
                    setDescription("")
                    setCategory("")
                  }}
                >
                  新しい提案を送信
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-gray-200 dark:border-gray-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Github className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <CardTitle>機能提案・フィードバック</CardTitle>
        </div>
        <CardDescription>
          機能の提案や改善案をGitHub Issuesに送信できます
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* タイトル */}
        <div className="space-y-2">
          <Label htmlFor="suggestion-title">
            タイトル <span className="text-red-500">*</span>
          </Label>
          <Input
            id="suggestion-title"
            placeholder="例: スケジュール投稿の一括編集機能"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            required
          />
        </div>

        {/* 説明 */}
        <div className="space-y-2">
          <Label htmlFor="suggestion-description">
            説明 <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="suggestion-description"
            placeholder="提案の詳細を説明してください。どのような機能が必要か、なぜ必要か、どのように使うかなどを具体的に書いてください。"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={6}
            required
          />
        </div>

        {/* カテゴリ */}
        <div className="space-y-2">
          <Label htmlFor="suggestion-category">
            カテゴリ <span className="text-red-500">*</span>
          </Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="suggestion-category">
              <SelectValue placeholder="カテゴリを選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="feature">新機能</SelectItem>
              <SelectItem value="improvement">改善</SelectItem>
              <SelectItem value="bug">バグ報告</SelectItem>
              <SelectItem value="ui">UI/UX</SelectItem>
              <SelectItem value="other">その他</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 匿名オプション */}
        <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
          <Checkbox
            id="suggestion-anonymous"
            checked={isAnonymous}
            onCheckedChange={(checked) => setIsAnonymous(checked === true)}
          />
          <div className="flex-1">
            <Label htmlFor="suggestion-anonymous" className="cursor-pointer">
              匿名で送信
            </Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              チェックすると、あなたのユーザーIDはGitHub Issueに含まれません
            </p>
          </div>
        </div>

        {/* 注意事項 */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-700 dark:text-blue-300">
              <p className="font-semibold mb-1">送信について:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>提案はGitHub Issuesに自動的に作成されます</li>
                <li>開発チームが確認し、必要に応じて対応します</li>
                <li>IssueのURLが表示されますので、進捗を確認できます</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 送信ボタン */}
        <Button
          onClick={handleSubmit}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          disabled={isSubmitting || !title.trim() || !description.trim() || !category}
        >
          {isSubmitting ? (
            "送信中..."
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              GitHub Issuesに送信
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
