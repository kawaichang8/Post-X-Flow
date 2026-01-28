-- Supabase Migration: Subscription & Usage Tracking for postXflow
-- Run this migration to add monetization support

-- ============================================
-- Table: user_subscriptions
-- Stores subscription status for each user
-- ============================================
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

-- Enable Row Level Security
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription" ON user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON user_subscriptions;

-- RLS Policies
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON user_subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON user_subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- Table: usage_tracking
-- Tracks daily usage for rate limiting
-- ============================================
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  generation_count INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  media_upload_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, usage_date)
);

-- Enable Row Level Security
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own usage" ON usage_tracking;
DROP POLICY IF EXISTS "Users can insert own usage" ON usage_tracking;
DROP POLICY IF EXISTS "Users can update own usage" ON usage_tracking;

-- RLS Policies
CREATE POLICY "Users can view own usage"
  ON usage_tracking
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON usage_tracking
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
  ON usage_tracking
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- Indexes for better performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(subscription_status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_date ON usage_tracking(user_id, usage_date);

-- ============================================
-- Function: Initialize subscription on user signup
-- Creates a free subscription entry when a user signs up
-- ============================================
CREATE OR REPLACE FUNCTION initialize_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_subscriptions (user_id, subscription_status, trial_started_at, trial_ends_at)
  VALUES (
    NEW.id,
    'trial',
    NOW(),
    NOW() + INTERVAL '7 days'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to initialize subscription on user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION initialize_user_subscription();

-- ============================================
-- Function: Get or create today's usage record
-- ============================================
CREATE OR REPLACE FUNCTION get_or_create_daily_usage(p_user_id UUID)
RETURNS usage_tracking AS $$
DECLARE
  v_usage usage_tracking;
BEGIN
  -- Try to get existing record
  SELECT * INTO v_usage
  FROM usage_tracking
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
  
  -- If not found, create one
  IF NOT FOUND THEN
    INSERT INTO usage_tracking (user_id, usage_date)
    VALUES (p_user_id, CURRENT_DATE)
    RETURNING * INTO v_usage;
  END IF;
  
  RETURN v_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: Increment generation count
-- ============================================
CREATE OR REPLACE FUNCTION increment_generation_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO usage_tracking (user_id, usage_date, generation_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET 
    generation_count = usage_tracking.generation_count + 1,
    updated_at = NOW()
  RETURNING generation_count INTO v_count;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: Check if user can generate (rate limit)
-- Returns true if user can generate, false if limit reached
-- ============================================
CREATE OR REPLACE FUNCTION can_user_generate(p_user_id UUID, p_max_generations INTEGER DEFAULT 3)
RETURNS BOOLEAN AS $$
DECLARE
  v_subscription user_subscriptions;
  v_usage usage_tracking;
BEGIN
  -- Get subscription status
  SELECT * INTO v_subscription
  FROM user_subscriptions
  WHERE user_id = p_user_id;
  
  -- Pro users have unlimited generations
  IF v_subscription.subscription_status = 'pro' THEN
    RETURN TRUE;
  END IF;
  
  -- Trial users (within trial period) have pro features
  IF v_subscription.subscription_status = 'trial' 
     AND v_subscription.trial_ends_at > NOW() THEN
    RETURN TRUE;
  END IF;
  
  -- Free users: check daily limit
  SELECT * INTO v_usage
  FROM usage_tracking
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
  
  IF NOT FOUND THEN
    RETURN TRUE; -- No usage yet today
  END IF;
  
  RETURN v_usage.generation_count < p_max_generations;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Migrate existing users: Create subscription records
-- ============================================
INSERT INTO user_subscriptions (user_id, subscription_status, trial_started_at, trial_ends_at)
SELECT 
  id,
  'trial',
  NOW(),
  NOW() + INTERVAL '7 days'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_subscriptions)
ON CONFLICT (user_id) DO NOTHING;
