"use server"

import { createServerClient } from "@/lib/supabase"
import { classifyError, logErrorToSentry, AppError } from "@/lib/error-handler"

export interface CommunityTemplate {
  id: string
  user_id: string
  title: string
  text: string
  hashtags: string[]
  trend: string | null
  purpose: string | null
  format_type: string | null
  naturalness_score: number
  engagement_score: number
  is_anonymous: boolean
  is_approved: boolean
  view_count: number
  use_count: number
  like_count: number
  category: string | null
  tags: string[]
  description: string | null
  created_at: string
  updated_at: string
  // Computed fields
  is_liked?: boolean
  author_name?: string | null // null if anonymous
}

export interface TemplateSearchParams {
  category?: string
  tags?: string[]
  search?: string
  sortBy?: 'newest' | 'popular' | 'engagement' | 'use_count'
  limit?: number
  offset?: number
}

export interface PaginatedTemplates {
  templates: CommunityTemplate[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * 承認済みツイートをテンプレートとして共有
 */
export async function shareTemplateAsCommunity(
  postId: string,
  options: {
    title: string
    description?: string
    category?: string
    tags?: string[]
    isAnonymous?: boolean
  }
): Promise<{ success: boolean; templateId?: string; error?: string }> {
  try {
    const supabaseAdmin = createServerClient()
    
    // 元の投稿を取得（サービスロールで取得）
    // post_historyから直接user_idを取得してセキュリティを確保
    const { data: post, error: postError } = await supabaseAdmin
      .from("post_history")
      .select("*")
      .eq("id", postId)
      .eq("status", "posted") // 承認済み（投稿済み）のみ
      .single()

    if (postError || !post) {
      return {
        success: false,
        error: "投稿が見つからないか、共有可能な状態ではありません",
      }
    }
    
    const userId = post.user_id // 投稿から直接user_idを取得

    // テンプレートを作成
    const { data: template, error: templateError } = await supabaseAdmin
      .from("community_templates")
      .insert({
        user_id: userId,
        title: options.title,
        text: post.text,
        hashtags: post.hashtags || [],
        trend: post.trend,
        purpose: post.purpose,
        format_type: null, // post_historyにformat_typeがない場合はnull
        naturalness_score: post.naturalness_score || 0,
        engagement_score: post.engagement_score || 0,
        is_anonymous: options.isAnonymous || false,
        is_approved: false, // 初期状態は未承認（モデレーション待ち）
        category: options.category || null,
        tags: options.tags || [],
        description: options.description || null,
      })
      .select()
      .single()

    if (templateError) {
      const appError = classifyError(templateError)
      logErrorToSentry(appError, {
        action: "shareTemplateAsCommunity",
        userId,
        postId,
      })
      return {
        success: false,
        error: "テンプレートの共有に失敗しました",
      }
    }

    return {
      success: true,
      templateId: template.id,
    }
  } catch (error) {
    const appError = classifyError(error)
    logErrorToSentry(appError, {
      action: "shareTemplateAsCommunity",
      postId,
    })
    return {
      success: false,
      error: "予期しないエラーが発生しました",
    }
  }
}

/**
 * 共有テンプレート一覧を取得（検索・フィルタ対応）
 */
export async function getCommunityTemplates(
  params: TemplateSearchParams = {},
  userId?: string
): Promise<PaginatedTemplates> {
  try {
    const supabaseAdmin = createServerClient()
    const limit = params.limit || 20
    const offset = params.offset || 0

    let query = supabaseAdmin
      .from("community_templates")
      .select("*", { count: "exact" })
      .eq("is_approved", true) // 承認済みのみ

    // カテゴリフィルタ
    if (params.category) {
      query = query.eq("category", params.category)
    }

    // タグフィルタ
    if (params.tags && params.tags.length > 0) {
      query = query.contains("tags", params.tags)
    }

    // 検索（タイトル、説明、テキスト）
    if (params.search) {
      query = query.or(
        `title.ilike.%${params.search}%,description.ilike.%${params.search}%,text.ilike.%${params.search}%`
      )
    }

    // ソート
    const sortBy = params.sortBy || "newest"
    switch (sortBy) {
      case "newest":
        query = query.order("created_at", { ascending: false })
        break
      case "popular":
        query = query.order("like_count", { ascending: false })
        break
      case "engagement":
        query = query.order("engagement_score", { ascending: false })
        break
      case "use_count":
        query = query.order("use_count", { ascending: false })
        break
    }

    // ページネーション
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      const appError = classifyError(error)
      logErrorToSentry(appError, {
        action: "getCommunityTemplates",
        params,
      })
      throw appError
    }

    // ユーザーがいいねしているかチェック
    const templates: CommunityTemplate[] = await Promise.all(
      (data || []).map(async (template: any) => {
        let isLiked = false
        if (userId) {
          const { data: like } = await supabaseAdmin
            .from("template_likes")
            .select("id")
            .eq("template_id", template.id)
            .eq("user_id", userId)
            .maybeSingle()
          isLiked = !!like
        }

        // 匿名でない場合は作成者名を取得（簡易版：user_idの一部を表示）
        let authorName: string | null = null
        if (!template.is_anonymous && template.user_id) {
          // 匿名でない場合でも、プライバシー保護のため簡易的な表示
          authorName = `ユーザー${template.user_id.slice(0, 8)}`
        }

        return {
          ...template,
          is_liked: isLiked,
          author_name: authorName,
        }
      })
    )

    const total = count || 0
    const page = Math.floor(offset / limit) + 1
    const totalPages = Math.ceil(total / limit)

    return {
      templates,
      total,
      page,
      pageSize: limit,
      totalPages,
    }
  } catch (error) {
    const appError = classifyError(error)
    logErrorToSentry(appError, {
      action: "getCommunityTemplates",
      params,
    })
    throw appError
  }
}

/**
 * テンプレートを使用（閲覧数を増やす）
 */
export async function useTemplate(
  templateId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseAdmin = createServerClient()

    // 閲覧数を増やす（関数を使用）
    const { error: viewError } = await supabaseAdmin.rpc(
      "increment_template_view_count",
      { template_uuid: templateId }
    )

    if (viewError) {
      console.error("Error incrementing view count:", viewError)
      // 閲覧数の更新失敗は無視（テンプレート使用は続行）
    }

    // 使用回数を増やす（RPC関数を使用）
    const { error: useError } = await supabaseAdmin.rpc(
      "increment_template_use_count",
      { template_uuid: templateId }
    )

    if (useError) {
      const appError = classifyError(useError)
      logErrorToSentry(appError, {
        action: "useTemplate",
        templateId,
      })
      return {
        success: false,
        error: "テンプレートの使用に失敗しました",
      }
    }

    return { success: true }
  } catch (error) {
    const appError = classifyError(error)
    logErrorToSentry(appError, {
      action: "useTemplate",
      templateId,
    })
    return {
      success: false,
      error: "予期しないエラーが発生しました",
    }
  }
}

