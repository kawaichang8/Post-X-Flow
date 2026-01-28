-- Promotion settings table (standalone migration)
-- Run this if you've already applied the main schema and only need promotion_settings.

CREATE TABLE IF NOT EXISTS promotion_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT false,
  product_name TEXT DEFAULT '',
  link_url TEXT DEFAULT '',
  template TEXT DEFAULT 'このアイデアを速く試したい人は→[link]でチェック！',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE promotion_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own promotion settings" ON promotion_settings;
DROP POLICY IF EXISTS "Users can insert own promotion settings" ON promotion_settings;
DROP POLICY IF EXISTS "Users can update own promotion settings" ON promotion_settings;

CREATE POLICY "Users can view own promotion settings"
  ON promotion_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own promotion settings"
  ON promotion_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own promotion settings"
  ON promotion_settings FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_promotion_settings_user_id ON promotion_settings(user_id);
