# Vercel環境変数設定ガイド

## 概要

Post-X-FlowをVercelにデプロイする際の環境変数設定手順です。

## 手順

### 1. Vercel Dashboardにアクセス

1. https://vercel.com/dashboard にアクセス
2. プロジェクトを選択（または新規作成）

### 2. 環境変数の設定

1. **Settings** → **Environment Variables** をクリック
2. 以下の環境変数を追加

### 3. 設定する環境変数

#### サーバーサイドのみ（機密情報）

これらの変数は**NEXT_PUBLIC_プレフィックスを付けない**でください。

| 変数名 | 説明 | 取得方法 |
|--------|------|----------|
| `ANTHROPIC_API_KEY` | Claude APIキー | [Anthropic Console](https://console.anthropic.com/) |
| `GROK_API_KEY` | Grok APIキー（オプション） | [X AI Platform](https://x.ai/) |
| `TWITTER_CLIENT_ID` | Twitter OAuth Client ID | [Twitter Developer Portal](https://developer.twitter.com/) |
| `TWITTER_CLIENT_SECRET` | Twitter OAuth Client Secret | [Twitter Developer Portal](https://developer.twitter.com/) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | [Supabase Dashboard](https://supabase.com/dashboard) |

#### クライアントサイド（公開可能）

これらの変数は**NEXT_PUBLIC_プレフィックスが必要**です。

| 変数名 | 説明 | 取得方法 |
|--------|------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | [Supabase Dashboard](https://supabase.com/dashboard) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key | [Supabase Dashboard](https://supabase.com/dashboard) |
| `NEXT_PUBLIC_APP_URL` | アプリケーションのURL | VercelのデプロイURL |

#### オプション

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `TWITTER_REDIRECT_URI` | Twitter OAuth コールバックURL | `{NEXT_PUBLIC_APP_URL}/api/auth/twitter/callback` |

### 4. 環境ごとの設定

Vercelでは、以下の3つの環境で環境変数を設定できます：

- **Production**: 本番環境（`vercel --prod`でデプロイ）
- **Preview**: プレビュー環境（PRやブランチデプロイ）
- **Development**: ローカル開発環境（`vercel dev`）

**推奨設定:**
- Production: すべての環境変数を設定
- Preview: Productionと同じ（またはテスト用の値）
- Development: ローカル開発用の値（`.env.local`を使用）

### 5. 環境変数の追加方法

1. **Key**: 変数名を入力（例: `ANTHROPIC_API_KEY`）
2. **Value**: 変数の値を入力
3. **Environment**: 適用する環境を選択（Production, Preview, Development）
4. **Add** をクリック

### 6. 設定例

```
ANTHROPIC_API_KEY=sk-ant-api03-...
GROK_API_KEY=...
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### 7. 設定の確認

環境変数が正しく設定されているか確認：

```bash
# ローカルで確認（Vercel CLIが必要）
vercel env pull .env.local

# または、Vercel Dashboardで確認
# Settings → Environment Variables
```

### 8. デプロイ後の確認

デプロイ後、環境変数が正しく読み込まれているか確認：

1. Vercel Dashboard → **Deployments** → 最新のデプロイを選択
2. **Runtime Logs** を確認
3. エラーがないか確認

### 9. トラブルシューティング

#### 環境変数が見つからない

**エラー:**
```
Error: ANTHROPIC_API_KEY is not set
```

**解決方法:**
1. Vercel Dashboardで環境変数が設定されているか確認
2. 正しい環境（Production/Preview/Development）に設定されているか確認
3. 再デプロイ

#### クライアントサイドでAPIキーにアクセスできない

これは**正常な動作**です。サーバーサイドのみの環境変数はクライアントサイドからアクセスできません。

#### 環境変数の値が更新されない

1. 環境変数を更新
2. **再デプロイ**が必要（環境変数の変更は自動的に反映されません）

### 10. セキュリティのベストプラクティス

1. **機密情報はNEXT_PUBLIC_プレフィックスを付けない**
   - ❌ `NEXT_PUBLIC_ANTHROPIC_API_KEY`
   - ✅ `ANTHROPIC_API_KEY`

2. **環境ごとに異なるキーを使用**
   - Production用のAPIキー
   - Preview/Development用のAPIキー（テスト用）

3. **定期的なローテーション**
   - 四半期ごとにAPIキーをローテーション
   - 古いキーを無効化

4. **アクセス制限**
   - Vercelプロジェクトへのアクセスを制限
   - 環境変数の変更履歴を監視

## 参考資料

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [SECURITY_GUIDE.md](./SECURITY_GUIDE.md)
