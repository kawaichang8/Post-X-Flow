"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Twitter } from "lucide-react"

interface TweetPreviewProps {
  text: string
  imageUrl?: string | null
  quotedTweet?: {
    author_name?: string
    author_handle?: string
    author_avatar_url?: string
    tweet_text: string
    media_url?: string
  } | null
  className?: string
}

export function TweetPreview({ text, imageUrl, quotedTweet, className }: TweetPreviewProps) {
  const maxLength = 280
  const remainingChars = maxLength - text.length

  return (
    <div className={cn("w-full", className)}>
      <Card className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-black rounded-2xl overflow-hidden">
        {/* X-like Tweet Preview */}
        <div className="p-4 space-y-3">
          {/* User Info */}
          <div className="flex items-center gap-3">
            {/* User Avatar */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg">U</span>
            </div>
            
            {/* User Name & Handle */}
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-gray-900 dark:text-white">
                あなた
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                @your_handle
              </div>
            </div>
            
            {/* X Icon */}
            <div className="text-gray-400 dark:text-gray-600">
              <Twitter className="h-5 w-5" />
            </div>
          </div>

          {/* Tweet Text */}
          <div className="space-y-2">
            <p className="text-[15px] text-gray-900 dark:text-white leading-relaxed whitespace-pre-wrap break-words">
              {text || (
                <span className="text-gray-400 dark:text-gray-600 italic">
                  ツイート内容がここに表示されます...
                </span>
              )}
            </p>
            
            {/* Character Count */}
            {text.length > 0 && (
              <div className="flex items-center justify-end">
                <span className={cn(
                  "text-xs font-medium",
                  remainingChars < 20 && remainingChars >= 0 && "text-orange-500",
                  remainingChars < 0 && "text-red-500",
                  remainingChars >= 20 && "text-gray-400 dark:text-gray-600"
                )}>
                  {remainingChars}
                </span>
              </div>
            )}
          </div>

          {/* Image Preview */}
          {imageUrl && (
            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900">
              <img
                src={imageUrl}
                alt="Tweet media"
                className="w-full h-64 object-cover"
              />
            </div>
          )}

          {/* Quoted Tweet Preview */}
          {quotedTweet && (
            <div className="border border-gray-300 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-gray-950 transition-colors">
              <div className="p-4 space-y-3">
                {/* Quoted Author Info */}
                <div className="flex items-center gap-3">
                  {quotedTweet.author_avatar_url ? (
                    <img
                      src={quotedTweet.author_avatar_url}
                      alt={quotedTweet.author_name || ""}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
                      <span className="text-gray-600 dark:text-gray-400 text-sm">?</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-gray-900 dark:text-white truncate">
                      {quotedTweet.author_name || "不明"}
                    </div>
                    {quotedTweet.author_handle && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        @{quotedTweet.author_handle}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quoted Tweet Text */}
                <p className="text-sm text-gray-900 dark:text-white leading-relaxed whitespace-pre-wrap break-words">
                  {quotedTweet.tweet_text}
                </p>

                {/* Quoted Tweet Media */}
                {quotedTweet.media_url && (
                  <div className="rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                    <img
                      src={quotedTweet.media_url}
                      alt="Quoted media"
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Icons Placeholder */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-6 text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.507c-4.49 0-8.129-3.64-8.129-8.13zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.15 6.138 6.183h.663l.853-.854 5.847-3.24c1.34-.74 2.12-2.12 2.12-3.59 0-3.31-2.69-6-6.005-6z"/>
                </svg>
                <span className="text-xs">0</span>
              </div>
              <div className="flex items-center gap-2 hover:text-green-500 dark:hover:text-green-400 transition-colors cursor-pointer">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M4.75 3.79l4.603 4.3-1.706 1.82L6 8.38v7.37c0 .97.784 1.75 1.75 1.75H13V20H7.75c-2.347 0-4.25-1.9-4.25-4.25V7.38l1.647 1.53-1.706 1.82L1 6.5l3.75-2.71zm17 2.71h-7v-1.5h7c.966 0 1.75.784 1.75 1.75v7.37l1.647-1.53 1.706 1.82-3.75 2.71-3.75-2.71 1.706-1.82L18 15.38V8c0-.966-.784-1.75-1.75-1.75zm-9.28 8.32l.02.02c-.44.85-.7 1.8-.7 2.8 0 1.06.28 2.06.78 2.93.5.86 1.3 1.67 2.18 2.15.88.48 1.83.73 2.77.73 1.06 0 2.06-.28 2.93-.78.86-.5 1.67-1.3 2.15-2.18.48-.88.73-1.83.73-2.77 0-1.06-.28-2.06-.78-2.93-.5-.86-1.3-1.67-2.18-2.15-.88-.48-1.83-.73-2.77-.73-1.06 0-2.06.28-2.93.78-.86.5-1.67 1.3-2.15 2.18-.48.88-.73 1.83-.73 2.77 0 .99.26 1.94.7 2.8l-.02-.02zm2.28-2.8c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5-2.5-1.12-2.5-2.5z"/>
                </svg>
                <span className="text-xs">0</span>
              </div>
              <div className="flex items-center gap-2 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/>
                </svg>
                <span className="text-xs">0</span>
              </div>
              <div className="flex items-center gap-2 hover:text-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M8.75 21V3h2v18h-2zM18 21V8.5h3V21h-3zm-9.5-10.5v8h3v-8h-3z"/>
                </svg>
                <span className="text-xs">0</span>
              </div>
            </div>
            <div className="text-gray-400 dark:text-gray-600">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M12 2.59l5.7 5.7-1.41 1.42L12 5.41 6.71 10.7l-1.41-1.42L12 2.59zM12 21.41l-5.7-5.7 1.41-1.42L12 18.59l5.29-5.3 1.41 1.42L12 21.41z"/>
              </svg>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
