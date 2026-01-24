# Post-X-Flow セキュリティガイド

## 概要

このドキュメントは、Post-X-Flowのセキュリティ実装とベストプラクティスを説明します。

## セキュリティ強化の実装内容

### 1. APIキー保護

#### server-onlyパッケージの使用

すべてのAPIキーは`server-only`パッケージを使用して保護されています。

```typescript
// ✅ 正しい: server-onlyモジュール経由
import { getAnthropicApiKey } from './server-only'
const apiKey = getAnthropicApiKey()

// ❌ 間違い: 直接process.envにアクセス（クライアントサイドで露出の可能性）
const apiKey = process.env.ANTHROPIC_API_KEY
```

#### 保護されているAPIキー

- `ANTHROPIC_API_KEY` - Claude API
- `GROK_API_KEY` - Grok API
- `TWITTER_CLIENT_ID` - Twitter OAuth Client ID
- `TWITTER_CLIENT_SECRET` - Twitter OAuth Client Secret
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key

### 2. 環境変数管理

#### Vercel環境変数の設定

1. **Vercel Dashboardにアクセス**
   - https://vercel.com/dashboard
   - プロジェクトを選択

2. **Settings → Environment Variables**
   - 各環境（Production, Preview, Development）に環境変数を設定

3. **設定する環境変数**

```env
# サーバーサイドのみ（NEXT_PUBLIC_なし）
ANTHROPIC_API_KEY=sk-ant-...
GROK_API_KEY=...
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
SUPABASE_SERVICE_ROLE_KEY=...

# クライアントサイド（NEXT_PUBLIC_プレフィックス）
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# オプション
TWITTER_REDIRECT_URI=https://your-app.vercel.app/api/auth/twitter/callback
```

#### 環境変数の検証

ビルド時に自動検証されます：

```bash
npm run build
# 環境変数の検証が自動実行されます
```

手動で検証する場合：

```typescript
import { validateEnvironmentVariables } from './lib/security/env-validator'

const result = validateEnvironmentVariables()
if (!result.valid) {
  console.error('Environment validation failed:', result.errors)
}
```

### 3. 自然さスコアの透明化

#### ハイブリッドスコア計算

AIバイアスを排除し、ルールベース + AI評価のハイブリッド方式を採用：

1. **ルールベース指標（客観的）**
   - 文字数適切性 (0-20点)
   - ハッシュタグ適切性 (0-15点)
   - スパム指標チェック (0-20点)
   - 可読性 (0-15点)

2. **AI評価（主観的だが透明化）**
   - AI評価 (0-30点)

3. **合計スコア**: 0-100点

#### スコア計算の詳細表示

```typescript
import { calculateNaturalnessScore } from './lib/security/score-calculator'

const breakdown = calculateNaturalnessScore(text, hashtags, aiScore)
console.log(breakdown.factors) // 各項目のスコア
console.log(breakdown.details) // 詳細な分析
```

### 4. セキュリティ監査ログ

#### 監査ログの記録

すべてのセキュリティ関連イベントが記録されます：

```typescript
import { logApiKeyAccess, logAuthSuccess, logSecurityAlert } from './lib/security/audit-log'

// APIキーアクセス
await logApiKeyAccess('anthropic', userId, ipAddress)

// 認証成功
await logAuthSuccess(userId, 'twitter', ipAddress, userAgent)

// セキュリティアラート
await logSecurityAlert('Suspicious activity detected', { details }, 'high', userId, ipAddress)
```

#### 監査ログの確認

Supabaseの`audit_logs`テーブルで確認できます：

```sql
SELECT * FROM audit_logs 
WHERE event_type = 'api_key_access' 
ORDER BY timestamp DESC 
LIMIT 100;
```

### 5. OAuth 2.0 with PKCE

OAuth 2.0 with PKCEは維持されています。セキュリティ強化により：

- トークンの安全な保存
- 自動リフレッシュ
- トークン漏洩時の検知

## 商用レベルの信頼向上策

### 1. セキュリティヘッダー

`next.config.ts`にセキュリティヘッダーを追加：

```typescript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}
```

### 2. レート制限

API呼び出しのレート制限を実装：

```typescript
// lib/security/rate-limiter.ts
export async function checkRateLimit(
  userId: string,
  action: 'generate' | 'post'
): Promise<boolean> {
  // 実装: ユーザーごとのレート制限チェック
}
```

### 3. 入力検証

すべてのユーザー入力を検証：

```typescript
import { z } from 'zod'

const postSchema = z.object({
  text: z.string().min(1).max(280),
  hashtags: z.array(z.string()).max(10),
})
```

### 4. エラーハンドリング

機密情報をエラーメッセージに含めない：

```typescript
// ❌ 間違い
throw new Error(`API key ${apiKey} is invalid`)

// ✅ 正しい
throw new Error('API authentication failed')
```

### 5. 定期的なセキュリティ監査

- 依存関係の脆弱性チェック: `npm audit`
- 環境変数の漏洩チェック
- コードレビューでのセキュリティ確認

## チェックリスト

### デプロイ前

- [ ] すべての環境変数がVercelに設定されている
- [ ] `NEXT_PUBLIC_`プレフィックスが適切に使用されている
- [ ] 機密情報がクライアントサイドに露出していない
- [ ] セキュリティヘッダーが設定されている
- [ ] 監査ログが有効になっている

### 定期的な確認

- [ ] 依存関係の脆弱性チェック（月1回）
- [ ] 環境変数の再確認（四半期ごと）
- [ ] 監査ログの確認（週1回）
- [ ] セキュリティアップデートの適用

## トラブルシューティング

### 環境変数が見つからないエラー

```
Error: ANTHROPIC_API_KEY is not set
```

**解決方法:**
1. Vercel Dashboardで環境変数を確認
2. 環境（Production/Preview/Development）を確認
3. 再デプロイ

### クライアントサイドでAPIキーにアクセスしようとしたエラー

```
Error: This code can only run on the server
```

**解決方法:**
- `server-only`パッケージが正しくインポートされているか確認
- クライアントコンポーネントからサーバー専用コードを呼び出していないか確認

## 参考資料

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [OAuth 2.0 with PKCE](https://oauth.net/2/pkce/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