/**
 * テンプレートにいいね/いいね解除
 */
export async function toggleTemplateLike(
  templateId: string,
  userId: string
): Promise<{ success: boolean; isLiked: boolean; error?: string }> {
  try {
    const supabaseAdmin = createServerClient()

    // 既存のいいねを確認
    const { data: existingLike } = await supabaseAdmin
      .from("template_likes")
      .select("id")
      .eq("template_id", templateId)
      .eq("user_id", userId)
      .maybeSingle()

    if (existingLike) {
      // いいね解除
      const { error } = await supabaseAdmin
        .from("template_likes")
        .delete()
        .eq("id", existingLike.id)

      if (error) {
        const appError = classifyError(error)
        logErrorToSentry(appError, {
          action: "toggleTemplateLike",
          templateId,
          userId,
        })
        return {
          success: false,
          isLiked: true,
          error: "いいねの解除に失敗しました",
        }
      }

      return { success: true, isLiked: false }
    } else {
      // いいね追加
      const { error } = await supabaseAdmin
        .from("template_likes")
        .insert({
          template_id: templateId,
          user_id: userId,
        })

      if (error) {
        const appError = classifyError(error)
        logErrorToSentry(appError, {
          action: "toggleTemplateLike",
          templateId,
          userId,
        })
        return {
          success: false,
          isLiked: false,
          error: "いいねの追加に失敗しました",
        }
      }

      return { success: true, isLiked: true }
    }
  } catch (error) {
    const appError = classifyError(error)
    logErrorToSentry(appError, {
      action: "toggleTemplateLike",
      templateId,
      userId,
    })
    return {
      success: false,
      isLiked: false,
      error: "予期しないエラーが発生しました",
    }
  }
}

/**
 * ユーザー提案をGitHub Issuesに送信
 */
