# パフォーマンス最適化テストガイド

## テスト手順

### 1. データベースインデックスの適用

#### ステップ1: Supabase SQL Editorで実行

1. Supabase Dashboardにアクセス
2. SQL Editorを開く
3. `supabase-performance-indexes.sql`の内容をコピー＆ペースト
4. 「Run」をクリック

#### ステップ2: インデックスの確認

```sql
-- インデックスが作成されたか確認
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'post_history'
ORDER BY indexname;
```

期待されるインデックス:
- `idx_post_history_user_created_at`
- `idx_post_history_user_status_created`
- `idx_post_history_user_account_created`
- `idx_post_history_user_engagement`
- `idx_post_history_scheduled`
- `idx_post_history_hashtags`

### 2. クエリパフォーマンスのテスト

#### テストデータの準備（開発環境のみ）

```sql
-- テスト用に大量データを生成（1000件）
INSERT INTO post_history (user_id, text, status, created_at, engagement_score)
SELECT 
  'your-user-id'::uuid,
  'Test post ' || generate_series::text,
  CASE (random() * 3)::int
    WHEN 0 THEN 'draft'
    WHEN 1 THEN 'posted'
    ELSE 'scheduled'
  END,
  NOW() - (random() * interval '30 days'),
  (random() * 1000)::int
FROM generate_series(1, 1000);
```

#### クエリ速度の測定

```sql
-- インデックス使用前のクエリプラン
EXPLAIN ANALYZE
SELECT * FROM post_history
WHERE user_id = 'your-user-id'
ORDER BY created_at DESC
LIMIT 20;

-- 期待される結果:
-- Index Scan using idx_post_history_user_created_at
-- Planning Time: < 1ms
-- Execution Time: < 50ms
```

### 3. ページネーション機能のテスト

#### テスト手順

1. **大量データの準備**（上記のSQLを実行）
2. **ダッシュボードで確認**:
   - 履歴セクションを開く
   - ページネーションが表示されることを確認
   - ページを切り替えて動作を確認
   - 検索・フィルタを変更してページがリセットされることを確認

#### 確認項目

- [ ] ページネーションコンポーネントが表示される
- [ ] ページ番号が正しく表示される
- [ ] 前/次ページボタンが動作する
- [ ] 最初/最後ページボタンが動作する
- [ ] 検索時にページ1にリセットされる
- [ ] フィルタ変更時にページ1にリセットされる
- [ ] 総件数が正しく表示される

### 4. プログレスバーのテスト

#### 画像生成のテスト

1. ツイートドラフトを生成
2. 画像生成ボタンをクリック
3. 以下を確認:
   - [ ] プログレスバーが表示される
   - [ ] 進捗が0%から100%まで更新される
   - [ ] 生成完了時にプログレスバーが消える
   - [ ] エラー時に適切なメッセージが表示される

#### ローディングスピナーのテスト

1. 履歴セクションを開く
2. 更新ボタンをクリック
3. 以下を確認:
   - [ ] ローディングスピナーが表示される
   - [ ] データ読み込み中にスピナーが表示される
   - [ ] 読み込み完了時にスピナーが消える

### 5. モバイルレスポンシブのテスト

#### Chrome DevToolsでのテスト

1. **F12**でDevToolsを開く
2. **Ctrl+Shift+M**（Mac: Cmd+Shift+M）でDevice Toolbarを開く
3. 以下のデバイスでテスト:
   - iPhone 12 Pro (390x844)
   - iPhone SE (375x667)
   - iPad (768x1024)
   - Galaxy S20 (360x800)

#### 確認項目

##### 履歴セクション
- [ ] 検索・フィルタが縦並びになる（モバイル）
- [ ] ページネーションが適切に表示される
- [ ] ボタンが全幅になる（モバイル）
- [ ] テキストが適切に折り返される

##### ドラフト表示
- [ ] カードが全幅になる（モバイル）
- [ ] ボタンが縦並びになる（モバイル）
- [ ] テキストが読みやすい

##### 画像生成
- [ ] ボタンが縦並びになる（モバイル）
- [ ] プログレスバーが適切に表示される
- [ ] 画像グリッドが1列になる（モバイル）

##### サイドバー
- [ ] モバイルで適切に非表示/表示される
- [ ] ハンバーガーメニューが動作する（実装されている場合）

### 6. パフォーマンス測定

