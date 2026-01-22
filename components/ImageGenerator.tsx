"use client"

import * as React from "react"
import { useState } from "react"
import { Image, Loader2, Sparkles, X, Download, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GeneratedImage } from "@/lib/image-generator"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

interface ImageGeneratorProps {
  tweetText: string
  trend?: string
  purpose?: string
  onImageSelect?: (imageUrl: string) => void
  selectedImageUrl?: string | null
  className?: string
}

export function ImageGenerator({
  tweetText,
  trend,
  purpose,
  onImageSelect,
  selectedImageUrl,
  className,
}: ImageGeneratorProps) {
  const { showToast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const { generateTweetImage } = await import("@/app/actions")
      const result = await generateTweetImage(tweetText, trend, purpose)

      if (result.success && result.image) {
        setGeneratedImages([result.image])
        showToast("画像を生成しました", "success")
      } else {
        showToast(result.error || "画像の生成に失敗しました", "error")
      }
    } catch (error) {
      console.error("Error generating image:", error)
      showToast("画像の生成に失敗しました", "error")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateVariations = async () => {
    setIsGeneratingVariations(true)
    try {
      const { generateTweetImageVariations } = await import("@/app/actions")
      const result = await generateTweetImageVariations(tweetText, trend, purpose, 3)

      if (result.success && result.images) {
        setGeneratedImages(result.images)
        showToast(`${result.images.length}枚の画像を生成しました`, "success")
      } else {
        showToast(result.error || "画像の生成に失敗しました", "error")
      }
    } catch (error) {
      console.error("Error generating image variations:", error)
      showToast("画像の生成に失敗しました", "error")
    } finally {
      setIsGeneratingVariations(false)
    }
  }

  const handleSelectImage = (imageUrl: string) => {
    onImageSelect?.(imageUrl)
    showToast("画像を選択しました", "success")
  }

  const handleDownload = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `eye-catch-${Date.now()}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      showToast("画像をダウンロードしました", "success")
    } catch (error) {
      console.error("Error downloading image:", error)
      showToast("画像のダウンロードに失敗しました", "error")
    }
  }

  return (
    <Card className={cn("border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5" />
          アイキャッチ画像生成
        </CardTitle>
        <CardDescription>
          AIがツイート内容に基づいてアイキャッチ画像を自動生成します
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Generate Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || isGeneratingVariations || !tweetText.trim()}
            className="flex-1 rounded-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Image className="mr-2 h-4 w-4" />
                画像を生成
              </>
            )}
          </Button>
          <Button
            onClick={handleGenerateVariations}
            disabled={isGenerating || isGeneratingVariations || !tweetText.trim()}
            variant="outline"
            className="rounded-full"
          >
            {isGeneratingVariations ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                3パターン生成
              </>
            )}
          </Button>
        </div>

        {/* Generated Images */}
        {generatedImages.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              生成された画像 ({generatedImages.length}枚)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {generatedImages.map((image, index) => {
                const isSelected = selectedImageUrl === image.url

                return (
                  <div
                    key={index}
                    className={cn(
                      "relative group border-2 rounded-xl overflow-hidden transition-all",
                      isSelected
                        ? "border-blue-500 dark:border-blue-400"
                        : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
                    )}
                  >
                    {/* Image */}
                    <div className="aspect-square bg-gray-100 dark:bg-gray-900 relative">
                      <img
                        src={image.url}
                        alt={`Generated image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSelectImage(image.url)}
                        className="rounded-full"
                      >
                        {isSelected ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            選択済み
                          </>
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            選択
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDownload(image.url)}
                        className="rounded-full"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Revised Prompt Info */}
                    {image.revisedPrompt && (
                      <div className="p-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                          {image.revisedPrompt}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Info Message */}
        {generatedImages.length === 0 && !isGenerating && !isGeneratingVariations && (
          <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
            <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>ツイート内容に基づいてアイキャッチ画像を生成します</p>
            <p className="text-xs mt-1">OPENAI_API_KEYが必要です</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