export async function submitUserSuggestion(
  userId: string | null,
  suggestion: {
    title: string
    description: string
    category: string
    isAnonymous?: boolean
  }
): Promise<{ success: boolean; issueUrl?: string; error?: string }> {
  try {
    const supabaseAdmin = createServerClient()

    // 提案をデータベースに保存
    const { data: savedSuggestion, error: saveError } = await supabaseAdmin
      .from("user_suggestions")
      .insert({
        user_id: userId,
        title: suggestion.title,
        description: suggestion.description,
        category: suggestion.category,
        is_anonymous: suggestion.isAnonymous || false,
        status: "pending",
      })
      .select()
      .single()

    if (saveError) {
      const appError = classifyError(saveError)
      logErrorToSentry(appError, {
        action: "submitUserSuggestion",
        userId,
      })
      return {
        success: false,
        error: "提案の保存に失敗しました",
      }
    }

    // GitHub Issues APIに送信（環境変数で設定）
    const githubRepo = process.env.GITHUB_REPO // e.g., "username/repo"
    const githubToken = process.env.GITHUB_TOKEN

    if (githubRepo && githubToken) {
      try {
        const issueBody = `## 提案内容

${suggestion.description}

## カテゴリ
${suggestion.category}

## 提出者
${suggestion.isAnonymous ? "匿名" : userId ? `ユーザーID: ${userId}` : "未ログイン"}

## 提出日時
${new Date().toISOString()}

---
*この提案はPost-X-Flowのコミュニティ機能から自動送信されました。*`

        const response = await fetch(
          `https://api.github.com/repos/${githubRepo}/issues`,
          {
            method: "POST",
            headers: {
              Authorization: `token ${githubToken}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: `[${suggestion.category}] ${suggestion.title}`,
              body: issueBody,
              labels: ["user-suggestion", suggestion.category],
            }),
          }
        )

        if (response.ok) {
          const issue = await response.json()
          
          // GitHub Issue情報を更新
          await supabaseAdmin
            .from("user_suggestions")
            .update({
              status: "submitted",
              github_issue_url: issue.html_url,
              github_issue_number: issue.number,
            })
            .eq("id", savedSuggestion.id)

          return {
            success: true,
            issueUrl: issue.html_url,
          }
        } else {
          const errorText = await response.text()
          console.error("GitHub API error:", errorText)
          // GitHub送信失敗でもDB保存は成功しているので、部分的な成功として扱う
          return {
            success: true, // DB保存は成功
            error: "GitHub Issuesへの送信に失敗しましたが、提案は保存されました",
          }
        }
      } catch (githubError) {
        console.error("Error creating GitHub issue:", githubError)
        // GitHub送信失敗でもDB保存は成功しているので、部分的な成功として扱う
        return {
          success: true, // DB保存は成功
          error: "GitHub Issuesへの送信に失敗しましたが、提案は保存されました",
        }
      }
    } else {
      // GitHub設定がない場合はDB保存のみ
      return {
        success: true,
        error: "GitHub設定がないため、提案はデータベースに保存されました",
      }
    }
  } catch (error) {
    const appError = classifyError(error)
    logErrorToSentry(appError, {
      action: "submitUserSuggestion",
      userId,
    })
    return {
      success: false,
      error: "予期しないエラーが発生しました",
    }
  }
}

/**
 * ユーザーが共有したテンプレート一覧を取得
 */
export async function getUserSharedTemplates(
  userId: string
): Promise<CommunityTemplate[]> {
  try {
    const supabaseAdmin = createServerClient()

    const { data, error } = await supabaseAdmin
      .from("community_templates")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      const appError = classifyError(error)
      logErrorToSentry(appError, {
        action: "getUserSharedTemplates",
        userId,
      })
      throw appError
    }

    return (data || []) as CommunityTemplate[]
  } catch (error) {
    const appError = classifyError(error)
    logErrorToSentry(appError, {
      action: "getUserSharedTemplates",
      userId,
    })
    throw appError
  }
}

/**
 * テンプレートを削除
 */
export async function deleteTemplate(
  templateId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseAdmin = createServerClient()

    const { error } = await supabaseAdmin
      .from("community_templates")
      .delete()
      .eq("id", templateId)
      .eq("user_id", userId) // 自分のテンプレートのみ削除可能

    if (error) {
      const appError = classifyError(error)
      logErrorToSentry(appError, {
        action: "deleteTemplate",
        templateId,
        userId,
      })
      return {
        success: false,
        error: "テンプレートの削除に失敗しました",
      }
    }

    return { success: true }
  } catch (error) {
    const appError = classifyError(error)
    logErrorToSentry(appError, {
      action: "deleteTemplate",
      templateId,
      userId,
    })
    return {
      success: false,
      error: "予期しないエラーが発生しました",
    }
  }
}
