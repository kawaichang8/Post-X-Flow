/**
 * Obsidian Export Utilities
 * Generates Markdown files compatible with Obsidian for note-taking workflows
 */

export interface DraftForExport {
  id: string
  content: string
  naturalness_score?: number
  fact_score?: number | null
  purpose?: string
  trend?: string
  created_at?: string
}

export interface ScheduledPostForExport {
  id: string
  text: string
  scheduled_for: string
  status: string
  naturalness_score?: number
  trend?: string | null
  purpose?: string | null
}

export interface AnalyticsSummary {
  totalImpressions?: number
  totalEngagements?: number
  avgEngagementRate?: number
  topPerformingPost?: string
  improvementSuggestions?: string[]
}

export interface QuoteRTCandidateForExport {
  id: string
  originalText: string
  originalTweetId?: string | null
  originalAuthor?: string
  likeCount: number
  retweetCount: number
  impressionCount?: number | null
  generatedComment?: string
  generatedAt?: string
}

export interface ObsidianExportData {
  drafts?: DraftForExport[]
  scheduledPosts?: ScheduledPostForExport[]
  analytics?: AnalyticsSummary
  generationHistory?: Array<{
    trend: string
    purpose: string
    created_at: string
    drafts: DraftForExport[]
  }>
  quoteRTCandidates?: QuoteRTCandidateForExport[]
}

/**
 * Format date for Obsidian frontmatter
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

/**
 * Format datetime for display
 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Escape special Markdown characters in text
 */
function escapeMarkdown(text: string): string {
  // Escape pipe for tables, keep other characters
  return text.replace(/\|/g, "\\|")
}

/**
 * Generate Obsidian-compatible Markdown export
 */
