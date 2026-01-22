"use client"

// Client-side only Twitter utilities
// This file is separate from x-post.ts to avoid importing twitter-api-v2 on the client

// Open Twitter compose window (fallback method)
export function openTwitterCompose(text: string): void {
  if (typeof window === 'undefined') {
    throw new Error('openTwitterCompose can only be called from client-side')
  }
  const encodedText = encodeURIComponent(text)
  const url = `https://twitter.com/intent/tweet?text=${encodedText}`
  window.open(url, '_blank')
}
