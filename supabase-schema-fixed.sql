-- Supabase Database Schema for Post-X-Flow

-- Table: user_twitter_tokens
-- Stores Twitter OAuth tokens for each user
CREATE TABLE IF NOT EXISTS user_twitter_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE user_twitter_tokens ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Users can view own tokens" ON user_twitter_tokens;
DROP POLICY IF EXISTS "Users can insert own tokens" ON user_twitter_tokens;
DROP POLICY IF EXISTS "Users can update own tokens" ON user_twitter_tokens;

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

-- Table: post_history
-- Stores generated posts and their status
CREATE TABLE IF NOT EXISTS post_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  hashtags TEXT[] DEFAULT '{}',
  naturalness_score INTEGER CHECK (naturalness_score >= 0 AND naturalness_score <= 100),
  trend TEXT,
  purpose TEXT,
  status TEXT CHECK (status IN ('draft', 'posted', 'scheduled', 'deleted')) DEFAULT 'draft',
  tweet_id TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
END $$;

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

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_post_history_user_id ON post_history(user_id);
CREATE INDEX IF NOT EXISTS idx_post_history_created_at ON post_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_history_status ON post_history(status);
CREATE INDEX IF NOT EXISTS idx_post_history_engagement ON post_history(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_twitter_tokens_user_id ON user_twitter_tokens(user_id);