export function generateObsidianMarkdown(data: ObsidianExportData): string {
  const now = new Date()
  const lines: string[] = []

  // YAML Frontmatter
  lines.push("---")
  lines.push(`title: Post-X-Flow Export - ${formatDate(now)}`)
  lines.push(`date: ${now.toISOString()}`)
  lines.push("tags:")
  lines.push("  - postxflow")
  lines.push("  - twitter")
  lines.push("  - export")
  if (data.drafts?.length) lines.push("  - drafts")
  if (data.scheduledPosts?.length) lines.push("  - scheduled")
  if (data.quoteRTCandidates?.length) lines.push("  - quote-rt")
  if (data.analytics) lines.push("  - analytics")
  lines.push("---")
  lines.push("")

  // Header
  lines.push(`# Post-X-Flow Export - ${formatDate(now)}`)
  lines.push("")
  lines.push(`> エクスポート日時: ${formatDateTime(now.toISOString())}`)
  lines.push("")

  // Table of Contents
  lines.push("## 目次")
  lines.push("")
  if (data.drafts?.length) lines.push("- [[#生成ドラフト]]")
  if (data.scheduledPosts?.length) lines.push("- [[#スケジュール投稿]]")
  if (data.quoteRTCandidates?.length) lines.push("- [[#おすすめ引用候補]]")
  if (data.analytics) lines.push("- [[#分析サマリー]]")
  if (data.generationHistory?.length) lines.push("- [[#生成履歴]]")
  lines.push("")

  // Section 1: Drafts
  if (data.drafts && data.drafts.length > 0) {
    lines.push("## 生成ドラフト")
    lines.push("")
    lines.push(`${data.drafts.length}件のドラフト`)
    lines.push("")

    data.drafts.forEach((draft, index) => {
      lines.push(`### ドラフト ${index + 1}`)
      lines.push("")
      
      // Draft content in callout
      lines.push("> [!note] 投稿内容")
      draft.content.split("\n").forEach((line) => {
        lines.push(`> ${line}`)
      })
      lines.push("")

      // Metadata table
      lines.push("| 項目 | 値 |")
      lines.push("|------|-----|")
      if (draft.naturalness_score !== undefined) {
        const scoreEmoji = draft.naturalness_score >= 80 ? "🟢" : draft.naturalness_score >= 60 ? "🟡" : "🔴"
        lines.push(`| 自然度スコア | ${scoreEmoji} ${draft.naturalness_score}/100 |`)
      }
      if (draft.fact_score !== undefined && draft.fact_score !== null) {
        const factEmoji = draft.fact_score >= 70 ? "✅" : "⚠️"
        lines.push(`| 事実確認スコア | ${factEmoji} ${draft.fact_score}/100 |`)
      }
      if (draft.purpose) lines.push(`| 目的 | ${escapeMarkdown(draft.purpose)} |`)
      if (draft.trend) lines.push(`| トレンド | ${escapeMarkdown(draft.trend)} |`)
      if (draft.created_at) lines.push(`| 作成日時 | ${formatDateTime(draft.created_at)} |`)
      lines.push("")
    })
  }

  // Section 2: Scheduled Posts
  if (data.scheduledPosts && data.scheduledPosts.length > 0) {
    lines.push("## スケジュール投稿")
    lines.push("")
    lines.push(`${data.scheduledPosts.length}件の予約投稿`)
    lines.push("")

    // Calendar-style view
    lines.push("### カレンダー")
    lines.push("")
    
    // Group by date
    const byDate: Record<string, ScheduledPostForExport[]> = {}
    data.scheduledPosts.forEach((post) => {
      const dateKey = formatDate(new Date(post.scheduled_for))
      if (!byDate[dateKey]) byDate[dateKey] = []
      byDate[dateKey].push(post)
    })

    Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, posts]) => {
        lines.push(`#### 📅 ${date}`)
        lines.push("")
        posts.forEach((post) => {
          const time = new Date(post.scheduled_for).toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
          })
          lines.push(`- **${time}** - ${escapeMarkdown(post.text.slice(0, 50))}${post.text.length > 50 ? "..." : ""}`)
        })
        lines.push("")
      })

    // Detailed list
    lines.push("### 詳細一覧")
    lines.push("")
    lines.push("| 予定日時 | 内容（抜粋） | ステータス | 自然度 |")
    lines.push("|----------|--------------|------------|--------|")
    data.scheduledPosts.forEach((post) => {
      const datetime = formatDateTime(post.scheduled_for)
      const excerpt = escapeMarkdown(post.text.slice(0, 30)) + (post.text.length > 30 ? "..." : "")
      const status = post.status === "scheduled" ? "⏳ 予約中" : post.status === "posted" ? "✅ 投稿済" : "❌ 失敗"
      const score = post.naturalness_score ? `${post.naturalness_score}` : "-"
      lines.push(`| ${datetime} | ${excerpt} | ${status} | ${score} |`)
    })
    lines.push("")
  }

  // Section 3: Quote RT Candidates
  if (data.quoteRTCandidates && data.quoteRTCandidates.length > 0) {
    lines.push("## おすすめ引用候補")
    lines.push("")
    lines.push(`${data.quoteRTCandidates.length}件の引用候補`)
    lines.push("")

    data.quoteRTCandidates.forEach((candidate, index) => {
      lines.push(`### 候補 ${index + 1}`)
      lines.push("")
      
      // Original tweet
      lines.push("> [!quote] 元ツイート")
      candidate.originalText.split("\n").forEach((line) => {
        lines.push(`> ${line}`)
      })
      lines.push("")

      // Engagement metrics
      lines.push("| 指標 | 値 |")
      lines.push("|------|-----|")
      lines.push(`| いいね | ❤️ ${candidate.likeCount.toLocaleString()} |`)
      lines.push(`| RT | 🔁 ${candidate.retweetCount.toLocaleString()} |`)
      if (candidate.impressionCount != null) {
        lines.push(`| インプレッション | 👁️ ${candidate.impressionCount.toLocaleString()} |`)
      }
      if (candidate.originalAuthor) {
        lines.push(`| 投稿者 | ${escapeMarkdown(candidate.originalAuthor)} |`)
      }
      lines.push("")

      // Generated comment (if available)
      if (candidate.generatedComment) {
        lines.push("> [!tip] AI生成コメント案")
        candidate.generatedComment.split("\n").forEach((line) => {
          lines.push(`> ${line}`)
        })
        lines.push("")
      }

      // Link to original tweet
      if (candidate.originalTweetId) {
        lines.push(`🔗 [元ツイートを見る](https://x.com/i/status/${candidate.originalTweetId})`)
        lines.push("")
      }
    })
  }

  // Section 4: Analytics Summary
  if (data.analytics) {
    lines.push("## 分析サマリー")
    lines.push("")

    lines.push("> [!info] パフォーマンス概要")
    if (data.analytics.totalImpressions !== undefined) {
      lines.push(`> - **総インプレッション**: ${data.analytics.totalImpressions.toLocaleString()}`)
    }
    if (data.analytics.totalEngagements !== undefined) {
      lines.push(`> - **総エンゲージメント**: ${data.analytics.totalEngagements.toLocaleString()}`)
    }
    if (data.analytics.avgEngagementRate !== undefined) {
      lines.push(`> - **平均エンゲージメント率**: ${data.analytics.avgEngagementRate.toFixed(2)}%`)
    }
    lines.push("")

    if (data.analytics.topPerformingPost) {
      lines.push("### トップパフォーマンス投稿")
      lines.push("")
      lines.push("> [!success] 最高パフォーマンス")
      data.analytics.topPerformingPost.split("\n").forEach((line) => {
        lines.push(`> ${line}`)
      })
      lines.push("")
    }

    if (data.analytics.improvementSuggestions && data.analytics.improvementSuggestions.length > 0) {
      lines.push("### 改善提案")
      lines.push("")
      lines.push("> [!tip] AIからの提案")
      data.analytics.improvementSuggestions.forEach((suggestion) => {
        lines.push(`> - ${suggestion}`)
      })
      lines.push("")
    }
  }

  // Section 4: Generation History
  if (data.generationHistory && data.generationHistory.length > 0) {
    lines.push("## 生成履歴")
    lines.push("")
    lines.push(`直近${data.generationHistory.length}件の生成セッション`)
    lines.push("")

    data.generationHistory.slice(0, 10).forEach((session, index) => {
      lines.push(`### セッション ${index + 1} - ${formatDateTime(session.created_at)}`)
      lines.push("")
      lines.push(`- **トレンド**: ${session.trend || "（なし）"}`)
      lines.push(`- **目的**: ${session.purpose || "（なし）"}`)
      lines.push(`- **生成数**: ${session.drafts.length}件`)
      lines.push("")
      
      if (session.drafts.length > 0) {
        lines.push("<details>")
        lines.push("<summary>生成されたドラフト</summary>")
        lines.push("")
        session.drafts.forEach((draft, draftIndex) => {
          lines.push(`**${draftIndex + 1}.** ${escapeMarkdown(draft.content.slice(0, 100))}${draft.content.length > 100 ? "..." : ""}`)
          lines.push("")
        })
        lines.push("</details>")
        lines.push("")
      }
    })
  }

  // Footer
  lines.push("---")
  lines.push("")
  lines.push("*このファイルは [Post-X-Flow](https://postxflow.com) からエクスポートされました*")
  lines.push("")

  return lines.join("\n")
}

/**
 * Generate Obsidian URI for opening in Obsidian app
 * @param vaultName - The name of the Obsidian vault
 * @param fileName - The file name to create/open
 * @param content - The content to write
 */
export function generateObsidianUri(
  vaultName: string,
  fileName: string,
  content: string
): string {
  // Obsidian URI format: obsidian://new?vault=VaultName&name=FileName&content=EncodedContent
  const params = new URLSearchParams({
    vault: vaultName,
    name: fileName,
    content: content,
  })
  return `obsidian://new?${params.toString()}`
}

/**
 * Download content as a file
 */
export function downloadAsFile(content: string, fileName: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate export file name
 */
export function generateExportFileName(): string {
  const now = new Date()
  const dateStr = now.toISOString().split("T")[0]
  return `postxflow-export-${dateStr}.md`
}
