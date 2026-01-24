# テストガイド

Post-X-Flowのテスト戦略と実行方法を説明します。

## テスト構成

### テストフレームワーク

- **Jest**: テストランナー
- **React Testing Library**: Reactコンポーネントのテスト
- **@testing-library/jest-dom**: DOMマッチャー

### テストの種類

1. **ユニットテスト**: 個別の関数・コンポーネントのテスト
2. **統合テスト**: 複数のモジュールの連携テスト
3. **E2Eテスト**: エンドツーエンドのテスト（将来実装予定）

## テストの実行

### すべてのテストを実行

```bash
npm test
```

### ウォッチモードで実行

```bash
npm test -- --watch
```

### カバレッジレポートを生成

```bash
npm test -- --coverage
```

カバレッジレポートは `coverage/` ディレクトリに生成されます。

### 特定のテストファイルを実行

```bash
npm test -- components/__tests__/PostDraft.test.tsx
```

### 特定のテストを実行

```bash
npm test -- -t "renders draft text correctly"
```

## テストカバレッジ目標

- **全体**: 70%以上
- **主要コンポーネント**: 90%以上
- **生成ロジック**: 90%以上
- **エラーハンドリング**: 80%以上

## テストファイルの構造

```
freexboost/
├── components/
│   ├── __tests__/
│   │   ├── PostDraft.test.tsx
│   │   ├── Pagination.test.tsx
│   │   └── ProgressBar.test.tsx
│   └── PostDraft.tsx
├── lib/
│   ├── __tests__/
│   │   ├── score-calculator.test.ts
│   │   └── error-handler.test.ts
│   └── ai-generator.ts
└── jest.config.js
```

## 主要テストケース

### コンポーネントテスト

#### PostDraft.test.tsx
- ✅ ドラフトテキストの表示
- ✅ 自然さスコアの表示
- ✅ ハッシュタグの表示
- ✅ 承認ボタンの動作
- ✅ スケジュール機能
- ✅ コピー機能
- ✅ スコアに応じた色分け

#### Pagination.test.tsx
- ✅ ページネーションコントロールの表示
- ✅ ページ変更の動作
- ✅ 前/次ボタンの動作
- ✅ 最初/最後ページでのボタン無効化
- ✅ 多数ページでの省略表示

#### ProgressBar.test.tsx
- ✅ プログレスバーの値表示
- ✅ パーセンテージ表示
- ✅ 0-100%の範囲制限
- ✅ ローディングスピナー
- ✅ ローディングオーバーレイ

### ロジックテスト

#### score-calculator.test.ts
- ✅ 自然なテキストの高スコア計算
- ✅ スパム風テキストの低スコア計算
- ✅ 過剰ハッシュタグのペナルティ
- ✅ 適切な文字数の評価
- ✅ 短すぎる/長すぎるテキストのペナルティ
- ✅ スパム指標の検出
- ✅ 可読性スコアの計算
- ✅ AIスコアの使用/推定
- ✅ 詳細ブレークダウンの提供

#### error-handler.test.ts
- ✅ Twitter APIエラーの分類
- ✅ Claude APIエラーの分類
- ✅ Supabaseエラーの分類
- ✅ レート制限エラーの検出
- ✅ リトライロジック
- ✅ 指数バックオフ
- ✅ リトライ不可能エラーの処理

## モック

### Next.js Router

`jest.setup.js`でNext.jsのルーターをモックしています。

```javascript
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      // ...
    }
  },
}))
```

### Supabase Client

Supabaseクライアントもモックされています。

```javascript
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { /* ... */ },
    from: jest.fn(/* ... */),
  },
}))
```

## テストのベストプラクティス

### 1. テストの独立性

各テストは独立して実行できるようにします。`beforeEach`でモックをリセットします。

```typescript
beforeEach(() => {
  jest.clearAllMocks()
})
```

### 2. 明確なテスト名

テスト名は何をテストしているか明確にします。

```typescript
it('calculates high score for natural text', () => {
  // ...
})
```

### 3. AAA パターン

- **Arrange**: テストデータの準備
- **Act**: テスト対象の実行
- **Assert**: 結果の検証

```typescript
it('calls onApprove when approve button is clicked', () => {
  // Arrange
  const mockOnApprove = jest.fn()
  render(<PostDraft onApprove={mockOnApprove} />)
  
  // Act
  fireEvent.click(screen.getByText(/承認して投稿/))
  
  // Assert
  expect(mockOnApprove).toHaveBeenCalled()
})
```

### 4. エッジケースのテスト

- 空の値
- 境界値（0, 100など）
- エラーケース
- null/undefined

### 5. 非同期処理のテスト

`waitFor`を使用して非同期処理を待機します。

```typescript
await waitFor(() => {
  expect(mockOnApprove).toHaveBeenCalled()
})
```

## CI/CDでのテスト

### GitHub Actions（推奨）

`.github/workflows/test.yml`を作成:

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci --legacy-peer-deps
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### Vercelでのテスト

Vercelのビルドコマンドにテストを含めます:

```json
{
  "scripts": {
    "build": "npm test && next build"
  }
}
```

## テストの追加

### 新しいコンポーネントのテスト

1. `components/__tests__/ComponentName.test.tsx`を作成
2. 基本的なレンダリングテストを追加
3. 主要なインタラクションテストを追加
4. エッジケースのテストを追加

### 新しいロジックのテスト

1. `lib/__tests__/function-name.test.ts`を作成
2. 正常系のテストを追加
3. 異常系のテストを追加
4. エッジケースのテストを追加

## トラブルシューティング

### テストがタイムアウトする

```typescript
jest.setTimeout(10000) // 10秒に設定
```

### モックが動作しない

`jest.setup.js`でモックが正しく設定されているか確認してください。

### 環境変数が読み込まれない

`jest.setup.js`で環境変数を設定してください。

```javascript
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
```

## 参考資料

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
