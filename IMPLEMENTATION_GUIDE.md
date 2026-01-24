# エラーハンドリング強化実装ガイド

## 概要

Post-X-Flowのエラーハンドリングを強化し、X API、AI API（Claude/Grok）、Supabaseのエラーに対して適切に対応できるようにしました。

## 実装内容

### 1. エラーハンドリングユーティリティ (`lib/error-handler.ts`)

- **エラー分類**: X API、AI API、Supabaseのエラーを自動分類
- **リトライロジック**: 指数バックオフによる自動リトライ
- **Sentry統合準備**: エラーログをSentryに送信する準備（コメントアウト済み）

#### 主な機能

```typescript
// エラーを分類
const appError = classifyError(error)

// リトライ付きで実行
await retryWithBackoff(
  async () => await postTweet(text, token),
  { maxRetries: 3, initialDelay: 1000 }
)

// エラーログをSentryに送信（準備済み）
await logErrorToSentry(appError, { context })
```

### 2. ローカルストレージフォールバック (`lib/storage-fallback.ts`)

DB接続エラー時にローカルストレージに保存し、後で同期します。

#### 使用方法

```typescript
// ローカルストレージに保存
const id = savePostToLocalStorage({
  userId: user.id,
  text: draft.text,
  hashtags: draft.hashtags,
  naturalnessScore: draft.naturalnessScore,
  trend: currentTrend,
  purpose: currentPurpose,
  status: 'draft',
})

// 同期
await syncLocalPostsToDatabase(userId)
```

### 3. X APIエラーハンドリング強化

#### レート制限対応
- 429エラー時に自動的にリトライ（15分待機）
- UIにカウントダウン表示

#### トークン無効対応
- 401エラー時に自動的にトークンをリフレッシュ
- リフレッシュ失敗時はユーザーに再認証を促す

#### 実装箇所
- `lib/x-post.ts`: `postTweet`, `refreshTwitterAccessToken`関数

### 4. AI API（Claude/Grok）エラーハンドリング強化

#### レート制限対応
- 429エラー時に自動的にリトライ
- 複数のモデルを順番に試行（フォールバック）

#### トークンエラー対応
- 401エラー時に明確なエラーメッセージを表示
- APIキーの確認を促す

#### 実装箇所
- `lib/ai-generator.ts`: `generateWithClaude`, `generateWithGrok`関数

### 5. Supabaseエラーハンドリング強化

#### DB接続エラー対応
- 接続エラー時にローカルストレージに保存
- 接続回復時に自動同期

#### 詳細ログ
- すべてのSupabaseエラーを分類してログ出力
- Sentry統合準備（コメントアウト済み）

#### 実装箇所
- `app/actions.ts`: `savePostToHistory`, `approveAndPostTweet`関数

### 6. UIコンポーネント

#### ErrorDisplayコンポーネント (`components/ErrorDisplay.tsx`)
- エラーメッセージを表示
- リトライボタン（リトライ可能な場合）
- カウントダウン表示（自動リトライまで）

#### 使用方法

```tsx
<ErrorDisplay
  error={errorInfo}
  onDismiss={() => setErrorInfo(null)}
/>
```

### 7. 複数アカウント対応のエラーハンドリング

`migration-multiple-accounts.sql`に基づき、複数アカウント対応のエラーハンドリングを実装：

- アカウントごとのトークン管理
- アカウントごとのエラーハンドリング
- デフォルトアカウントのフォールバック

## 実装手順

### ステップ1: 依存関係のインストール

```bash
cd freexboost
npm install
```

### ステップ2: Sentry統合（オプション）

1. Sentryアカウントを作成
2. DSNを取得
3. `.env.local`に追加：
   ```
   NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
   ```
4. `lib/error-handler.ts`の`logErrorToSentry`関数のコメントを解除
5. Sentryパッケージをインストール：
   ```bash
   npm install @sentry/nextjs
   ```

### ステップ3: データベースマイグレーション

複数アカウント対応のマイグレーションを実行：

```sql
-- Supabase SQL Editorで実行
-- freexboost/migration-multiple-accounts.sql の内容を実行
```

### ステップ4: ローカルストレージ同期の実装

ダッシュボードに同期ボタンを追加（オプション）：

```tsx
// 接続回復時に自動同期
useEffect(() => {
  const syncInterval = setInterval(async () => {
    if (user && navigator.onLine) {
      const result = await syncLocalPostsToDatabase(user.id)
      if (result.synced > 0) {
        showToast(`${result.synced}件の投稿を同期しました`, "success")
        loadPostHistory()
      }
    }
  }, 60000) // 1分ごと

  return () => clearInterval(syncInterval)
}, [user])
```

## エラータイプ

### ErrorType

- `RATE_LIMIT`: レート制限エラー（リトライ可能）
- `AUTH_ERROR`: 認証エラー（リトライ不可、再認証必要）
- `NETWORK_ERROR`: ネットワークエラー（リトライ可能）
- `API_ERROR`: APIエラー（リトライ可能な場合あり）
- `DATABASE_ERROR`: データベースエラー（ローカルストレージに保存）
- `VALIDATION_ERROR`: バリデーションエラー（リトライ不可）
- `UNKNOWN_ERROR`: 不明なエラー

## テスト方法

### 1. X APIレート制限のテスト

```typescript
// レート制限をシミュレート
// 429エラーが発生した場合、自動的にリトライされることを確認
```

### 2. トークン無効のテスト

```typescript
// 無効なトークンで投稿を試行
// 自動的にトークンをリフレッシュすることを確認
```

### 3. DB接続エラーのテスト

```typescript
// Supabase接続を切断
// ローカルストレージに保存されることを確認
// 接続回復時に自動同期されることを確認
```

## 注意事項

1. **Sentry統合**: 現在はコメントアウトされています。本番環境で使用する場合は、Sentryアカウントを作成して設定してください。

2. **ローカルストレージ**: ブラウザのローカルストレージを使用するため、プライベートモードやストレージが無効な場合は動作しません。

3. **リトライ回数**: デフォルトで最大3回リトライします。必要に応じて調整してください。

4. **レート制限**: X APIのレート制限は15分間です。自動リトライは15分後に実行されます。

## 今後の改善点

1. **Sentry統合**: 本番環境でのエラー監視
2. **オフライン対応**: Service Workerを使用したオフライン対応
3. **エラー分析**: エラーの傾向分析とアラート
4. **自動復旧**: より高度な自動復旧ロジック
