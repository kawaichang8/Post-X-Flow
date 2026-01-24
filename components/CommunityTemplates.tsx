"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { 
  Heart, 
  Eye, 
  TrendingUp, 
  Users, 
  Search, 
  Filter, 
  Share2, 
  Copy, 
  Check,
  Sparkles,
  AlertCircle,
  ExternalLink
} from "lucide-react"
import { 
  getCommunityTemplates, 
  useTemplate, 
  toggleTemplateLike,
  CommunityTemplate,
  TemplateSearchParams
} from "@/app/actions-community"
import { useToast } from "@/components/ui/toast"
import { Pagination } from "@/components/Pagination"

interface CommunityTemplatesProps {
  userId?: string | null
  onSelectTemplate?: (template: CommunityTemplate) => void
}

export function CommunityTemplates({ userId, onSelectTemplate }: CommunityTemplatesProps) {
  const { showToast } = useToast()
  const [templates, setTemplates] = useState<CommunityTemplate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [likedTemplates, setLikedTemplates] = useState<Set<string>>(new Set())

  const pageSize = 12

  useEffect(() => {
    loadTemplates()
  }, [currentPage, categoryFilter, sortBy, searchQuery])

  const loadTemplates = async () => {
    setIsLoading(true)
    try {
      const params: TemplateSearchParams = {
        search: searchQuery || undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
        sortBy: sortBy as any,
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      }

      const result = await getCommunityTemplates(params, userId || undefined)
      setTemplates(result.templates)
      setTotalPages(result.totalPages)
      setTotal(result.total)

      // いいね状態を更新
      const liked = new Set(
        result.templates.filter((t) => t.is_liked).map((t) => t.id)
      )
      setLikedTemplates(liked)
    } catch (error) {
      console.error("Error loading templates:", error)
      showToast("テンプレートの読み込みに失敗しました", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseTemplate = async (template: CommunityTemplate) => {
    try {
      await useTemplate(template.id, userId || undefined)
      
      if (onSelectTemplate) {
        onSelectTemplate(template)
        showToast("テンプレートを選択しました", "success")
      } else {
        // テキストをクリップボードにコピー
        await navigator.clipboard.writeText(template.text)
        showToast("テンプレートをクリップボードにコピーしました", "success")
      }
    } catch (error) {
      console.error("Error using template:", error)
      showToast("テンプレートの使用に失敗しました", "error")
    }
  }

  const handleToggleLike = async (template: CommunityTemplate) => {
    if (!userId) {
      showToast("いいねするにはログインが必要です", "warning")
      return
    }

    try {
      const result = await toggleTemplateLike(template.id, userId)
      if (result.success) {
        const newLiked = new Set(likedTemplates)
        if (result.isLiked) {
          newLiked.add(template.id)
        } else {
          newLiked.delete(template.id)
        }
        setLikedTemplates(newLiked)

        // ローカル状態を更新
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === template.id
              ? { ...t, like_count: result.isLiked ? t.like_count + 1 : t.like_count - 1, is_liked: result.isLiked }
              : t
          )
        )

        showToast(
          result.isLiked ? "いいねしました" : "いいねを解除しました",
          "success"
        )
      } else {
        showToast(result.error || "いいねの更新に失敗しました", "error")
      }
    } catch (error) {
      console.error("Error toggling like:", error)
      showToast("いいねの更新に失敗しました", "error")
    }
  }

  const handleSearch = () => {
    setCurrentPage(1) // 検索時は1ページ目に戻る
    loadTemplates()
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-blue-500" />
            コミュニティテンプレート
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            他のユーザーが共有したツイートテンプレートを閲覧・使用できます
          </p>
        </div>
      </div>

      {/* 検索・フィルタ */}
      <Card className="border border-gray-200 dark:border-gray-800">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="テンプレートを検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch()
                    }
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="カテゴリ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="プロモーション">プロモーション</SelectItem>
                <SelectItem value="コンテンツ">コンテンツ</SelectItem>
                <SelectItem value="エンゲージメント">エンゲージメント</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="並び替え" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">新着順</SelectItem>
                <SelectItem value="popular">人気順</SelectItem>
                <SelectItem value="engagement">エンゲージメント順</SelectItem>
                <SelectItem value="use_count">使用回数順</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch} className="w-full sm:w-auto">
              <Search className="h-4 w-4 mr-2" />
              検索
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* テンプレート一覧 */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">読み込み中...</p>
        </div>
      ) : templates.length === 0 ? (
        <Card className="border border-gray-200 dark:border-gray-800">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              テンプレートが見つかりませんでした
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base line-clamp-2">
                        {template.title}
                      </CardTitle>
                      {template.description && (
                        <CardDescription className="text-xs mt-1 line-clamp-2">
                          {template.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {template.category && (
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                    )}
                    {template.tags.slice(0, 3).map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                    {template.text}
                  </p>
                  
                  {template.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.hashtags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {template.view_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {template.use_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {template.engagement_score}
                      </span>
                    </div>
                    {template.author_name && !template.is_anonymous && (
                      <span className="text-xs">by {template.author_name}</span>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUseTemplate(template)}
                      className="flex-1"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      使用
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleLike(template)}
                      className={likedTemplates.has(template.id) ? "text-red-500" : ""}
                    >
                      <Heart
                        className={`h-3.5 w-3.5 ${
                          likedTemplates.has(template.id) ? "fill-current" : ""
                        }`}
                      />
                      <span className="ml-1">{template.like_count}</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="pt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}

          {/* 統計情報 */}
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            全{total}件のテンプレート
          </div>
        </>
      )}
    </div>
  )
}
