# 商用レベルの信頼向上策

## 概要

Post-X-Flowを商用レベルで運用するための信頼向上策です。

## 実装済みの対策

### 1. セキュリティヘッダー

`next.config.ts`に以下のセキュリティヘッダーを設定：

- `X-Content-Type-Options: nosniff` - MIMEタイプスニッフィング防止
- `X-Frame-Options: DENY` - クリックジャッキング防止
- `X-XSS-Protection: 1; mode=block` - XSS攻撃防止
- `Referrer-Policy: strict-origin-when-cross-origin` - リファラー情報の制御
- `Permissions-Policy` - ブラウザ機能の制限

### 2. APIキー保護

- `server-only`パッケージによるクライアントサイド露出防止
- 環境変数の検証とセキュリティチェック
- 監査ログによるアクセス記録

### 3. 自然さスコアの透明化

- ルールベース + AI評価のハイブリッド方式
- スコア計算の詳細を表示
- AIバイアスの排除

### 4. セキュリティ監査ログ

- すべてのセキュリティ関連イベントを記録
- Supabaseに保存（90日間保持）
- 定期的な自動クリーンアップ

## 追加推奨事項

### 1. Content Security Policy (CSP)

`next.config.ts`にCSPヘッダーを追加：

```typescript
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.anthropic.com https://api.x.ai https://*.supabase.co https://api.twitter.com",
  ].join('; '),
}
```

### 2. レート制限

API呼び出しのレート制限を実装：

```typescript
// lib/security/rate-limiter.ts
import { createServerClient } from '../supabase'

export async function checkRateLimit(
  userId: string,
  action: 'generate' | 'post',
  limit: number = 10,
  windowMs: number = 60000 // 1分
): Promise<{ allowed: boolean; remaining: number }> {
  // 実装: ユーザーごとのレート制限チェック
  // SupabaseまたはRedisを使用
}
```

### 3. 入力検証

Zodスキーマによる入力検証：

```typescript
import { z } from 'zod'

const postSchema = z.object({
  text: z.string().min(1).max(280).trim(),
  hashtags: z.array(z.string().max(50)).max(10),
  trend: z.string().max(200).optional(),
  purpose: z.string().max(500).optional(),
})
```

### 4. エラーハンドリング

機密情報をエラーメッセージに含めない：

```typescript
// ❌ 間違い
throw new Error(`API key ${apiKey} is invalid`)

// ✅ 正しい
throw new Error('API authentication failed. Please check your configuration.')
```

### 5. 依存関係のセキュリティ監査

定期的な脆弱性チェック：

```bash
# 週次実行
npm audit

# 自動修正（可能な場合）
npm audit fix

# CI/CDに組み込む
npm run audit
```

### 6. セキュリティテスト

- ペネトレーションテスト
- 脆弱性スキャン
- コードレビュー

### 7. インシデント対応計画

1. **検知**: 監査ログとアラート
2. **対応**: 自動的なブロックと通知
3. **復旧**: バックアップからの復旧手順
4. **報告**: ステークホルダーへの報告

### 8. コンプライアンス

- **GDPR**: ユーザーデータの保護
- **SOC 2**: セキュリティ管理
- **ISO 27001**: 情報セキュリティ管理

### 9. 監視とアラート

- **Sentry**: エラー監視
- **Vercel Analytics**: パフォーマンス監視
- **カスタムアラート**: セキュリティイベントの通知

### 10. ドキュメント

- セキュリティポリシー
- インシデント対応手順
- プライバシーポリシー

## チェックリスト

### デプロイ前

- [ ] セキュリティヘッダーが設定されている
- [ ] APIキーが保護されている
- [ ] 環境変数が正しく設定されている
- [ ] 監査ログが有効になっている
- [ ] 依存関係の脆弱性がない

### 定期的な確認

- [ ] 週次: 依存関係の脆弱性チェック
- [ ] 月次: セキュリティ監査ログの確認
- [ ] 四半期: 環境変数の再確認
- [ ] 年次: セキュリティ監査

## 参考資料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [Vercel Security Best Practices](https://vercel.com/docs/security)
