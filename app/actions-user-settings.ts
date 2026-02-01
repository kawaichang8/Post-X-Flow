"use server"

import { createServerClient } from "@/lib/supabase"

export interface UserSettings {
  id: string
  user_id: string
  obsidian_vault_name: string | null
  created_at: string
  updated_at: string
}

/**
 * Get user settings
 */
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single()

    if (error) {
      // PGRST116 = no rows found, PGRST205 = table not in schema
      if (error.code === "PGRST116" || error.code === "PGRST205") {
        console.log("[getUserSettings] No settings found for user, returning null")
        return null
      }
      console.error("[getUserSettings] Error:", error)
      return null
    }

    return data as UserSettings
  } catch (e) {
    console.error("[getUserSettings] Unexpected error:", e)
    return null
  }
}

/**
 * Save or update user settings
 */
export async function saveUserSettings(
  userId: string,
  settings: Partial<Pick<UserSettings, "obsidian_vault_name">>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createServerClient()

    // Upsert: insert if not exists, update if exists
    const { error } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: userId,
          ...settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )

    if (error) {
      console.error("[saveUserSettings] Error:", error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (e) {
    console.error("[saveUserSettings] Unexpected error:", e)
    return { success: false, error: "設定の保存に失敗しました" }
  }
}

/**
 * Get Obsidian vault name for URI generation
 */
export async function getObsidianVaultName(userId: string): Promise<string | null> {
  const settings = await getUserSettings(userId)
  return settings?.obsidian_vault_name || null
}
