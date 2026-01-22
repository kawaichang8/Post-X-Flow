# データベースセットアップ手順

## 引用ツイート機能のテーブル作成

引用リツイート機能を使用するには、Supabaseで以下のテーブルを作成する必要があります。

### 手順

1. **Supabaseダッシュボードにアクセス**
   - https://supabase.com/dashboard にログイン
   - プロジェクトを選択

2. **SQL Editorを開く**
   - 左サイドバーから「SQL Editor」をクリック

3. **以下のSQLを実行**

```sql
-- Table: quoted_tweets
-- Stores frequently used quoted tweets for reuse
CREATE TABLE IF NOT EXISTS quoted_tweets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  tweet_text TEXT NOT NULL,
  tweet_url TEXT,
  author_name TEXT,
  author_handle TEXT,
  author_avatar_url TEXT,
  tweet_id TEXT,
  media_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE quoted_tweets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own quoted tweets" ON quoted_tweets;
DROP POLICY IF EXISTS "Users can insert own quoted tweets" ON quoted_tweets;
DROP POLICY IF EXISTS "Users can update own quoted tweets" ON quoted_tweets;
DROP POLICY IF EXISTS "Users can delete own quoted tweets" ON quoted_tweets;

-- RLS Policies
CREATE POLICY "Users can view own quoted tweets"
  ON quoted_tweets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quoted tweets"
  ON quoted_tweets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quoted tweets"
  ON quoted_tweets
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quoted tweets"
  ON quoted_tweets
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quoted_tweets_user_id ON quoted_tweets(user_id);
CREATE INDEX IF NOT EXISTS idx_quoted_tweets_created_at ON quoted_tweets(created_at DESC);
```

4. **実行ボタンをクリック**
   - SQL Editorの下部にある「Run」ボタンをクリック
   - 成功メッセージが表示されれば完了です

### 確認方法

テーブルが正しく作成されたか確認するには：

1. 左サイドバーから「Table Editor」をクリック
2. `quoted_tweets`テーブルが表示されているか確認

これで引用ツイート機能が使用できるようになります！
