# アナリティクス統合セットアップガイド

このガイドでは、Post-X-Flowにアナリティクス機能を追加するための手順を説明します。

## 📋 前提条件

- Supabaseプロジェクトが既に設定されていること
- Vercelにデプロイ済みであること（環境変数設定のため）

## 🗄️ ステップ1: データベースマイグレーション

### 1.1 Supabase Dashboardにアクセス

1. [Supabase Dashboard](https://app.supabase.com/) にログイン
2. プロジェクトを選択

### 1.2 SQL Editorを開く

1. 左サイドバーから「**SQL Editor**」をクリック
2. 「**New query**」ボタンをクリック

### 1.3 SQLスクリプトを実行

1. `supabase-analytics.sql`ファイルの内容をコピー
2. SQL Editorのエディタに貼り付け
3. 「**Run**」ボタン（または `Cmd/Ctrl + Enter`）をクリック

### 1.4 実行結果の確認

以下の3つのテーブルが作成されていることを確認：

- ✅ `engagement_predictions` - エンゲージメント予測結果
- ✅ `optimal_timing_history` - 最適タイミング履歴
- ✅ `external_api_cache` - 外部APIデータキャッシュ

**確認方法：**
- 左サイドバーから「**Table Editor**」を開く
- 上記のテーブルが表示されていることを確認

### 1.5 エラーが発生した場合

- **「relation already exists」エラー**: テーブルが既に存在する場合
  - `CREATE TABLE IF NOT EXISTS`を使用しているため、通常は問題ありません
  - 既存のテーブルを確認して、必要に応じて手動で削除してから再実行

- **権限エラー**: RLSポリシーの作成に失敗する場合
  - Supabaseのプロジェクト設定でRLSが有効になっているか確認
  - 管理者権限で実行しているか確認

## 🔑 ステップ2: 環境変数の設定（オプション）

外部API（Polygon、News API）を使用する場合は、以下の環境変数を設定します。

### 2.1 Vercelで環境変数を設定

1. [Vercel Dashboard](https://vercel.com/dashboard) にログイン
2. プロジェクトを選択
3. 「**Settings**」→「**Environment Variables**」を開く
4. 以下の環境変数を追加：

#### Polygon API（市場データ用）

```
Key: POLYGON_API_KEY
Value: [Polygon APIキー]
Environment: Production, Preview, Development（必要に応じて）
```

**Polygon APIキーの取得方法：**
1. [Polygon.io](https://polygon.io/) にアカウント登録
2. ダッシュボードからAPIキーを取得

#### News API（ニューストレンド用）

```
Key: NEWS_API_KEY
Value: [News APIキー]
Environment: Production, Preview, Development（必要に応じて）
```

**News APIキーの取得方法：**
1. [NewsAPI.org](https://newsapi.org/) にアカウント登録
2. ダッシュボードからAPIキーを取得

### 2.2 環境変数の再デプロイ

環境変数を追加した後、Vercelで再デプロイが必要です：

1. 「**Deployments**」タブを開く
2. 最新のデプロイメントの「**...**」メニューから「**Redeploy**」を選択
3. または、新しいコミットをプッシュして自動デプロイをトリガー

### 2.3 環境変数の確認（ローカル開発）

ローカルで開発する場合、`.env.local`ファイルに追加：

```env
POLYGON_API_KEY=your_polygon_api_key_here
NEWS_API_KEY=your_news_api_key_here
```

**注意**: `.env.local`はGitにコミットしないでください（`.gitignore`に含まれていることを確認）

## 🧪 ステップ3: 機能のテスト

### 3.1 アプリケーションにアクセス

1. デプロイされたアプリケーションにアクセス
2. ログイン

### 3.2 アナリティクスセクションを開く

1. ダッシュボードの左サイドバーから「**アナリティクス**」をクリック
2. アナリティクスダッシュボードが表示されることを確認

### 3.3 エンゲージメント予測をテスト

1. 「**ツイート作成**」セクションでツイートを生成
2. 生成された下書きがある状態で「**アナリティクス**」セクションに移動
3. 「**エンゲージメント予測**」カードで「**予測する**」ボタンをクリック
4. 予測結果が表示されることを確認：
   - 予測エンゲージメントスコア（0-100）
   - 信頼度
   - 予測要因（テキスト品質、タイミング、ハッシュタグ、フォーマット）
   - AI分析（AI予測の場合）

### 3.4 最適タイミング提案をテスト

1. 「**最適投稿タイミング**」カードで「**取得**」ボタンをクリック
2. 最適な投稿タイミングが提案されることを確認：
   - 日時
   - 予測エンゲージメント
   - 信頼度
   - 理由
3. 「**外部API**」オプションを選択して、外部データを活用した提案をテスト（環境変数が設定されている場合）

### 3.5 予測精度統計を確認

1. 複数の予測を実行した後、「**予測精度統計**」カードを確認
2. 以下の情報が表示されることを確認：
   - 平均精度
   - 総予測数
   - 高精度予測数（70%以上）

### 3.6 タイミング履歴を確認

1. 「**タイミング履歴**」カードで過去の提案を確認
2. 履歴が正しく保存されていることを確認

## 🔍 トラブルシューティング

### 問題1: エンゲージメント予測が失敗する

**原因**: Grok APIキーが設定されていない、または無効

**解決方法**:
1. Vercelの環境変数で`GROK_API_KEY`が設定されているか確認
2. APIキーが有効か確認
3. エラーログを確認（ブラウザのコンソール、Vercelのログ）

### 問題2: 最適タイミングが取得できない

**原因**: 過去の投稿データが不足している

**解決方法**:
1. まず数件のツイートを投稿してデータを蓄積
2. 外部APIを使用する場合は、環境変数が正しく設定されているか確認

### 問題3: データベースエラーが発生する

**原因**: RLSポリシーまたはテーブルが正しく作成されていない

**解決方法**:
1. Supabase Dashboardの「**Table Editor**」でテーブルが存在するか確認
2. 「**Authentication**」→「**Policies**」でRLSポリシーが作成されているか確認
3. 必要に応じて、SQL Editorで再度マイグレーションを実行

### 問題4: 外部APIが動作しない

**原因**: 環境変数が設定されていない、またはAPIキーが無効

**解決方法**:
1. Vercelの環境変数で`POLYGON_API_KEY`と`NEWS_API_KEY`が設定されているか確認
2. APIキーが有効か確認（API提供者のダッシュボードで確認）
3. 外部APIを使用しない場合は、「**基本**」モードで動作することを確認

## 📊 データベーススキーマの確認

Supabase Dashboardの「**Table Editor**」で以下のテーブル構造を確認できます：

### engagement_predictions
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key → auth.users)
- `post_id` (UUID, Foreign Key → post_history, Optional)
- `predicted_engagement` (INTEGER, 0-100)
- `actual_engagement` (INTEGER, Optional)
- `confidence` (DECIMAL, 0-1)
- `method` (VARCHAR, 'regression' | 'ai' | 'hybrid')
- `factors` (JSONB)
- `breakdown` (TEXT, Optional)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### optimal_timing_history
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key → auth.users)
- `suggested_hour` (INTEGER, 0-23)
- `suggested_day_of_week` (INTEGER, 0-6)
- `suggested_date` (TIMESTAMPTZ)
- `predicted_engagement` (INTEGER, 0-100)
- `confidence` (DECIMAL, 0-1)
- `reason` (TEXT, Optional)
- `was_used` (BOOLEAN, Default: false)
- `actual_engagement` (INTEGER, Optional)
- `created_at` (TIMESTAMPTZ)

### external_api_cache
- `id` (UUID, Primary Key)
- `api_type` (VARCHAR, 'polygon' | 'news' | 'twitter_trends')
- `data` (JSONB)
- `expires_at` (TIMESTAMPTZ)
- `created_at` (TIMESTAMPTZ)

## ✅ 完了チェックリスト

- [ ] データベースマイグレーションが完了（3つのテーブルが作成されている）
- [ ] RLSポリシーが正しく設定されている
- [ ] 環境変数が設定されている（オプション）
- [ ] アナリティクスセクションが表示される
- [ ] エンゲージメント予測が動作する
- [ ] 最適タイミング提案が動作する
- [ ] 予測精度統計が表示される
- [ ] タイミング履歴が保存・表示される

## 🚀 次のステップ

アナリティクス機能が正常に動作することを確認したら：

1. **データの蓄積**: 実際にツイートを投稿して、予測精度を向上させる
2. **外部APIの活用**: PolygonやNews APIを設定して、より高度な分析を有効化
3. **プレミアム機能として展開**: アナリティクス機能を有料プランの特典として提供

## 📚 参考資料

- [Supabase SQL Editor ドキュメント](https://supabase.com/docs/guides/database/overview)
- [Vercel環境変数設定](https://vercel.com/docs/concepts/projects/environment-variables)
- [Polygon API ドキュメント](https://polygon.io/docs)
- [News API ドキュメント](https://newsapi.org/docs)
