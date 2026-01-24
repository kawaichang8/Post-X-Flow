# Post-X-Flow (FreeXBoost)

X（Twitter）成長自動化ツール。X-boost級の機能を実装したセルフホスト対応ツール。

**Version**: 1.0.0 (Phase 1-7 完了)

## 機能

### コア機能
- **AIツイート生成**: Claude APIまたはGrok APIを使用して自然なツイートドラフトを3案生成
- **承認フロー**: Human-in-the-Loopで安全に投稿（完全自動投稿は禁止）
- **スケジュール投稿**: 未来の日時にツイートをスケジュール
- **Twitter連携**: OAuth 2.0 with PKCEでX API v2と連携（複数アカウント対応）
- **投稿履歴**: Supabaseに生成・投稿履歴を保存
- **再投稿提案**: 過去の高エンゲージメント投稿を提案
- **自然さスコア**: AIが自己評価したスパムリスクスコア（0-100）

### 高度な機能（Phase 1-7）

#### Phase 1-2: データ分析と最適化
- **パフォーマンスダッシュボード**: 投稿のエンゲージメント・インプレッション分析
- **最適投稿時間提案**: AIが分析した最適な投稿時間を自動提案
- **エンゲージメント自動更新**: 投稿後のエンゲージメントデータを自動取得

#### Phase 3: アイキャッチ画像生成
- **AI画像生成**: DALL-E 3を使用したアイキャッチ画像の自動生成
- **画像バリエーション**: 複数の画像バリエーションを生成・選択可能

#### Phase 4: 自動改善機能
- **パフォーマンス分析**: 低パフォーマンス投稿を自動検出
- **改善提案**: AIが投稿内容を分析して改善案を自動生成
- **期待値表示**: 改善後のエンゲージメント・インプレッション増加率を表示

#### Phase 5: 構文フォーマット生成
- **構文ボタン**: テキストをインプレッション最大化フォーマットに自動変換
- **140文字警告**: タイムライン表示を考慮した文字数警告システム
- **構造化フォーマット**: リスト形式、箇条書き、見出しなどの構造化を自動生成

#### Phase 6: 投稿管理と拡張機能
- **下書き管理**: 下書きの保存・編集・削除機能
- **アンケート機能**: 2-4択のアンケートを投稿に追加
- **ツイートスレッド**: 最大25件のツイートをスレッド形式で投稿

#### Phase 7: メディアと位置情報
- **GIF添付**: GIFファイルのアップロード・投稿対応
- **位置情報追加**: 場所を検索して位置情報を投稿に追加

### UI/UX機能
- **リアルタイムプレビュー**: 実際のTwitter画面のようなプレビュー表示
- **引用リツイート**: よく使う引用元ツイートを登録・管理
- **カレンダー表示**: スケジュール投稿を視覚的に管理
- **モダンなデザイン**: XやGrokのような洗練されたUI/UX

## 技術スタック

