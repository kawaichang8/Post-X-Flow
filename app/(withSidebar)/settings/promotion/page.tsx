"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getPromotionSettings, savePromotionSettings } from "@/app/actions-promotion"
import { useSubscription } from "@/hooks/useSubscription"
import { ProCard } from "@/components/ProCard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Link2, Loader2, Megaphone } from "lucide-react"
import { useToast } from "@/components/ui/toast"

const DEFAULT_TEMPLATE = "このアイデアを速く試したい人は→[link]でチェック！"

interface User {
  id: string
  email?: string
}

export default function PromotionSettingsPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [productName, setProductName] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)

  const { isPro, startCheckout } = useSubscription(user?.id ?? null)
  const upgradeEnabled = process.env.NEXT_PUBLIC_UPGRADE_ENABLED !== "false"

  const handleUpgrade = async () => {
    try {
      await startCheckout()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "アップグレードを開始できませんでした"
      showToast(msg, "error")
    }
  }

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        router.push("/auth/login")
        return
      }
      setUser({ id: session.user.id, email: session.user.email })
      setLoading(false)
    }
    check()
  }, [router])

  useEffect(() => {
    if (!user) return
    getPromotionSettings(user.id).then((s) => {
      if (s) {
        setEnabled(s.enabled)
        setProductName(s.product_name ?? "")
        setLinkUrl(s.link_url ?? "")
        setTemplate((s.template ?? DEFAULT_TEMPLATE).trim() || DEFAULT_TEMPLATE)
      }
    })
  }, [user])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const res = await savePromotionSettings(user.id, {
        enabled,
        product_name: productName,
        link_url: linkUrl,
        template: template.trim() || DEFAULT_TEMPLATE,
      })
      if (res.success) {
        showToast("宣伝設定を保存しました", "success")
      } else {
        showToast(res.error ?? "保存に失敗しました", "error")
      }
    } catch (e) {
      showToast("保存に失敗しました", "error")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
          <Megaphone className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">宣伝設定</h1>
          <p className="text-muted-foreground text-sm">
            生成された投稿に、あなたの商品・リンクを自然に誘導する文言を追加できます
          </p>
        </div>
      </div>

      {!isPro && upgradeEnabled && (
        <ProCard
          config={{
            spotsLeft: 5,
            spotsTotal: 5,
            oldPrice: "¥66,000",
            price: "¥44,800",
            priceUnit: "/3ヶ月",
            userCountLabel: "90人がPRO利用中",
            currentPlan: "Free",
          }}
          onUpgrade={handleUpgrade}
          variant="default"
          showAsUpgrade={true}
        />
      )}

      {!isPro && (
        <Card className="rounded-2xl border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <strong>Proで自分の商品を宣伝可能！</strong>
              <br />
              宣伝設定の保存・反映はProプランでご利用いただけます。
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-0 shadow-lg bg-card/80 backdrop-blur-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-green-500" />
            プロモーション
          </CardTitle>
          <CardDescription>
            ONにすると、生成投稿の末尾に誘導文を追加します。[link]は入力したURLに置き換わります。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-xl border p-4">
            <Label htmlFor="promo-enabled" className="text-base font-medium cursor-pointer">
              プロモーションを有効にする
            </Label>
            <Switch
              id="promo-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              disabled={!isPro}
              className="data-[state=checked]:bg-green-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-name">商品・リンク名</Label>
            <Input
              id="product-name"
              placeholder="例: マイツール"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              disabled={!isPro}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-url">アフィリエイト・リンクURL</Label>
            <Input
              id="link-url"
              type="url"
              placeholder="https://..."
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              disabled={!isPro}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template">誘導文テンプレート（[link] がURLに置き換わります）</Label>
            <Textarea
              id="template"
              placeholder={DEFAULT_TEMPLATE}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              disabled={!isPro}
              rows={4}
              className="rounded-xl resize-none"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !isPro}
            className="w-full rounded-xl h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "保存する"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
