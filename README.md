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

## ライセンス

MIT