- **フレームワーク**: Next.js 15+ (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS + Shadcn/ui
- **認証・DB**: Supabase (PostgreSQL)
- **AI**: Anthropic Claude API または Grok API
- **Twitter API**: X API v2 (OAuth 2.0 with PKCE)
- **ホスティング**: Vercel

## セットアップ

### 1. 依存関係のインストール

```bash
npm install --legacy-peer-deps
```

### 2. 環境変数の設定

`.env.local`ファイルを作成し、以下の環境変数を設定してください：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI API (Claude または Grok のいずれか)
ANTHROPIC_API_KEY=your_anthropic_api_key
# または
# GROK_API_KEY=your_grok_api_key

# Twitter/X API v2
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret
TWITTER_REDIRECT_URI=http://localhost:3000/api/auth/twitter/callback

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Supabaseのセットアップ

1. [Supabase](https://supabase.com)でプロジェクトを作成
2. SQL Editorで`supabase-schema.sql`を実行してテーブルを作成
3. Row Level Security (RLS) が有効になっていることを確認

### 4. Twitter Developer Appの設定

1. [Twitter Developer Portal](https://developer.twitter.com)でアプリを作成
2. OAuth 2.0設定で以下を設定：
   - Callback URL: `http://localhost:3000/api/auth/twitter/callback`
   - App permissions: Read and Write
   - Type of App: Web App
3. Client IDとClient Secretを取得

### 5. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## 使用方法

### 基本的な使い方

1. **アカウント作成**: 新規登録またはログイン
2. **Twitter連携**: ダッシュボードでTwitterアカウントを連携（複数アカウント対応）
3. **ツイート生成**:
   - トレンドキーワードを入力（例: `#日曜劇場リブート`）
   - 投稿目的を選択
   - 「ツイートを生成」ボタンをクリック
4. **承認・投稿**:
   - 生成された3つのドラフトを確認
   - 自然さスコアを参考に選択
   - 「承認して投稿」ボタンで投稿（確認ダイアログ表示）
   - または「スケジュール」ボタンで未来の日時にスケジュール

### 高度な機能の使い方

#### 手動ツイート作成
1. **ツイート作成画面**でテキストを直接入力
2. **構文ボタン**: テキストを構造化フォーマットに変換
3. **リアルタイムプレビュー**: 右側で実際のTwitter表示を確認
4. **メディア追加**: 画像・GIFを添付
5. **拡張機能**:
   - **アンケート**: 選択肢を設定してアンケートを追加
   - **スレッド**: 複数のツイートを連続投稿
   - **位置情報**: 場所を検索して位置情報を追加

#### 下書き管理
1. **下書き**メニューから保存済み下書きを確認
2. **編集**: 下書きをクリックして編集
3. **投稿**: 編集後すぐに投稿可能
4. **削除**: 不要な下書きを削除

#### 引用リツイート
1. **引用ツイートを選択**ボタンから引用元ツイートを登録
2. **引用ツイートを選択**で登録済みツイートから選択
3. **コメントを入力**して引用ツイートとして投稿

#### パフォーマンス分析
1. **分析**メニューで投稿パフォーマンスを確認
2. **自動改善提案**: 低パフォーマンス投稿の改善案を確認
3. **改善版で作成**: 改善案を元に新しいツイートを作成

#### スケジュール管理
1. **スケジュール**メニューで予定投稿を確認
2. **カレンダー表示**: 視覚的にスケジュールを管理
3. **編集・削除**: スケジュールの変更・削除が可能

## 安全機能

- **承認必須**: すべての投稿は人間の承認が必要（確認ダイアログ表示）
- **自然さチェック**: AIがスパムリスクを評価（0-100スコア）
- **言い回しの変動**: 毎回異なる言い回しで生成
- **Xポリシー準拠**: Human-in-the-Loopで規制リスクを最小化
- **レート制限対応**: Twitter APIのレート制限を考慮した実装
- **トークン自動更新**: アクセストークンの自動リフレッシュ機能

## 主要な機能詳細

### リアルタイムプレビュー
- 実際のTwitter画面のようなプレビュー表示
- 画像・GIF・引用ツイートのプレビュー対応
- 文字数カウントと140文字警告

### 引用リツイート機能
- よく使う引用元ツイートを登録・管理
- コメント付きで引用ツイートとして投稿
- TwitterライクなフローティングウィンドウUI

### スケジュール管理
- カレンダー表示で視覚的に管理
- タイムライン表示・リスト表示も対応
- スケジュールの編集・削除機能

### パフォーマンス分析
- エンゲージメント・インプレッションの追跡
- 高パフォーマンス投稿の自動検出
- 低パフォーマンス投稿の改善提案

## Vercelへのデプロイ

### クイックデプロイ（5分）

詳細は [`QUICK_DEPLOY.md`](./QUICK_DEPLOY.md) を参照してください。

**簡単な手順**:
1. GitHubにプッシュ
2. Vercelでリポジトリをインポート
3. 環境変数を設定
4. デプロイ完了！

### 必要な環境変数

Vercel Dashboardで以下を設定してください：

- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **AI API**: `ANTHROPIC_API_KEY`（または`GROK_API_KEY`）
- **Twitter API**: `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`, `TWITTER_REDIRECT_URI`
- **OpenAI API**: `OPENAI_API_KEY`（画像生成用）
- **App URL**: `NEXT_PUBLIC_APP_URL`

**重要**: `Install Command`に`npm install --legacy-peer-deps`を設定してください。

詳細な手順は [`DEPLOYMENT.md`](./DEPLOYMENT.md) を参照してください。

## トラブルシューティング

### X（Twitter）アプリ承認エラー

#### エラー: "This app is not authorized to use this endpoint"
**原因**: Twitter Developer Portalでアプリの権限が不足している

**解決方法**:
1. [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)にアクセス
2. アプリを選択 → **Settings** → **User authentication settings**
3. **App permissions**を確認:
   - ✅ **Read and Write** が選択されている必要があります
   - ✅ **Type of App**: **Web App** が選択されている必要があります
4. **Callback URI / Redirect URL**を確認:
   - 開発環境: `http://localhost:3000/api/auth/twitter/callback`
   - 本番環境: `https://your-domain.com/api/auth/twitter/callback`
5. **Save**をクリックして変更を保存
6. ブラウザのキャッシュをクリアして再試行

#### エラー: "Invalid client_id or client_secret"
**原因**: 環境変数の設定が間違っている、またはキーが無効

**解決方法**:
1. `.env.local`（開発環境）またはVercel環境変数（本番環境）を確認
2. `TWITTER_CLIENT_ID`と`TWITTER_CLIENT_SECRET`が正しく設定されているか確認
3. Twitter Developer Portalで新しいキーを生成（必要に応じて）
4. アプリを再起動: `npm run dev`

#### エラー: "OAuth session not found or expired"
**原因**: OAuthフローが10分以内に完了しなかった、またはセッションが削除された

**解決方法**:
1. ブラウザのキャッシュとCookieをクリア
2. Twitter連携を再度試行
3. 10分以内に承認を完了する
4. 複数のタブで同時にOAuthフローを実行していないか確認

#### エラー: "access_denied" または "User denied the request"
**原因**: ユーザーがTwitterアプリの承認を拒否した

**解決方法**:
1. ユーザーに再度Twitter連携を試行してもらう
2. Twitterアプリの権限設定を確認（Read and Writeが必要）
3. ブラウザのポップアップブロッカーを無効化

### AI生成エラー

#### エラー: "No AI API key configured"
**原因**: `ANTHROPIC_API_KEY`または`GROK_API_KEY`が設定されていない

**解決方法**:
1. `.env.local`（開発環境）またはVercel環境変数（本番環境）を確認
2. 以下のいずれかを設定:
   ```env
   ANTHROPIC_API_KEY=your_anthropic_api_key
   # または
   GROK_API_KEY=your_grok_api_key
   ```
3. アプリを再起動: `npm run dev`

#### エラー: "Rate limit exceeded" または "429 Too Many Requests"
**原因**: AI APIのレート制限に達した

**解決方法**:
1. しばらく待ってから再試行（自動リトライ機能が動作します）
2. APIプランの制限を確認
3. 生成頻度を減らす

#### エラー: "Invalid API key"
**原因**: APIキーが無効または期限切れ

**解決方法**:
1. APIキーを再生成
2. 環境変数を更新
3. アプリを再起動

### データベースエラー

#### エラー: "relation does not exist" または "table does not exist"
**原因**: Supabaseテーブルが作成されていない

**解決方法**:
1. Supabase Dashboard → SQL Editorを開く
2. `supabase-schema.sql`を実行してテーブルを作成
3. 必要に応じて`migration-multiple-accounts.sql`も実行
4. インデックスを追加する場合は`supabase-performance-indexes.sql`を実行

#### エラー: "new row violates row-level security policy"
**原因**: Row Level Security (RLS) ポリシーが正しく設定されていない

**解決方法**:
1. Supabase Dashboard → **Authentication** → **Policies**を確認
2. 必要なRLSポリシーが有効になっているか確認
3. サービスロールキーを使用している場合は、RLSをバイパスできることを確認

#### エラー: "connection timeout" または "database connection failed"
**原因**: Supabaseへの接続がタイムアウトした

**解決方法**:
1. インターネット接続を確認
2. Supabaseプロジェクトのステータスを確認（[Status Page](https://status.supabase.com/)）
3. 環境変数`NEXT_PUBLIC_SUPABASE_URL`と`SUPABASE_SERVICE_ROLE_KEY`が正しいか確認
4. ローカルストレージへのフォールバック機能が動作することを確認

### ビルドエラー

#### エラー: "Module not found" または "Can't resolve"
**原因**: 依存関係がインストールされていない、またはバージョン不一致

**解決方法**:
```bash
# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# 型チェック
npm run type-check
```

#### エラー: "Turbopack build failed"
**原因**: Next.js 16のTurbopack設定の問題

**解決方法**:
1. `next.config.ts`を確認（`turbopack.root`が設定されているか）
2. `serverExternalPackages`に`twitter-api-v2`が含まれているか確認
3. 必要に応じて`npm run build`で詳細なエラーメッセージを確認

#### エラー: "TypeScript errors"
**原因**: 型エラーが存在する

**解決方法**:
```bash
# 型チェックを実行
npm run type-check

# エラーを修正
# 必要に応じて型定義を追加
```

### パフォーマンス問題

#### 問題: 投稿履歴の読み込みが遅い
**解決方法**:
1. `supabase-performance-indexes.sql`を実行してインデックスを追加
2. ページネーションを使用（デフォルトで20件/ページ）
3. 不要な古いデータを削除

#### 問題: 画像生成が遅い
**解決方法**:
1. OpenAI APIのレスポンス時間を確認
2. プログレスバーで進捗を確認
3. ネットワーク接続を確認

### その他の問題

#### 問題: 環境変数が読み込まれない（Vercel）
**解決方法**:
1. Vercel Dashboard → **Settings** → **Environment Variables**を確認
2. 環境変数が正しい環境（Production/Preview/Development）に設定されているか確認
3. 変数名に`NEXT_PUBLIC_`プレフィックスが必要なもの（クライアント側）と不要なもの（サーバー側）を区別
4. 変更後、再デプロイを実行

#### 問題: ログインできない
**解決方法**:
1. Supabaseの認証設定を確認
2. メールアドレスとパスワードが正しいか確認
3. メール認証が必要な場合は、メールボックスを確認
4. Supabase Dashboard → **Authentication** → **Users**でユーザーが作成されているか確認

#### 問題: ツイートが投稿されない
**解決方法**:
1. Twitter連携が正しく完了しているか確認
2. ブラウザのコンソールでエラーメッセージを確認
3. ネットワークタブでAPIリクエストのステータスを確認
4. Twitter APIのレート制限に達していないか確認
5. トークンが有効か確認（自動リフレッシュ機能が動作するはずです）

### デバッグ方法

#### ログの確認
- **開発環境**: ブラウザのコンソール（F12）とターミナルでログを確認
- **本番環境**: Vercel Dashboard → **Logs**でログを確認
- **Supabase**: Supabase Dashboard → **Logs**でデータベースログを確認

#### ネットワークリクエストの確認
1. ブラウザのDevTools → **Network**タブを開く
2. 問題が発生する操作を実行
3. 失敗したリクエスト（赤色）を確認
4. ステータスコードとエラーメッセージを確認

#### 環境変数の確認
```bash
# 開発環境で確認（.env.localが読み込まれているか）
npm run dev

# 本番環境（Vercel）で確認
# Vercel Dashboard → Settings → Environment Variables
```

### サポート

問題が解決しない場合:
1. [GitHub Issues](https://github.com/your-repo/issues)で既存のIssueを検索
2. 新しいIssueを作成（エラーメッセージ、再現手順、環境情報を含める）
3. ログとスクリーンショットを添付

## テスト

### テストの実行

```bash
# すべてのテストを実行
npm test

# ウォッチモードで実行
npm test -- --watch

# カバレッジレポートを生成
npm test -- --coverage

# 特定のテストファイルを実行
npm test -- components/PostDraft.test.tsx
```

### テストカバレッジ

- **目標**: 80%以上のカバレッジ
- **主要コンポーネント**: 100%カバレッジを目指す
- **生成ロジック**: 100%カバレッジを目指す

詳細は [`TESTING.md`](./TESTING.md) を参照してください。

## ライセンス

MIT
