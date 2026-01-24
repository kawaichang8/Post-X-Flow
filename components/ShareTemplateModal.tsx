"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { X, Plus, Share2, AlertCircle } from "lucide-react"
import { shareTemplateAsCommunity } from "@/app/actions-community"
import { useToast } from "@/components/ui/toast"

interface ShareTemplateModalProps {
  postId: string
  postText: string
  hashtags: string[]
  trend?: string | null
  purpose?: string | null
  engagementScore?: number
  naturalnessScore?: number
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function ShareTemplateModal({
  postId,
  postText,
  hashtags,
  trend,
  purpose,
  engagementScore,
  naturalnessScore,
  isOpen,
  onClose,
  onSuccess,
}: ShareTemplateModalProps) {
  const { showToast } = useToast()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<string>("")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      showToast("タイトルを入力してください", "error")
      return
    }

    setIsSubmitting(true)
    try {
      // userIdはサーバー側で取得される
      const result = await shareTemplateAsCommunity(
        postId,
        {
          title: title.trim(),
          description: description.trim() || undefined,
          category: category || undefined,
          tags: tags.length > 0 ? tags : undefined,
          isAnonymous,
        }
      )

      if (result.success) {
        showToast("テンプレートを共有しました！承認後に公開されます", "success")
        onSuccess?.()
        onClose()
        // フォームをリセット
        setTitle("")
        setDescription("")
        setCategory("")
        setTags([])
        setIsAnonymous(false)
      } else {
        showToast(result.error || "共有に失敗しました", "error")
      }
    } catch (error) {
      console.error("Error sharing template:", error)
      showToast("予期しないエラーが発生しました", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800">
        <CardHeader className="border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-blue-500" />
              <CardTitle>テンプレートを共有</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            承認済みツイートをコミュニティで共有できます
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {/* プレビュー */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <p className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              ツイートプレビュー:
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {postText}
            </p>
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {hashtags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* タイトル */}
          <div className="space-y-2">
            <Label htmlFor="title">
              タイトル <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="例: プロダクト紹介テンプレート"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          {/* 説明 */}
          <div className="space-y-2">
            <Label htmlFor="description">説明（オプション）</Label>
            <Textarea
              id="description"
              placeholder="このテンプレートの使い方や特徴を説明してください"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          {/* カテゴリ */}
          <div className="space-y-2">
            <Label htmlFor="category">カテゴリ</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="カテゴリを選択（オプション）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="プロモーション">プロモーション</SelectItem>
                <SelectItem value="コンテンツ">コンテンツ</SelectItem>
                <SelectItem value="エンゲージメント">エンゲージメント</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* タグ */}
          <div className="space-y-2">
            <Label>タグ（検索用）</Label>
            <div className="flex gap-2">
              <Input
                placeholder="タグを入力"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
                maxLength={20}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* 匿名オプション */}
          <div className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
            <Checkbox
              id="anonymous"
              checked={isAnonymous}
              onCheckedChange={(checked) => setIsAnonymous(checked === true)}
            />
            <div className="flex-1">
              <Label htmlFor="anonymous" className="cursor-pointer">
                匿名で共有
              </Label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                チェックすると、あなたの名前は表示されません
              </p>
            </div>
          </div>

          {/* 注意事項 */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-700 dark:text-amber-300">
                <p className="font-semibold mb-1">共有前に確認してください:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>テンプレートは承認後に公開されます</li>
                  <li>個人情報や機密情報が含まれていないか確認してください</li>
                  <li>不適切な内容は削除される可能性があります</li>
                </ul>
              </div>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isSubmitting || !title.trim()}
            >
              {isSubmitting ? "共有中..." : "共有する"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
