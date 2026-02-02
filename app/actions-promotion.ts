"use server"

import { createServerClient } from "@/lib/supabase"

export interface PromotionSettings {
  id: string
  user_id: string
  enabled: boolean
  product_name: string
  link_url: string
  template: string
  created_at: string
  updated_at: string
}

const DEFAULT_TEMPLATE = "このアイデアを速く試したい人は→[link]でチェック！"

export async function getPromotionSettings(userId: string): Promise<PromotionSettings | null> {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("promotion_settings")
      .select("*")
      .eq("user_id", userId)
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      // PGRST205 = table not in schema cache (e.g. promotion_settings not migrated yet)
      if (error.code === "PGRST205") {
        console.warn("promotion_settings table not found; run supabase migration if you need promotion features.")
        return null
      }
      console.error("Error fetching promotion settings:", error)
      return null
    }
    return data as PromotionSettings
  } catch (e) {
    console.error("getPromotionSettings:", e)
    return null
  }
}

export async function savePromotionSettings(
  userId: string,
  settings: {
    enabled: boolean
    product_name: string
    link_url: string
    template: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerClient()
    const { data: sub, error: subError } = await supabase
      .from("user_subscriptions")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle()
    if (!subError && sub) {
      const isPro = sub.plan === "pro" || sub.plan === "premium"
      if (!isPro) {
        return { success: false, error: "宣伝設定はProプランでご利用いただけます。アップグレード後に保存してください。" }
      }
    }
    const template = (settings.template || DEFAULT_TEMPLATE).trim() || DEFAULT_TEMPLATE

    const { error } = await supabase
      .from("promotion_settings")
      .upsert(
        {
          user_id: userId,
          enabled: settings.enabled,
          product_name: settings.product_name || "",
          link_url: settings.link_url || "",
          template,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )

    if (error) {
      console.error("Error saving promotion settings:", error)
      if (error.code === "PGRST205") {
        return { success: false, error: "宣伝設定用のテーブルがありません。管理者に連絡するか、MIGRATION_GUIDE のマイグレーションを実行してください。" }
      }
      if (error.code === "42501" || error.message?.includes("policy") || error.message?.includes("row-level")) {
        return { success: false, error: "権限がありません。ログインし直すか、Proプランでご利用ください。" }
      }
      return { success: false, error: error.message || "保存に失敗しました" }
    }
    return { success: true }
  } catch (e) {
    console.error("savePromotionSettings:", e)
    const msg = e instanceof Error ? e.message : "保存に失敗しました"
    return { success: false, error: msg }
  }
}

export async function getPromotionSettingsForGeneration(userId: string): Promise<{
  enabled: boolean
  product_name: string
  link_url: string
  template: string
} | null> {
  const row = await getPromotionSettings(userId).catch(() => null)
  if (!row || !row.enabled || !row.link_url?.trim()) return null
  return {
    enabled: true,
    product_name: row.product_name || "",
    link_url: row.link_url.trim(),
    template: (row.template || DEFAULT_TEMPLATE).trim() || DEFAULT_TEMPLATE,
  }
}
