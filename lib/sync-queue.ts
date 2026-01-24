/**
 * 同期キュー管理
 * ローカルストレージに保存された投稿をDBに同期
 */

import { createServerClient } from "./supabase"
import { getPostsFromLocalStorage, markPostAsSynced, removeFromSyncQueue } from "./storage-fallback"
import { logErrorToSentry, classifyError } from "./error-handler"

export interface SyncResult {
  success: boolean
  synced: number
  failed: number
  errors: string[]
}

/**
 * ローカルストレージの投稿をDBに同期
 */
export async function syncLocalPostsToDatabase(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: [],
  }

  try {
    const localPosts = getPostsFromLocalStorage().filter(
      (post) => post.userId === userId && !post.synced
    )

    if (localPosts.length === 0) {
      return result
    }

    const supabaseAdmin = createServerClient()

    for (const post of localPosts) {
      try {
        const { error } = await supabaseAdmin.from("post_history").insert({
          user_id: post.userId,
          text: post.text,
          hashtags: post.hashtags,
          naturalness_score: post.naturalnessScore,
          trend: post.trend,
          purpose: post.purpose,
          status: post.status,
          created_at: post.createdAt,
        })

        if (error) {
          const appError = classifyError(error)
          logErrorToSentry(appError, {
            action: 'syncLocalPostsToDatabase',
            postId: post.id,
            userId,
          })
          result.failed++
          result.errors.push(`Post ${post.id}: ${appError.message}`)
          continue
        }

        // 同期成功
        markPostAsSynced(post.id)
        removeFromSyncQueue(post.id)
        result.synced++
      } catch (error) {
        const appError = classifyError(error)
        logErrorToSentry(appError, {
          action: 'syncLocalPostsToDatabase',
          postId: post.id,
          userId,
        })
        result.failed++
        result.errors.push(`Post ${post.id}: ${appError.message}`)
      }
    }

    result.success = result.failed === 0
    return result
  } catch (error) {
    const appError = classifyError(error)
    logErrorToSentry(appError, {
      action: 'syncLocalPostsToDatabase',
      userId,
    })
    result.success = false
    result.errors.push(appError.message)
    return result
  }
}
