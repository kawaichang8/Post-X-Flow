"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info, Zap, TrendingUp, RefreshCw, Plus, X, Sparkles, Brain, Settings2 } from "lucide-react"
import { PostDraft } from "@/lib/ai-generator"
import { getTrends, getUserPurposes } from "@/app/actions"
import { useToast } from "@/components/ui/toast"

interface GenerateFormProps {
  onGenerate: (
    trend: string, 
    purpose: string, 
    options?: {
      aiProvider?: 'grok' | 'claude'
      enableHumor?: boolean
      enableRealtimeKnowledge?: boolean
      realtimeTrends?: string[]
    }
  ) => Promise<PostDraft[]>
  isLoading: boolean
  twitterAccessToken?: string | null
  userId?: string | null
}

interface Trend {
  name: string
  query: string
  tweetVolume: number | null
}

const PURPOSE_CATEGORIES = [
  {
    category: "プロモーション",
    options: [
      { value: "App promotion - MemoFlow", label: "アプリ宣伝 - MemoFlow", description: "MemoFlowアプリの宣伝" },
      { value: "Product launch", label: "製品リリース", description: "新製品・新機能の発表" },
      { value: "Event promotion", label: "イベント告知", description: "イベントやセミナーの告知" },
    ],
  },
  {
    category: "コンテンツ",
    options: [
      { value: "Productivity tips", label: "生産性のコツ", description: "生産性向上のヒントを共有" },
      { value: "Dev diary", label: "開発日記", description: "開発の過程や学びを共有" },
      { value: "General learning share", label: "一般学習共有", description: "学んだことや気づきを共有" },
      { value: "Tech insights", label: "技術的洞察", description: "技術的な知見や分析" },
    ],
  },
  {
    category: "エンゲージメント",
    options: [
      { value: "Question to audience", label: "質問・意見募集", description: "フォロワーに質問や意見を求める" },
      { value: "Community building", label: "コミュニティ構築", description: "コミュニティの活性化" },
      { value: "Thank you message", label: "感謝メッセージ", description: "フォロワーへの感謝" },
    ],
  },
]

