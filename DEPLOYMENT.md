# デプロイガイド

## Vercelへのデプロイ手順

### 1. 前提条件

- GitHubアカウント
- Vercelアカウント（[vercel.com](https://vercel.com)で無料登録可能）
- Supabaseプロジェクト（[supabase.com](https://supabase.com)で無料登録可能）
- Twitter Developerアカウント（[developer.twitter.com](https://developer.twitter.com)）

### 2. GitHubリポジトリの準備

```bash
# プロジェクトディレクトリに移動
cd freexboost

# Gitリポジトリの初期化（まだの場合）
git init

# ファイルをステージング
git add .

# コミット
git commit -m "Initial commit: Post-X-Flow v1.0.0"

# GitHubでリポジトリを作成後、リモートを追加
git remote add origin https://github.com/your-username/post-x-flow.git

# プッシュ
git push -u origin main
```

### 3. Supabaseのセットアップ

1. [Supabase](https://supabase.com)でプロジェクトを作成
2. SQL Editorで`supabase-schema.sql`を実行
3. 以下の情報をメモ：
   - Project URL
   - Anon Key
   - Service Role Key

### 4. Twitter Developer Appの設定

1. [Twitter Developer Portal](https://developer.twitter.com)でアプリを作成
2. OAuth 2.0設定：
   - **Callback URL**: `https://your-app.vercel.app/api/auth/twitter/callback`（後で設定）
   - **App permissions**: Read and Write
   - **Type of App**: Web App
3. 以下の情報をメモ：
   - Client ID
   - Client Secret

### 5. Vercelでのデプロイ

#### 方法1: Vercel CLI（推奨）

```bash
# Vercel CLIをインストール
npm i -g vercel

# プロジェクトディレクトリに移動
cd freexboost

# ログイン
vercel login

# 初回デプロイ（対話形式で設定）
vercel

# 本番環境にデプロイ
vercel --prod
```

#### 方法2: Vercel Dashboard（GitHub連携推奨）

1. [Vercel Dashboard](https://vercel.com/dashboard)にログイン
2. 「Add New Project」をクリック
3. GitHubリポジトリをインポート
4. プロジェクト設定：
   - **Framework Preset**: Next.js（自動検出）
   - **Root Directory**: `./`（ルートディレクトリの場合）または `freexboost`（サブディレクトリの場合）
   - **Build Command**: `npm run build`（自動検出）
   - **Output Directory**: `.next`（自動検出）
   - **Install Command**: `npm install --legacy-peer-deps`（重要！）
5. 「Deploy」をクリック

### 6. 環境変数の設定

Vercel Dashboardで以下の環境変数を設定：

#### Supabase設定
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

#### AI API設定（Claude推奨）
```
ANTHROPIC_API_KEY=your_anthropic_api_key
```

またはGrokを使用する場合：
```
GROK_API_KEY=your_grok_api_key
```

#### Twitter/X API設定
```
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret
TWITTER_REDIRECT_URI=https://your-app.vercel.app/api/auth/twitter/callback
```

#### App URL設定
```
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

#### OpenAI API設定（画像生成用 - Phase 3機能）
```
OPENAI_API_KEY=your_openai_api_key
```

**注意**: 環境変数はVercel Dashboardの「Settings」→「Environment Variables」で設定してください。
- **Environment**: Production, Preview, Development すべてに設定することを推奨

### 7. Twitter Callback URLの更新

1. Vercelデプロイ後、実際のURLを確認（例: `https://post-x-flow.vercel.app`）
2. Twitter Developer PortalでCallback URLを更新：
   - `https://your-app.vercel.app/api/auth/twitter/callback`
3. Vercelの環境変数`TWITTER_REDIRECT_URI`も同じURLに設定

### 8. デプロイ後の確認

1. **アプリにアクセス**: `https://your-app.vercel.app`
2. **アカウント作成**: サインアップでアカウントを作成
3. **Twitter連携**: ダッシュボードでTwitterアカウントを連携
4. **動作確認**:
   - ✅ ツイート生成機能
   - ✅ スケジュール投稿機能
   - ✅ パフォーマンス分析機能
   - ✅ 構文フォーマット生成（Phase 5）
   - ✅ 下書き管理（Phase 6）
   - ✅ アンケート・スレッド機能（Phase 6）
   - ✅ GIF添付・位置情報（Phase 7）

### 8.5. 初回セットアップチェックリスト

デプロイ後、以下を確認してください：

- [ ] Supabaseデータベースに`supabase-schema.sql`を実行済み
- [ ] 環境変数がすべて設定されている
- [ ] Twitter Callback URLが正しく設定されている
- [ ] アカウント作成ができる
- [ ] Twitter連携ができる
- [ ] ツイート生成ができる
- [ ] 投稿ができる

### 9. トラブルシューティング

#### ビルドエラー
- `npm run build`をローカルで実行してエラーを確認
- TypeScriptエラーがないか確認
- 依存関係が正しくインストールされているか確認

#### 環境変数エラー
- Vercel Dashboardで環境変数が正しく設定されているか確認
- 本番環境（Production）に設定されているか確認
- 環境変数名のタイポがないか確認

#### Twitter認証エラー
- Callback URLが正しく設定されているか確認
- `TWITTER_REDIRECT_URI`が実際のデプロイURLと一致しているか確認
- Twitter Developer Portalでアプリの権限を確認

#### Supabase接続エラー
- Supabaseプロジェクトがアクティブか確認
- RLS（Row Level Security）が正しく設定されているか確認
- `supabase-schema.sql`が実行されているか確認

### 10. カスタムドメインの設定（オプション）

1. Vercel Dashboardで「Settings」→「Domains」
2. カスタムドメインを追加
3. DNS設定を更新
4. Twitter Callback URLも更新

### 11. 本番環境の最適化

- **環境変数の確認**: 本番環境用の環境変数が設定されているか
- **パフォーマンス**: Vercelの自動最適化が有効
- **セキュリティ**: 環境変数はVercel Dashboardでのみ管理

## デプロイ後のメンテナンス

### データベースマイグレーション

新しいマイグレーションが必要な場合：
1. `supabase-schema.sql`を更新
2. Supabase SQL Editorで実行
3. 必要に応じて`MIGRATION_GUIDE.md`を参照

### アップデートのデプロイ

```bash
# 変更をコミット
git add .
git commit -m "Update: description"

# GitHubにプッシュ
git push

# Vercelが自動的にデプロイ（GitHub連携時）
# または手動でデプロイ
vercel --prod
```

## セキュリティチェックリスト

- [ ] 環境変数がVercel Dashboardで管理されている
- [ ] `.env.local`ファイルがGitにコミットされていない
- [ ] Supabase Service Role Keyが漏洩していない
- [ ] Twitter Client Secretが漏洩していない
- [ ] API Keysが適切に保護されている
- [ ] RLS（Row Level Security）がSupabaseで有効

## よくある問題と解決方法

### ビルドエラー: "Cannot find module"
```bash
# ローカルで確認
npm install --legacy-peer-deps
npm run build
```

### 環境変数が読み込まれない
- Vercel Dashboardで環境変数が設定されているか確認
- 環境変数名にタイポがないか確認
- 再デプロイを実行

### Twitter認証が失敗する
- Callback URLが正しく設定されているか確認
- `TWITTER_REDIRECT_URI`が実際のURLと一致しているか確認
- Twitter Developer Portalでアプリの権限を確認

### Supabase接続エラー
- Supabaseプロジェクトがアクティブか確認
- RLS（Row Level Security）が有効か確認
- `supabase-schema.sql`が実行されているか確認

## サポート

問題が発生した場合：
1. Vercelのデプロイログを確認（Dashboard → Deployments → ログを確認）
2. ブラウザのコンソールでエラーを確認（F12 → Console）
3. Supabaseのログを確認（Dashboard → Logs）
4. Twitter APIのエラーレスポンスを確認（Network タブ）

## デプロイ成功の確認

デプロイが成功すると：
- ✅ Vercel Dashboardに「Ready」と表示される
- ✅ アプリのURLが表示される
- ✅ ブラウザでアプリにアクセスできる
- ✅ ログイン・サインアップができる
