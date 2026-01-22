# 複数Twitterアカウント対応 - マイグレーションガイド

## 問題
現在、`user_twitter_tokens`テーブルに`UNIQUE(user_id)`制約があるため、1ユーザーにつき1アカウントしか保存できません。

## 解決方法

### ステップ1: Supabase SQL Editorでマイグレーションを実行

1. Supabaseダッシュボードにログイン
2. SQL Editorを開く
3. 以下のSQLを実行：

```sql
-- Step 1: Remove UNIQUE constraint on user_id
ALTER TABLE user_twitter_tokens DROP CONSTRAINT IF EXISTS user_twitter_tokens_user_id_key;

-- Step 2: Add new columns for account identification
DO $$
BEGIN
  -- Add twitter_user_id column (Twitter's user ID)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_twitter_tokens' AND column_name = 'twitter_user_id'
  ) THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN twitter_user_id TEXT;
  END IF;

  -- Add username column (Twitter handle)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_twitter_tokens' AND column_name = 'username'
  ) THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN username TEXT;
  END IF;

  -- Add display_name column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_twitter_tokens' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN display_name TEXT;
  END IF;

  -- Add profile_image_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_twitter_tokens' AND column_name = 'profile_image_url'
  ) THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN profile_image_url TEXT;
  END IF;

  -- Add is_default column (default account flag)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_twitter_tokens' AND column_name = 'is_default'
  ) THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN is_default BOOLEAN DEFAULT false;
  END IF;

  -- Add account_name column (user-defined name for the account)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_twitter_tokens' AND column_name = 'account_name'
  ) THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN account_name TEXT;
  END IF;
END $$;

-- Step 3: Set first account as default if no default exists
UPDATE user_twitter_tokens
SET is_default = true
WHERE id IN (
  SELECT DISTINCT ON (user_id) id
  FROM user_twitter_tokens
  WHERE is_default = false OR is_default IS NULL
  ORDER BY user_id, created_at ASC
);

-- Step 4: Add unique constraint for twitter_user_id per user (prevent duplicate accounts)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_twitter_tokens_user_twitter_user_id 
ON user_twitter_tokens(user_id, twitter_user_id) 
WHERE twitter_user_id IS NOT NULL;

-- Step 5: Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_twitter_tokens_user_id_is_default 
ON user_twitter_tokens(user_id, is_default);
```

### ステップ2: 動作確認

1. アプリを再起動
2. ダッシュボードの「アカウント」メニューに移動
3. 「アカウントを追加」ボタンをクリック
4. 別のTwitterアカウントでログイン
5. 複数のアカウントが表示されることを確認

## 機能

- ✅ 複数のTwitterアカウントを連携可能
- ✅ デフォルトアカウントの設定
- ✅ アカウントの切り替え
- ✅ アカウントの削除
- ✅ アカウント名の編集

## 注意事項

- 同じTwitterアカウントを重複して追加することはできません（`twitter_user_id`で制限）
- 最初に追加されたアカウントが自動的にデフォルトになります
- デフォルトアカウントは投稿時に使用されます
