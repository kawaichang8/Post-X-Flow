import OpenAI from 'openai'

// Initialize OpenAI client for DALL-E
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null

export interface GeneratedImage {
  url: string
  revisedPrompt?: string
}

/**
 * Generate an eye-catching image based on tweet content
 * Uses DALL-E 3 to create engaging visuals for social media
 */
export async function generateEyeCatchImage(
  tweetText: string,
  trend?: string,
  purpose?: string
): Promise<GeneratedImage | null> {
  if (!openai) {
    console.warn('OpenAI API key not configured. Image generation disabled.')
    return null
  }

  try {
    // Create optimized prompt for eye-catching social media image
    const imagePrompt = createImagePrompt(tweetText, trend, purpose)

    console.log('[Image Generator] Generating image with prompt:', imagePrompt)

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: imagePrompt,
      size: '1024x1024', // Twitter supports up to 4096x4096, but 1024x1024 is good for performance
      quality: 'standard', // 'standard' or 'hd' (hd costs more)
      n: 1, // DALL-E 3 only supports n=1
    })

    const imageUrl = response.data[0]?.url
    const revisedPrompt = response.data[0]?.revised_prompt

    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E')
    }

    console.log('[Image Generator] Image generated successfully')

    return {
      url: imageUrl,
      revisedPrompt,
    }
  } catch (error) {
    console.error('[Image Generator] Error generating image:', error)
    throw error
  }
}

/**
 * Generate multiple image variations for A/B testing
 */
export async function generateImageVariations(
  tweetText: string,
  trend?: string,
  purpose?: string,
  count: number = 3
): Promise<GeneratedImage[]> {
  const images: GeneratedImage[] = []

  // Generate multiple images with slightly different prompts
  for (let i = 0; i < count; i++) {
    try {
      const image = await generateEyeCatchImage(tweetText, trend, purpose)
      if (image) {
        images.push(image)
      }
      // Add delay to avoid rate limiting
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)) // DALL-E 3 rate limit is ~1 request per 2 seconds
      }
    } catch (error) {
      console.error(`[Image Generator] Error generating image variation ${i + 1}:`, error)
      // Continue with other variations even if one fails
    }
  }

  return images
}

/**
 * Create optimized prompt for image generation
 * Extracts key concepts from tweet and creates engaging visual description
 */
function createImagePrompt(
  tweetText: string,
  trend?: string,
  purpose?: string,
  variationIndex: number = 0
): string {
  // Extract key concepts from tweet
  const hashtags = tweetText.match(/#\w+/g) || []
  const keywords = extractKeywords(tweetText)

  // Base prompt structure
  let prompt = 'Create an eye-catching, modern social media image that visually represents: '

  // Add main content
  if (keywords.length > 0) {
    prompt += keywords.slice(0, 3).join(', ') + '. '
  }

  // Add trend context if available
  if (trend) {
    prompt += `Inspired by the trend: ${trend}. `
  }

  // Add purpose context
  if (purpose) {
    if (purpose.includes('App promotion') || purpose.includes('アプリ宣伝')) {
      prompt += 'Modern app interface, clean design, professional. '
    } else if (purpose.includes('Productivity') || purpose.includes('生産性')) {
      prompt += 'Productivity theme, organized workspace, minimalist. '
    } else if (purpose.includes('Tech') || purpose.includes('技術')) {
      prompt += 'Technology theme, futuristic, digital. '
    }
  }

  // Add style variations
  const styles = [
    'Minimalist design, clean composition, vibrant colors, social media optimized',
    'Modern illustration style, bold typography, engaging visual hierarchy',
    'Photorealistic style, professional photography, high quality',
  ]
  const style = styles[variationIndex % styles.length]
  prompt += style

  // Add constraints for social media
  prompt += '. Optimized for Twitter/X feed, 1:1 aspect ratio, high contrast, readable text overlay if needed.'

  return prompt
}

/**
 * Extract keywords from tweet text
 */
function extractKeywords(text: string): string[] {
  // Remove hashtags, mentions, URLs
  const cleanText = text
    .replace(/#\w+/g, '')
    .replace(/@\w+/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .trim()

  // Split into words and filter
  const words = cleanText
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !/^[0-9]+$/.test(word)) // Remove pure numbers

  // Return top keywords (simple approach)
  return words.slice(0, 5)
}

/**
 * Download image from URL and convert to base64 or buffer
 * For Twitter Media API upload
 */
export async function downloadImageAsBuffer(imageUrl: string): Promise<Buffer> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error('[Image Generator] Error downloading image:', error)
    throw error
  }
}
