# クイックデプロイガイド

## 5分でデプロイする手順

### ステップ1: GitHubにプッシュ

```bash
cd freexboost

# Gitの初期化（まだの場合）
git init

# ファイルを追加
git add .

# コミット
git commit -m "Deploy: Post-X-Flow v1.0.0"

# GitHubでリポジトリを作成後
git remote add origin https://github.com/your-username/post-x-flow.git
git branch -M main
git push -u origin main
```

### ステップ2: Vercelでデプロイ

1. [vercel.com](https://vercel.com)にアクセスしてログイン
2. 「Add New Project」をクリック
3. GitHubリポジトリを選択
4. **重要**: 「Install Command」に以下を設定：
   ```
   npm install --legacy-peer-deps
   ```
5. 「Deploy」をクリック

### ステップ3: 環境変数を設定

Vercel Dashboard → Settings → Environment Variables で以下を設定：

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI API
ANTHROPIC_API_KEY=your_anthropic_key

# Twitter API
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
TWITTER_REDIRECT_URI=https://your-app.vercel.app/api/auth/twitter/callback

# App URL
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# OpenAI (画像生成用)
OPENAI_API_KEY=your_openai_key
```

### ステップ4: Twitter Callback URLを更新

1. Vercelデプロイ後、実際のURLを確認（例: `https://post-x-flow.vercel.app`）
2. Twitter Developer PortalでCallback URLを更新
3. Vercelの環境変数`TWITTER_REDIRECT_URI`も更新
4. 再デプロイ

### ステップ5: Supabaseのセットアップ

1. Supabase Dashboard → SQL Editor
2. `supabase-schema.sql`の内容をコピー＆ペースト
3. 「Run」をクリック

### 完了！

アプリにアクセスして動作確認してください。

詳細は [`DEPLOYMENT.md`](./DEPLOYMENT.md) を参照してください。
