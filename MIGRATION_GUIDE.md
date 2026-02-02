# 本番 Supabase マイグレーションガイド

本番（Vercel デプロイ先）で発生する Supabase エラーを解消するため、不足しているテーブル・カラムを追加する手順です。

---

## エラーと対応一覧

| ログのエラー | 原因 | 対応セクション |
|-------------|------|----------------|
| `Could not find the table 'public.user_subscriptions'` | テーブル未作成 | [2. user_subscriptions](#2-user_subscriptions-テーブル) |
| `Could not find the table 'public.usage_tracking'` | テーブル未作成 | [3. usage_tracking](#3-usage_tracking-テーブル) |
| `column post_history.scheduled_for does not exist` | カラム未追加 | [4. post_history.scheduled_for](#4-post_historyscheduled_for-カラム) |
| 下書き保存できない / `context_used` or `fact_score` does not exist | カラム未追加 | [5. post_history の context_used / fact_score](#5-post_history-の-context_used--fact_score-カラム) |
| 生成履歴が出てこない / `Could not find the table 'public.generation_history'` | テーブル未作成 | [6. generation_history テーブル](#6-generation_history-テーブル) |
| 複数 Twitter アカウントが使えない | `user_id` の UNIQUE 制約 | [1. 複数アカウント](#1-複数twitterアカウント) |

---

## 実行手順

1. [Supabase](https://supabase.com) ダッシュボード → 本番プロジェクトを開く
2. **SQL Editor** を開く
3. 以下のセクションを **上から順に** 実行する（既に存在するオブジェクトは `IF NOT EXISTS` でスキップされます）

---

## 1. 複数 Twitter アカウント

**目的**: 1 ユーザーで複数 X アカウントを連携できるようにする。

```sql
-- Step 1: Remove UNIQUE constraint on user_id
ALTER TABLE user_twitter_tokens DROP CONSTRAINT IF EXISTS user_twitter_tokens_user_id_key;

-- Step 2: Add new columns for account identification
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_twitter_tokens' AND column_name = 'twitter_user_id') THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN twitter_user_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_twitter_tokens' AND column_name = 'username') THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN username TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_twitter_tokens' AND column_name = 'display_name') THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN display_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_twitter_tokens' AND column_name = 'profile_image_url') THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN profile_image_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_twitter_tokens' AND column_name = 'is_default') THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN is_default BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_twitter_tokens' AND column_name = 'account_name') THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN account_name TEXT;
  END IF;
END $$;

UPDATE user_twitter_tokens SET is_default = true
WHERE id IN (SELECT DISTINCT ON (user_id) id FROM user_twitter_tokens WHERE is_default = false OR is_default IS NULL ORDER BY user_id, created_at ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_twitter_tokens_user_twitter_user_id ON user_twitter_tokens(user_id, twitter_user_id) WHERE twitter_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_twitter_tokens_user_id_is_default ON user_twitter_tokens(user_id, is_default);
```

---

## 2. user_subscriptions テーブル

**目的**: サブスクリプション・トライアル状態を保存する。  
**解消するエラー**: `Could not find the table 'public.user_subscriptions'`

```sql
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  subscription_status TEXT CHECK (subscription_status IN ('free', 'trial', 'pro', 'cancelled')) DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  trial_started_at TIMESTAMP WITH TIME ZONE,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  subscription_started_at TIMESTAMP WITH TIME ZONE,
  subscription_ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON user_subscriptions;

CREATE POLICY "Users can view own subscription" ON user_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription" ON user_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscription" ON user_subscriptions FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(subscription_status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);

-- 既存ユーザーにサブスクリプション行を作成（トライアル）
INSERT INTO user_subscriptions (user_id, subscription_status, trial_started_at, trial_ends_at)
SELECT id, 'trial', NOW(), NOW() + INTERVAL '7 days' FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_subscriptions)
ON CONFLICT (user_id) DO NOTHING;
```

---

## 3. usage_tracking テーブル

**目的**: 日別の生成回数・投稿回数などを記録（無料枠の制限に利用）。  
**解消するエラー**: `Could not find the table 'public.usage_tracking'`

```sql
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  generation_count INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  media_upload_count INTEGER DEFAULT 0,
  quote_rt_generation_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, usage_date)
);

ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage" ON usage_tracking;
DROP POLICY IF EXISTS "Users can insert own usage" ON usage_tracking;
DROP POLICY IF EXISTS "Users can update own usage" ON usage_tracking;

CREATE POLICY "Users can view own usage" ON usage_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usage" ON usage_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own usage" ON usage_tracking FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_date ON usage_tracking(user_id, usage_date);
```

---

## 4. post_history.scheduled_for カラム

**目的**: 予約投稿の日時を保存する。  
**解消するエラー**: `column post_history.scheduled_for does not exist`

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'post_history' AND column_name = 'scheduled_for'
  ) THEN
    ALTER TABLE post_history ADD COLUMN scheduled_for TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;
```

---

## 5. post_history の context_used / fact_score カラム

**目的**: 下書き・投稿履歴に「コンテキスト利用」「事実確認スコア」を保存する（アナリティクス用）。  
**解消するエラー**: 下書き保存時の `column ... does not exist`（context_used / fact_score がない場合）

> 注: アプリはこれらのカラムがなくても下書き保存を試みますが、本マイグレーションを実行すると完全に保存されます。

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'post_history' AND column_name = 'context_used'
  ) THEN
    ALTER TABLE post_history ADD COLUMN context_used BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'post_history' AND column_name = 'fact_score'
  ) THEN
    ALTER TABLE post_history ADD COLUMN fact_score INTEGER CHECK (fact_score IS NULL OR (fact_score >= 0 AND fact_score <= 100));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'post_history' AND column_name = 'ab_test_id'
  ) THEN
    ALTER TABLE post_history ADD COLUMN ab_test_id UUID;
  END IF;
END $$;
```

---

## 6. generation_history テーブル

**目的**: 生成履歴（いつ・何を生成したか）を月別に表示する。  
**解消するエラー**: `Could not find the table 'public.generation_history'` / 生成履歴が出てこない

```sql
CREATE TABLE IF NOT EXISTS generation_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  trend TEXT,
  purpose TEXT,
  draft_count INTEGER NOT NULL DEFAULT 0,
  drafts JSONB NOT NULL DEFAULT '[]',
  ai_provider TEXT CHECK (ai_provider IS NULL OR ai_provider IN ('grok', 'claude')),
  context_used BOOLEAN DEFAULT false,
  fact_used BOOLEAN DEFAULT false
);

ALTER TABLE generation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own generation_history" ON generation_history;
DROP POLICY IF EXISTS "Users can insert own generation_history" ON generation_history;
DROP POLICY IF EXISTS "Users can delete own generation_history" ON generation_history;

CREATE POLICY "Users can view own generation_history" ON generation_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own generation_history" ON generation_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own generation_history" ON generation_history FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_generation_history_user_created ON generation_history(user_id, created_at DESC);
```

---

## 7. （任意）サインアップ時のサブスクリプション初期化

`user_subscriptions` を作成したあと、**新規ユーザー登録時に自動でトライアル行を 1 件作成**したい場合のみ実行してください。

```sql
CREATE OR REPLACE FUNCTION initialize_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_subscriptions (user_id, subscription_status, trial_started_at, trial_ends_at)
  VALUES (NEW.id, 'trial', NOW(), NOW() + INTERVAL '7 days');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION initialize_user_subscription();
```

---

## 実行後の確認

- ダッシュボードの **Table Editor** で以下が存在することを確認する:
  - `user_subscriptions`
  - `usage_tracking`
  - `post_history` に `scheduled_for` カラムがあること
  - （推奨）`context_used` / `fact_score` / `ab_test_id` があると下書き・投稿履歴が完全に保存されます（[5. post_history の context_used / fact_score](#5-post_history-の-context_used--fact_score-カラム)）
  - `generation_history` テーブルがあると「生成履歴」が表示されます（[6. generation_history テーブル](#6-generation_history-テーブル)）
- 再度 Vercel でアプリにアクセスし、ログに同じエラーが出ないことを確認する。

---

## 参考: トレンド取得 429 について

ログに `[PersonalizedTrends] Error: { status: 429, body: 'Too Many Requests' }` が出る場合は **X API のレート制限**です。Supabase のマイグレーションでは解消しません。

- **Vercel の Environment Variables** に `TWITTER_BEARER_TOKEN` を設定すると、WOEID 日本（日本のトレンド）を先に試すため、personalized の 429 を避けやすくなります。
- 時間をおいて再度トレンド取得を試すと 429 が解消されることがあります。