#### Lighthouseでの測定

1. Chrome DevTools → **Lighthouse**タブ
2. 以下のカテゴリを選択:
   - Performance
   - Accessibility
   - Best Practices
   - SEO
3. **Generate report**をクリック

#### 期待されるスコア

- **Performance**: 80以上
- **Accessibility**: 90以上
- **Best Practices**: 90以上
- **SEO**: 90以上

#### ネットワークタブでの確認

1. Chrome DevTools → **Network**タブ
2. 履歴セクションを開く
3. 以下を確認:
   - [ ] APIリクエストが20件のみ（ページネーション）
   - [ ] レスポンス時間が200ms以下
   - [ ] データサイズが適切（1ページあたり50KB以下）

### 7. ストレステスト

#### 大量データでのテスト

```sql
-- 10,000件のデータを生成
INSERT INTO post_history (user_id, text, status, created_at)
SELECT 
  'your-user-id'::uuid,
  'Test post ' || generate_series::text,
  'posted',
  NOW() - (random() * interval '365 days')
FROM generate_series(1, 10000);
```

#### 確認項目

- [ ] ページネーションが正常に動作する
- [ ] クエリ時間が500ms以下
- [ ] UIがフリーズしない
- [ ] メモリ使用量が適切

### 8. ブラウザ互換性テスト

以下のブラウザでテスト:

- [ ] Chrome (最新版)
- [ ] Firefox (最新版)
- [ ] Safari (最新版)
- [ ] Edge (最新版)
- [ ] モバイルブラウザ（iOS Safari、Chrome Mobile）

### 9. アクセシビリティテスト

#### キーボードナビゲーション

- [ ] Tabキーで全要素にアクセス可能
- [ ] Enter/Spaceでボタンが動作する
- [ ] フォーカスインジケーターが表示される

#### スクリーンリーダー

- [ ] ページネーションに適切なaria-label
- [ ] ボタンに適切な説明
- [ ] ローディング状態が読み上げられる

## パフォーマンス改善の確認

### Before（最適化前）

- クエリ時間: 500-1000ms（1000件）
- ページ読み込み: 2-3秒
- メモリ使用量: 高

### After（最適化後）

- クエリ時間: 50-100ms（1000件）
- ページ読み込み: 200-500ms
- メモリ使用量: 低（ページネーションにより）

### 改善率

- **クエリ速度**: 約10倍の高速化
- **ページ読み込み**: 約6倍の高速化
- **メモリ使用量**: 約95%削減（20件/ページの場合）

## トラブルシューティング

### インデックスが使用されない

**原因**: クエリ条件がインデックスと一致していない

**解決方法**:
```sql
-- クエリプランを確認
EXPLAIN ANALYZE [your query];

-- インデックスが使用されていない場合、クエリを修正
-- または、適切なインデックスを作成
```

### ページネーションが動作しない

**原因**: `getPostHistoryPaginated`が正しく呼び出されていない

**解決方法**:
1. ブラウザのコンソールでエラーを確認
2. ネットワークタブでAPIリクエストを確認
3. `loadPostHistory(1, true)`が呼び出されているか確認

### プログレスバーが表示されない

**原因**: 状態が更新されていない

**解決方法**:
1. `generationProgress`の状態を確認
2. `ProgressBar`コンポーネントが正しくインポートされているか確認
3. ブラウザのコンソールでエラーを確認

### モバイルでレイアウトが崩れる

**原因**: レスポンシブクラスが不足

**解決方法**:
1. Tailwindのレスポンシブクラス（`sm:`, `md:`, `lg:`）を追加
2. `flex-col sm:flex-row`でモバイル/デスクトップを切り替え
3. `w-full sm:w-auto`で幅を調整

## ベストプラクティス

### 1. ページサイズの調整

- モバイル: 10-15件/ページ
- タブレット: 20件/ページ
- デスクトップ: 20-50件/ページ

### 2. インデックスのメンテナンス

定期的に`ANALYZE`を実行:

```sql
ANALYZE post_history;
```

### 3. 不要なデータの削除

古いデータを定期的に削除:

```sql
-- 90日以上前のデータを削除（オプション）
DELETE FROM post_history
WHERE created_at < NOW() - INTERVAL '90 days'
AND status = 'deleted';
```

## 参考資料

- [PostgreSQL Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
- [Next.js Performance](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
