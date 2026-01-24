-- Community Templates Table for Post-X-Flow
-- ユーザー間でツイートテンプレートを共有するためのテーブル

-- Table: community_templates
-- Stores shared tweet templates from users
CREATE TABLE IF NOT EXISTS community_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- テンプレートのタイトル
  text TEXT NOT NULL, -- ツイートテキスト
  hashtags TEXT[] DEFAULT '{}', -- ハッシュタグ
  trend TEXT, -- 関連トレンド
  purpose TEXT, -- 投稿目的
  format_type TEXT, -- フォーマットタイプ（見出し型、質問型など）
  naturalness_score INTEGER CHECK (naturalness_score >= 0 AND naturalness_score <= 100),
  engagement_score INTEGER DEFAULT 0, -- 元のツイートのエンゲージメントスコア
  is_anonymous BOOLEAN DEFAULT false, -- 匿名共有かどうか
  is_approved BOOLEAN DEFAULT false, -- 承認済みかどうか（モデレーション用）
  view_count INTEGER DEFAULT 0, -- 閲覧回数
  use_count INTEGER DEFAULT 0, -- 使用回数
  like_count INTEGER DEFAULT 0, -- いいね数
  category TEXT, -- カテゴリ（プロモーション、コンテンツ、エンゲージメントなど）
  tags TEXT[] DEFAULT '{}', -- タグ（検索用）
  description TEXT, -- テンプレートの説明
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE community_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can view approved templates
CREATE POLICY "Anyone can view approved templates"
  ON community_templates
  FOR SELECT
  USING (is_approved = true);

-- RLS Policy: Users can view their own templates (even if not approved)
CREATE POLICY "Users can view own templates"
  ON community_templates
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own templates
CREATE POLICY "Users can insert own templates"
  ON community_templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own templates
CREATE POLICY "Users can update own templates"
  ON community_templates
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own templates
CREATE POLICY "Users can delete own templates"
  ON community_templates
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_community_templates_approved ON community_templates(is_approved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_templates_category ON community_templates(category);
CREATE INDEX IF NOT EXISTS idx_community_templates_tags ON community_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_community_templates_user_id ON community_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_community_templates_engagement ON community_templates(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_community_templates_use_count ON community_templates(use_count DESC);

-- Table: template_likes
-- Stores likes on templates
CREATE TABLE IF NOT EXISTS template_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES community_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(template_id, user_id) -- 1ユーザー1いいね
);

-- Enable Row Level Security
ALTER TABLE template_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can view likes
CREATE POLICY "Anyone can view likes"
  ON template_likes
  FOR SELECT
  USING (true);

-- RLS Policy: Users can insert their own likes
CREATE POLICY "Users can insert own likes"
  ON template_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own likes
CREATE POLICY "Users can delete own likes"
  ON template_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_template_likes_template_id ON template_likes(template_id);
CREATE INDEX IF NOT EXISTS idx_template_likes_user_id ON template_likes(user_id);

-- Function: Update template use_count when used
CREATE OR REPLACE FUNCTION increment_template_use_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE community_templates
  SET use_count = use_count + 1
  WHERE id = NEW.template_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Increment use_count when template is used (if we track this in post_history)
-- Note: This would require adding template_id to post_history table

-- Function: Update template like_count
CREATE OR REPLACE FUNCTION update_template_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_templates
    SET like_count = like_count + 1
    WHERE id = NEW.template_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_templates
    SET like_count = GREATEST(0, like_count - 1)
    WHERE id = OLD.template_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update like_count when likes are added/removed
CREATE TRIGGER update_template_like_count_trigger
  AFTER INSERT OR DELETE ON template_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_template_like_count();

-- Function: Update template view_count
CREATE OR REPLACE FUNCTION increment_template_view_count(template_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE community_templates
  SET view_count = view_count + 1
  WHERE id = template_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Table: user_suggestions
-- Stores user suggestions/feedback (for GitHub Issues integration)
CREATE TABLE IF NOT EXISTS user_suggestions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL if anonymous
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT, -- feature, bug, improvement, etc.
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'closed')),
  github_issue_url TEXT, -- GitHub Issue URL if created
  github_issue_number INTEGER, -- GitHub Issue number
  is_anonymous BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own suggestions
CREATE POLICY "Users can view own suggestions"
  ON user_suggestions
  FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IS NULL);

-- RLS Policy: Anyone can insert suggestions (for anonymous submissions)
CREATE POLICY "Anyone can insert suggestions"
  ON user_suggestions
  FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Users can update their own suggestions
CREATE POLICY "Users can update own suggestions"
  ON user_suggestions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_suggestions_status ON user_suggestions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_suggestions_user_id ON user_suggestions(user_id);
