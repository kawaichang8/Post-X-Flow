"use server"

import { createServerClient } from "@/lib/supabase"

export interface GenerationHistoryDraft {
  text: string
  naturalness_score: number
  fact_score?: number | null
}

export interface GenerationHistoryItem {
  id: string
  user_id: string
  created_at: string
  trend: string | null
  purpose: string | null
  draft_count: number
  drafts: GenerationHistoryDraft[]
  ai_provider: string | null
  context_used: boolean
  fact_used: boolean
}

const MAX_DRAFT_TEXT_LENGTH = 2000
/** 生成履歴は直近この件数まで保持。超えた分は古い順に削除 */
const MAX_GENERATION_HISTORY = 300

/**
 * Save a generation session to history (called after successful generate).
 * Keeps only the most recent MAX_GENERATION_HISTORY (300) entries per user.
 */
export async function saveGenerationHistory(
  userId: string,
  trend: string,
  purpose: string,
  drafts: { text: string; naturalnessScore: number; factScore?: number | null }[],
  options?: { aiProvider?: string; contextUsed?: boolean; factUsed?: boolean }
): Promise<{ id?: string; error?: string }> {
  try {
    const supabase = createServerClient()
    const payload = drafts.map((d) => ({
      text: d.text.length > MAX_DRAFT_TEXT_LENGTH ? d.text.slice(0, MAX_DRAFT_TEXT_LENGTH) + "…" : d.text,
      naturalness_score: d.naturalnessScore,
      fact_score: d.factScore ?? null,
    }))
    const { data, error } = await supabase
      .from("generation_history")
      .insert({
        user_id: userId,
        trend: trend || null,
        purpose: purpose || null,
        draft_count: drafts.length,
        drafts: payload,
        ai_provider: options?.aiProvider || null,
        context_used: options?.contextUsed ?? false,
        fact_used: options?.factUsed ?? false,
      })
      .select("id")
      .single()
    if (error) {
      console.error("saveGenerationHistory error:", error)
      return { error: error.message }
    }
    // 直近300件を超えた分は古い順に削除
    const { count } = await supabase
      .from("generation_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
    if (count != null && count > MAX_GENERATION_HISTORY) {
      const toRemove = count - MAX_GENERATION_HISTORY
      const { data: oldRows } = await supabase
        .from("generation_history")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(toRemove)
      const ids = (oldRows ?? []).map((r: { id: string }) => r.id)
      if (ids.length > 0) {
        await supabase.from("generation_history").delete().eq("user_id", userId).in("id", ids)
      }
    }
    return { id: data?.id }
  } catch (e) {
    console.error("saveGenerationHistory error:", e)
    return { error: e instanceof Error ? e.message : "保存に失敗しました" }
  }
}

/**
 * Get generation history for user (monthly grouping is done on client)
 * Optional: olderThanMonths to only return recent (e.g. 6 = last 6 months)
 * Returns { data, error } so the UI can show "table missing" vs "no items".
 */
export async function getGenerationHistory(
  userId: string,
  options?: { limit?: number; olderThanMonths?: number }
): Promise<{ data: GenerationHistoryItem[]; error?: string }> {
  try {
    const supabase = createServerClient()
    let query = supabase
      .from("generation_history")
      .select("id, user_id, created_at, trend, purpose, draft_count, drafts, ai_provider, context_used, fact_used")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? MAX_GENERATION_HISTORY)
    if (options?.olderThanMonths != null && options.olderThanMonths > 0) {
      const since = new Date()
      since.setMonth(since.getMonth() - options.olderThanMonths)
      query = query.gte("created_at", since.toISOString())
    }
    const { data, error } = await query
    if (error) {
      console.error("getGenerationHistory error:", error)
      const msg = error.code === "PGRST205"
        ? "generation_history テーブルがありません。MIGRATION_GUIDE の「生成履歴テーブル」を実行してください。"
        : error.message || "生成履歴の取得に失敗しました"
      return { data: [], error: msg }
    }
    const items = (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      user_id: row.user_id as string,
      created_at: row.created_at as string,
      trend: row.trend as string | null,
      purpose: row.purpose as string | null,
      draft_count: (row.draft_count as number) ?? 0,
      drafts: (row.drafts as GenerationHistoryDraft[]) ?? [],
      ai_provider: row.ai_provider as string | null,
      context_used: (row.context_used as boolean) ?? false,
      fact_used: (row.fact_used as boolean) ?? false,
    }))
    return { data: items }
  } catch (e) {
    console.error("getGenerationHistory error:", e)
    const msg = e instanceof Error ? e.message : "生成履歴の取得に失敗しました"
    return { data: [], error: msg }
  }
}

/**
 * Delete generation history older than N months (for DB pressure / 整理)
 */
export async function deleteGenerationHistoryOlderThan(
  userId: string,
  olderThanMonths: number
): Promise<{ deleted: number; error?: string }> {
  if (olderThanMonths < 1) return { deleted: 0 }
  try {
    const supabase = createServerClient()
    const since = new Date()
    since.setMonth(since.getMonth() - olderThanMonths)
    const { data, error } = await supabase
      .from("generation_history")
      .delete()
      .eq("user_id", userId)
      .lt("created_at", since.toISOString())
      .select("id")
    if (error) {
      console.error("deleteGenerationHistoryOlderThan error:", error)
      return { deleted: 0, error: error.message }
    }
    return { deleted: (data ?? []).length }
  } catch (e) {
    console.error("deleteGenerationHistoryOlderThan error:", e)
    return { deleted: 0, error: e instanceof Error ? e.message : "削除に失敗しました" }
  }
}

/**
 * Delete a single generation history entry by id
 */
export async function deleteGenerationHistoryById(
  userId: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerClient()
    const { error } = await supabase
      .from("generation_history")
      .delete()
      .eq("user_id", userId)
      .eq("id", id)
    if (error) {
      console.error("deleteGenerationHistoryById error:", error)
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (e) {
    console.error("deleteGenerationHistoryById error:", e)
    return { success: false, error: e instanceof Error ? e.message : "削除に失敗しました" }
  }
}
