"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Settings2, Info, AlertTriangle, Save, RotateCcw } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScoreConfig, DEFAULT_SCORE_CONFIG } from "@/lib/security/score-calculator-advanced"

interface ScoreConfigPanelProps {
  config: ScoreConfig
  onConfigChange: (config: ScoreConfig) => void
  onSave?: (config: ScoreConfig) => void
}

export function ScoreConfigPanel({ config, onConfigChange, onSave }: ScoreConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState<ScoreConfig>(config)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleWeightChange = (key: keyof typeof localConfig.weights, value: number[]) => {
    const newConfig = {
      ...localConfig,
      weights: {
        ...localConfig.weights,
        [key]: value[0] / 100, // スライダーは0-100、重みは0-1
      },
    }
    setLocalConfig(newConfig)
    onConfigChange(newConfig)
  }

  const handleThresholdChange = (value: string) => {
    const threshold = Math.max(0, Math.min(100, parseInt(value) || 60))
    const newConfig = {
      ...localConfig,
      threshold,
    }
    setLocalConfig(newConfig)
    onConfigChange(newConfig)
  }

  const handleMultiAIToggle = (enabled: boolean) => {
    const newConfig: ScoreConfig = {
      ...localConfig,
      enableMultiAI: enabled,
      // 複数AI有効時は両方のプロバイダーを使用
      aiProviders: enabled ? (['grok', 'claude'] as ('grok' | 'claude')[]) : (['grok'] as ('grok' | 'claude')[]),
    }
    setLocalConfig(newConfig)
    onConfigChange(newConfig)
  }

  const handleProviderToggle = (provider: 'grok' | 'claude', enabled: boolean) => {
    const newProviders = enabled
      ? [...localConfig.aiProviders, provider]
      : localConfig.aiProviders.filter(p => p !== provider)
    
    // 最低1つは選択必須
    if (newProviders.length === 0) {
      return
    }

    const newConfig = {
      ...localConfig,
      aiProviders: newProviders,
      enableMultiAI: newProviders.length > 1,
    }
    setLocalConfig(newConfig)
    onConfigChange(newConfig)
  }

  const handleReset = () => {
    setLocalConfig(DEFAULT_SCORE_CONFIG)
    onConfigChange(DEFAULT_SCORE_CONFIG)
  }

  const handleSave = () => {
    if (onSave) {
      onSave(localConfig)
    }
    // ローカルストレージに保存
    localStorage.setItem('scoreConfig', JSON.stringify(localConfig))
  }

  // 重みの合計を計算
  const totalWeight = Object.values(localConfig.weights).reduce((sum, w) => sum + w, 0)
  const weightWarning = totalWeight < 0.9 || totalWeight > 1.1

  return (
    <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-xl">
      <CardHeader className="border-b border-gray-200 dark:border-gray-800 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <CardTitle className="text-lg">スコア計算設定</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs"
            >
              {isExpanded ? '折りたたむ' : '展開'}
            </Button>
            {onSave && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                className="text-xs"
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                保存
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="text-xs">
          スコア計算の重み付けと閾値をカスタマイズできます
        </CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6 pt-4">
          {/* 重み付け設定 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">スコア重み付け</Label>
              {weightWarning && (
                <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>合計が1.0に近い値になるよう調整してください（現在: {totalWeight.toFixed(2)}）</span>
                </div>
              )}
            </div>

            {/* 文字数スコア */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">文字数スコア</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {(localConfig.weights.lengthWeight * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[localConfig.weights.lengthWeight * 100]}
                onValueChange={(value) => handleWeightChange('lengthWeight', value)}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            {/* ハッシュタグスコア */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">ハッシュタグスコア</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {(localConfig.weights.hashtagWeight * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[localConfig.weights.hashtagWeight * 100]}
                onValueChange={(value) => handleWeightChange('hashtagWeight', value)}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            {/* スパム指標スコア */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">スパム指標スコア</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {(localConfig.weights.spamWeight * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[localConfig.weights.spamWeight * 100]}
                onValueChange={(value) => handleWeightChange('spamWeight', value)}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            {/* 可読性スコア */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">可読性スコア</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {(localConfig.weights.readabilityWeight * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[localConfig.weights.readabilityWeight * 100]}
                onValueChange={(value) => handleWeightChange('readabilityWeight', value)}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            {/* AI評価スコア */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">AI評価スコア</Label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {(localConfig.weights.aiWeight * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                value={[localConfig.weights.aiWeight * 100]}
                onValueChange={(value) => handleWeightChange('aiWeight', value)}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          {/* 閾値設定 */}
          <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">警告閾値</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-gray-500 dark:text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>このスコア以下で警告が表示されます</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={100}
                value={localConfig.threshold}
                onChange={(e) => handleThresholdChange(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">点以下で警告</span>
            </div>
          </div>

          {/* 複数AI評価平均化 */}
          <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Checkbox
                id="multiAI"
                checked={localConfig.enableMultiAI}
                onCheckedChange={(checked) => handleMultiAIToggle(checked === true)}
              />
              <Label htmlFor="multiAI" className="text-sm font-semibold cursor-pointer">
                複数AI評価平均化
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-gray-500 dark:text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>複数のAI（Claude + Grok）で評価して平均化することで、AIバイアスを減らします</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {localConfig.enableMultiAI && (
              <div className="pl-6 space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="grok"
                    checked={localConfig.aiProviders.includes('grok')}
                    onCheckedChange={(checked) => handleProviderToggle('grok', checked === true)}
                    disabled={localConfig.aiProviders.length === 1 && localConfig.aiProviders.includes('grok')}
                  />
                  <Label htmlFor="grok" className="text-sm cursor-pointer">Grok</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="claude"
                    checked={localConfig.aiProviders.includes('claude')}
                    onCheckedChange={(checked) => handleProviderToggle('claude', checked === true)}
                    disabled={localConfig.aiProviders.length === 1 && localConfig.aiProviders.includes('claude')}
                  />
                  <Label htmlFor="claude" className="text-sm cursor-pointer">Claude</Label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 pl-6">
                  選択したAIプロバイダーで評価し、平均を計算します
                </p>
              </div>
            )}
          </div>

          {/* リセットボタン */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="w-full"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-2" />
              デフォルトにリセット
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
