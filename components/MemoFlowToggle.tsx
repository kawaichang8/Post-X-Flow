"use client"

import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip"
import { Info, Link2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface MemoFlowToggleProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  promotionUrl?: string
  className?: string
}

export function MemoFlowToggle({
  enabled,
  onToggle,
  promotionUrl,
  className,
}: MemoFlowToggleProps) {
  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex items-center justify-between p-4 rounded-xl border border-border bg-card transition-all duration-200",
          enabled && "border-primary/30 bg-primary/5",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
              enabled
                ? "bg-gradient-to-br from-green-500 to-emerald-600"
                : "bg-muted"
            )}
          >
            {enabled ? (
              <Sparkles className="h-5 w-5 text-white" />
            ) : (
              <Link2 className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="memoflow-toggle"
                className="text-sm font-medium cursor-pointer"
              >
                プロモーションモード
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-0.5 rounded hover:bg-accent transition-colors">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[250px]">
                  <p className="text-xs">
                    ONにすると、生成された投稿に自動的にプロモーションリンクが追加されます。
                    マネタイズや集客に活用できます。
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-xs text-muted-foreground">
              {enabled
                ? "自動リンク挿入がONです"
                : "下書きにリンクを自動追加"}
            </p>
          </div>
        </div>

        <Switch
          id="memoflow-toggle"
          checked={enabled}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-primary"
        />
      </div>

      {/* URL Preview when enabled */}
      {enabled && promotionUrl && (
        <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground mb-1">挿入されるリンク:</p>
          <p className="text-sm font-mono text-primary truncate">
            {promotionUrl}
          </p>
        </div>
      )}
    </TooltipProvider>
  )
}

// Settings panel for MemoFlow configuration
interface MemoFlowSettingsProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  promotionUrl: string
  onUrlChange: (url: string) => void
  insertPosition: "start" | "end"
  onPositionChange: (position: "start" | "end") => void
}

export function MemoFlowSettings({
  enabled,
  onToggle,
  promotionUrl,
  onUrlChange,
  insertPosition,
  onPositionChange,
}: MemoFlowSettingsProps) {
  return (
    <div className="space-y-4">
      <MemoFlowToggle enabled={enabled} onToggle={onToggle} />

      {enabled && (
        <div className="space-y-4 animate-fade-in">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="promotion-url" className="text-sm font-medium">
              プロモーションURL
            </Label>
            <input
              id="promotion-url"
              type="url"
              value={promotionUrl}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://example.com/your-link"
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          {/* Insert Position */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">リンク挿入位置</Label>
            <div className="flex gap-2">
              <button
                onClick={() => onPositionChange("end")}
                className={cn(
                  "flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                  insertPosition === "end"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                文末に追加
              </button>
              <button
                onClick={() => onPositionChange("start")}
                className={cn(
                  "flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                  insertPosition === "start"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                文頭に追加
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 rounded-xl bg-accent/50 border border-border">
            <p className="text-xs text-muted-foreground mb-2">プレビュー:</p>
            <div className="text-sm">
              {insertPosition === "start" && promotionUrl && (
                <span className="text-primary">{promotionUrl} </span>
              )}
              <span className="text-muted-foreground">
                [投稿内容がここに入ります...]
              </span>
              {insertPosition === "end" && promotionUrl && (
                <span className="text-primary"> {promotionUrl}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