export function GenerateForm({ onGenerate, isLoading, twitterAccessToken, userId }: GenerateFormProps) {
  const { showToast } = useToast()
  const [trend, setTrend] = useState("")
  const [purpose, setPurpose] = useState("")
  const [trends, setTrends] = useState<Trend[]>([])
  const [isLoadingTrends, setIsLoadingTrends] = useState(false)
  const [showTrends, setShowTrends] = useState(false)
  const [userPurposes, setUserPurposes] = useState<string[]>([])
  const [isLoadingPurposes, setIsLoadingPurposes] = useState(false)
  const [showCustomPurpose, setShowCustomPurpose] = useState(false)
  const [customPurpose, setCustomPurpose] = useState("")
  const [aiProvider, setAiProvider] = useState<'grok' | 'claude'>('grok') // デフォルト: Grok
  const [enableHumor, setEnableHumor] = useState(false)
  const [enableRealtimeKnowledge, setEnableRealtimeKnowledge] = useState(false)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)

  useEffect(() => {
    if (twitterAccessToken && trends.length === 0) {
      loadTrends()
    }
  }, [twitterAccessToken])

  useEffect(() => {
    if (userId) {
      loadUserPurposes()
    }
  }, [userId])

  const loadTrends = async () => {
    if (!twitterAccessToken) return
    setIsLoadingTrends(true)
    try {
      const fetchedTrends = await getTrends(twitterAccessToken)
      setTrends(fetchedTrends)
    } catch (error) {
      console.error("Error loading trends:", error)
    } finally {
      setIsLoadingTrends(false)
    }
  }

  const loadUserPurposes = async () => {
    if (!userId) return
    setIsLoadingPurposes(true)
    try {
      const purposes = await getUserPurposes(userId)
      setUserPurposes(purposes)
    } catch (error) {
      console.error("Error loading user purposes:", error)
    } finally {
      setIsLoadingPurposes(false)
    }
  }

  const handleTrendSelect = (trendName: string) => {
    setTrend(trendName)
    setShowTrends(false)
  }

  const handlePurposeSelect = (selectedPurpose: string) => {
    setPurpose(selectedPurpose)
    setShowCustomPurpose(false)
    setCustomPurpose("")
  }

  const handleCustomPurposeSubmit = () => {
    if (customPurpose.trim()) {
      setPurpose(customPurpose.trim())
      setShowCustomPurpose(false)
      setCustomPurpose("")
      showToast("カスタム投稿目的を設定しました", "success")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trend || !purpose) return
    
    // Validation
    if (trend.trim().length === 0) {
      return
    }
    if (trend.length > 200) {
      return
    }
    
    // リアルタイムトレンド情報を取得（有効な場合）
    let realtimeTrends: string[] = []
    if (enableRealtimeKnowledge && trends.length > 0) {
      realtimeTrends = trends.slice(0, 5).map(t => t.name) // 上位5件を取得
    }
    
    await onGenerate(trend.trim(), purpose, {
      aiProvider,
      enableHumor,
      enableRealtimeKnowledge,
      realtimeTrends
    })
  }

  return (
    <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors duration-200">
      <CardHeader className="border-b border-gray-200 dark:border-gray-800">
        <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
          ツイート生成
        </CardTitle>
        <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
          トレンドキーワードと投稿目的を入力して、自然なツイートドラフトを生成します
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="trend" className="text-sm font-medium flex items-center gap-2">
                現在のトレンド
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-gray-500 dark:text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>例: #日曜劇場リブート、鈴木亮平、#乃木坂工事中</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </label>
              {twitterAccessToken && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTrends(!showTrends)}
                    className="text-xs rounded-full hover:bg-gray-100 dark:hover:bg-gray-900"
                  >
                    <TrendingUp className="h-3.5 w-3.5 mr-1" />
                    トレンド表示
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={loadTrends}
                    disabled={isLoadingTrends}
                    className="text-xs rounded-full hover:bg-gray-100 dark:hover:bg-gray-900"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingTrends ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              )}
            </div>
            
            {showTrends && (
              <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3 bg-white dark:bg-black">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">リアルタイムトレンド（日本）</p>
                  {isLoadingTrends && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">読み込み中...</span>
                  )}
                </div>
                {trends.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {trends.map((t, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleTrendSelect(t.name)}
                        className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-800 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 transition-colors text-gray-900 dark:text-white"
                      >
                        {t.name}
                        {t.tweetVolume && (
                          <span className="ml-1.5 text-gray-500 dark:text-gray-400">
                            ({t.tweetVolume.toLocaleString()})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ) : !isLoadingTrends ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    トレンドを取得できませんでした。手動で入力してください。
                  </p>
                ) : null}
              </div>
            )}

            <Input
              id="trend"
              placeholder={twitterAccessToken ? "トレンドを選択するか、手動で入力" : "#日曜劇場リブート"}
              value={trend}
              onChange={(e) => setTrend(e.target.value)}
              required
              maxLength={200}
              className="transition-all focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 focus:border-gray-900 dark:focus:border-gray-100"
            />
            {twitterAccessToken && trends.length === 0 && !isLoadingTrends && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Twitter連携済み: 「トレンド表示」をクリックしてリアルタイムトレンドを取得
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="purpose" className="text-sm font-medium flex items-center gap-2">
                投稿目的
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-gray-500 dark:text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>ツイートの目的を選択するか、カスタム目的を入力してください</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCustomPurpose(!showCustomPurpose)}
                className="text-xs rounded-full hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                {showCustomPurpose ? (
                  <>
                    <X className="h-3.5 w-3.5 mr-1" />
                    選択に戻る
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    カスタム
                  </>
                )}
              </Button>
            </div>

            {showCustomPurpose ? (
              <div className="space-y-2">
                <Input
                  id="custom-purpose"
                  placeholder="カスタム投稿目的を入力（例: 新機能のフィードバック募集）"
                  value={customPurpose}
                  onChange={(e) => setCustomPurpose(e.target.value)}
                  maxLength={100}
                  className="transition-all focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-100 focus:border-gray-900 dark:focus:border-gray-100"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleCustomPurposeSubmit}
                    disabled={!customPurpose.trim()}
                    className="flex-1 rounded-full bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
                    size="sm"
                  >
                    設定
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowCustomPurpose(false)
                      setCustomPurpose("")
                    }}
                    className="rounded-full"
                    size="sm"
                  >
                    キャンセル
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Select value={purpose} onValueChange={handlePurposeSelect} required>
                  <SelectTrigger id="purpose">
                    <SelectValue placeholder="投稿目的を選択" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px]">
                    {PURPOSE_CATEGORIES.map((category) => (
                      <div key={category.category}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          {category.category}
                        </div>
                        {category.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex flex-col">
                              <span>{option.label}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {option.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                    {userPurposes.length > 0 && (
                      <div>
                        <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide border-t border-gray-200 dark:border-gray-800 mt-2 pt-2">
                          よく使う目的
                        </div>
                        {userPurposes
                          .filter((p) => !PURPOSE_CATEGORIES.some((cat) => 
                            cat.options.some((opt) => opt.value === p)
                          ))
                          .slice(0, 5)
                          .map((userPurpose) => (
                            <SelectItem key={userPurpose} value={userPurpose}>
                              {userPurpose}
                            </SelectItem>
                          ))}
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {purpose && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    選択中: <span className="font-medium">{purpose}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* AI Provider Selection & Advanced Options */}
          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                AI生成オプション
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="text-xs rounded-full hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                {showAdvancedOptions ? (
                  <>
                    <X className="h-3.5 w-3.5 mr-1" />
                    閉じる
                  </>
                ) : (
                  <>
                    <Settings2 className="h-3.5 w-3.5 mr-1" />
                    詳細設定
                  </>
                )}
              </Button>
            </div>

            {showAdvancedOptions && (
              <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950">
                {/* AI Provider Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    AIプロバイダー
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAiProvider('grok')}
                      className={`flex-1 px-4 py-2.5 rounded-lg border-2 transition-all ${
                        aiProvider === 'grok'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        <span className="font-medium">Grok</span>
                        <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                          推奨
                        </span>
                      </div>
                      <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                        最新知識・ユーモア対応
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiProvider('claude')}
                      className={`flex-1 px-4 py-2.5 rounded-lg border-2 transition-all ${
                        aiProvider === 'claude'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300'
                          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Brain className="h-4 w-4" />
                        <span className="font-medium">Claude</span>
                      </div>
                      <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                        高品質・安定性重視
                      </p>
                    </button>
                  </div>
                </div>

                {/* Grok専用オプション */}
                {aiProvider === 'grok' && (
                  <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Grok専用機能
                    </p>
                    
                    {/* ユーモア注入オプション */}
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={enableHumor}
                        onChange={(e) => setEnableHumor(e.target.checked)}
                        className="mt-0.5 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            ユーモア注入
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Grokの特徴的な風刺的視点や軽いユーモアを適度に注入します。投稿の魅力とエンゲージメントが向上します。
                        </p>
                      </div>
                    </label>

                    {/* リアルタイム知識挿入オプション */}
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={enableRealtimeKnowledge}
                        onChange={(e) => setEnableRealtimeKnowledge(e.target.checked)}
                        disabled={!twitterAccessToken || trends.length === 0}
                        className="mt-0.5 h-4 w-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-500" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            リアルタイム知識挿入
                          </span>
                          {!twitterAccessToken && (
                            <span className="text-xs px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full">
                              Twitter連携必要
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          最新のトレンド情報を自動取得し、生成時に反映します。時事性の高い投稿が可能になります。
                        </p>
                        {enableRealtimeKnowledge && trends.length > 0 && (
                          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-xs text-blue-700 dark:text-blue-300">
                            <p className="font-medium mb-1">反映される最新トレンド:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                              {trends.slice(0, 3).map((t, i) => (
                                <li key={i}>{t.name}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                )}

                {/* Claude使用時の説明 */}
                {aiProvider === 'claude' && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                    <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                      <p className="text-xs text-purple-700 dark:text-purple-300">
                        <strong>Claude</strong>は高品質で安定した生成を提供します。Grokのユーモアやリアルタイム知識機能はClaudeでは利用できません。
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <Button 
            type="submit" 
            disabled={isLoading || !trend || !purpose} 
            className="w-full rounded-full bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-semibold"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                生成中...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                {aiProvider === 'grok' ? 'Grokで生成' : 'Claudeで生成'}
              </span>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
