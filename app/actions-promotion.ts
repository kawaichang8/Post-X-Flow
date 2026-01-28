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
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (e) {
    console.error("savePromotionSettings:", e)
    return { success: false, error: "保存に失敗しました" }
  }
}

export async function getPromotionSettingsForGeneration(userId: string): Promise<{
  enabled: boolean
  product_name: string
  link_url: string
  template: string
} | null> {
  const row = await getPromotionSettings(userId)
  if (!row || !row.enabled || !row.link_url?.trim()) return null
  return {
    enabled: true,
    product_name: row.product_name || "",
    link_url: row.link_url.trim(),
    template: (row.template || DEFAULT_TEMPLATE).trim() || DEFAULT_TEMPLATE,
  }
}
