-- Supabase Database Schema for Post-X-Flow

-- Table: user_twitter_tokens
-- Stores Twitter OAuth tokens for each user (supports multiple accounts per user)
CREATE TABLE IF NOT EXISTS user_twitter_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  twitter_user_id TEXT, -- Twitter's user ID (for identifying accounts)
  username TEXT, -- Twitter handle (@username)
  display_name TEXT, -- Display name
  profile_image_url TEXT, -- Profile image URL
  account_name TEXT, -- User-defined name for the account
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  is_default BOOLEAN DEFAULT false, -- Default account flag
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  -- Note: UNIQUE(user_id) constraint removed to support multiple accounts
);

-- Enable Row Level Security
ALTER TABLE user_twitter_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Users can view own tokens" ON user_twitter_tokens;
DROP POLICY IF EXISTS "Users can insert own tokens" ON user_twitter_tokens;
DROP POLICY IF EXISTS "Users can update own tokens" ON user_twitter_tokens;
DROP POLICY IF EXISTS "Users can delete own tokens" ON user_twitter_tokens;

-- RLS Policy: Users can only see their own tokens
CREATE POLICY "Users can view own tokens"
  ON user_twitter_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens"
  ON user_twitter_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
  ON user_twitter_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
  ON user_twitter_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Table: twitter_oauth_sessions
-- Temporarily stores OAuth state and code verifier for callback verification
CREATE TABLE IF NOT EXISTS twitter_oauth_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  state TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_verifier TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Enable Row Level Security
ALTER TABLE twitter_oauth_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage oauth sessions" ON twitter_oauth_sessions;

-- RLS Policy: Service role can manage all sessions (for server-side operations)
CREATE POLICY "Service role can manage oauth sessions"
  ON twitter_oauth_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_twitter_oauth_sessions_state ON twitter_oauth_sessions(state);
CREATE INDEX IF NOT EXISTS idx_twitter_oauth_sessions_expires_at ON twitter_oauth_sessions(expires_at);

-- Cleanup expired sessions (run periodically)
-- Note: This can be done via a scheduled job or cron

-- Table: post_history
-- Stores generated posts and their status
CREATE TABLE IF NOT EXISTS post_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  twitter_account_id UUID REFERENCES user_twitter_tokens(id) ON DELETE SET NULL, -- Which Twitter account was used
  text TEXT NOT NULL,
  hashtags TEXT[] DEFAULT '{}',
  naturalness_score INTEGER CHECK (naturalness_score >= 0 AND naturalness_score <= 100),
  trend TEXT,
  purpose TEXT,
  status TEXT CHECK (status IN ('draft', 'posted', 'scheduled', 'deleted')) DEFAULT 'draft',
  tweet_id TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  engagement_score INTEGER DEFAULT 0, -- For tracking engagement (likes, retweets, etc.)
  impression_count INTEGER, -- Number of impressions (views)
  reach_count INTEGER, -- Number of unique accounts reached
  engagement_rate DECIMAL(5, 2), -- Engagement rate (engagement / impressions * 100)
  like_count INTEGER DEFAULT 0,
  retweet_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  quote_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE post_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Users can view own posts" ON post_history;
DROP POLICY IF EXISTS "Users can insert own posts" ON post_history;
DROP POLICY IF EXISTS "Users can update own posts" ON post_history;

-- RLS Policy: Users can only see their own posts
CREATE POLICY "Users can view own posts"
  ON post_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own posts"
  ON post_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON post_history
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add missing columns if table already exists
DO $$
BEGIN
  -- Add engagement_score column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_history' AND column_name = 'engagement_score'
  ) THEN
    ALTER TABLE post_history ADD COLUMN engagement_score INTEGER DEFAULT 0;
  END IF;

  -- Add impression_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_history' AND column_name = 'impression_count'
  ) THEN
    ALTER TABLE post_history ADD COLUMN impression_count INTEGER;
  END IF;

  -- Add reach_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_history' AND column_name = 'reach_count'
  ) THEN
    ALTER TABLE post_history ADD COLUMN reach_count INTEGER;
  END IF;

  -- Add engagement_rate column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_history' AND column_name = 'engagement_rate'
  ) THEN
    ALTER TABLE post_history ADD COLUMN engagement_rate DECIMAL(5, 2);
  END IF;

  -- Add like_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_history' AND column_name = 'like_count'
  ) THEN
    ALTER TABLE post_history ADD COLUMN like_count INTEGER DEFAULT 0;
  END IF;

  -- Add retweet_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_history' AND column_name = 'retweet_count'
  ) THEN
    ALTER TABLE post_history ADD COLUMN retweet_count INTEGER DEFAULT 0;
  END IF;

  -- Add reply_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_history' AND column_name = 'reply_count'
  ) THEN
    ALTER TABLE post_history ADD COLUMN reply_count INTEGER DEFAULT 0;
  END IF;

  -- Add quote_count column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_history' AND column_name = 'quote_count'
  ) THEN
    ALTER TABLE post_history ADD COLUMN quote_count INTEGER DEFAULT 0;
  END IF;

  -- Add twitter_account_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'post_history' AND column_name = 'twitter_account_id'
  ) THEN
    ALTER TABLE post_history ADD COLUMN twitter_account_id UUID REFERENCES user_twitter_tokens(id) ON DELETE SET NULL;
  END IF;
END $$;

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

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_post_history_user_id ON post_history(user_id);
CREATE INDEX IF NOT EXISTS idx_post_history_created_at ON post_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_history_status ON post_history(status);
CREATE INDEX IF NOT EXISTS idx_post_history_engagement ON post_history(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_twitter_tokens_user_id ON user_twitter_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_twitter_tokens_user_id_is_default ON user_twitter_tokens(user_id, is_default);

-- Unique constraint: Prevent duplicate Twitter accounts per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_twitter_tokens_user_twitter_user_id 
ON user_twitter_tokens(user_id, twitter_user_id) 
WHERE twitter_user_id IS NOT NULL;

-- Add missing columns if table already exists (migration support)
DO $$
BEGIN
  -- Remove UNIQUE constraint on user_id if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_twitter_tokens_user_id_key'
  ) THEN
    ALTER TABLE user_twitter_tokens DROP CONSTRAINT user_twitter_tokens_user_id_key;
  END IF;

  -- Add twitter_user_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_twitter_tokens' AND column_name = 'twitter_user_id'
  ) THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN twitter_user_id TEXT;
  END IF;

  -- Add username column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_twitter_tokens' AND column_name = 'username'
  ) THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN username TEXT;
  END IF;

  -- Add display_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_twitter_tokens' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN display_name TEXT;
  END IF;

  -- Add profile_image_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_twitter_tokens' AND column_name = 'profile_image_url'
  ) THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN profile_image_url TEXT;
  END IF;

  -- Add account_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_twitter_tokens' AND column_name = 'account_name'
  ) THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN account_name TEXT;
  END IF;

  -- Add is_default column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_twitter_tokens' AND column_name = 'is_default'
  ) THEN
    ALTER TABLE user_twitter_tokens ADD COLUMN is_default BOOLEAN DEFAULT false;
  END IF;

  -- Set first account as default if no default exists
  UPDATE user_twitter_tokens
  SET is_default = true
  WHERE id IN (
    SELECT DISTINCT ON (user_id) id
    FROM user_twitter_tokens
    WHERE is_default = false OR is_default IS NULL
    ORDER BY user_id, created_at ASC
  );
END $$;
