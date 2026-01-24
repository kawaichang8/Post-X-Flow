-- アナリティクス統合用のデータベーススキーマ
-- エンゲージメント予測結果、最適タイミング履歴などを保存

-- エンゲージメント予測結果テーブル
CREATE TABLE IF NOT EXISTS engagement_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES post_history(id) ON DELETE CASCADE,
  predicted_engagement INTEGER NOT NULL CHECK (predicted_engagement >= 0 AND predicted_engagement <= 100),
  actual_engagement INTEGER, -- 実際のエンゲージメント（投稿後に更新）
  confidence DECIMAL(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  method VARCHAR(20) NOT NULL CHECK (method IN ('regression', 'ai', 'hybrid')),
  factors JSONB, -- 予測要因の詳細
  breakdown TEXT, -- AI予測の場合の詳細説明
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 最適タイミング履歴テーブル
CREATE TABLE IF NOT EXISTS optimal_timing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggested_hour INTEGER NOT NULL CHECK (suggested_hour >= 0 AND suggested_hour <= 23),
  suggested_day_of_week INTEGER NOT NULL CHECK (suggested_day_of_week >= 0 AND suggested_day_of_week <= 6),
  suggested_date TIMESTAMPTZ NOT NULL,
  predicted_engagement INTEGER NOT NULL CHECK (predicted_engagement >= 0 AND predicted_engagement <= 100),
  confidence DECIMAL(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reason TEXT,
  was_used BOOLEAN DEFAULT FALSE, -- 実際に使用されたか
  actual_engagement INTEGER, -- 使用された場合の実際のエンゲージメント
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 外部APIデータキャッシュテーブル
CREATE TABLE IF NOT EXISTS external_api_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_type VARCHAR(50) NOT NULL, -- 'polygon', 'news', 'twitter_trends'
  data JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_engagement_predictions_user_id ON engagement_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_predictions_post_id ON engagement_predictions(post_id);
CREATE INDEX IF NOT EXISTS idx_engagement_predictions_created_at ON engagement_predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_optimal_timing_history_user_id ON optimal_timing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_optimal_timing_history_suggested_date ON optimal_timing_history(suggested_date);
CREATE INDEX IF NOT EXISTS idx_external_api_cache_api_type ON external_api_cache(api_type);
CREATE INDEX IF NOT EXISTS idx_external_api_cache_expires_at ON external_api_cache(expires_at);

-- RLSポリシー
ALTER TABLE engagement_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimal_timing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_api_cache ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の予測結果のみ閲覧可能
CREATE POLICY "Users can view their own engagement predictions"
  ON engagement_predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own engagement predictions"
  ON engagement_predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own engagement predictions"
  ON engagement_predictions FOR UPDATE
  USING (auth.uid() = user_id);

-- ユーザーは自分のタイミング履歴のみ閲覧可能
CREATE POLICY "Users can view their own timing history"
  ON optimal_timing_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own timing history"
  ON optimal_timing_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own timing history"
  ON optimal_timing_history FOR UPDATE
  USING (auth.uid() = user_id);

-- 外部APIキャッシュは全ユーザーが閲覧可能（読み取り専用）
CREATE POLICY "Users can view external API cache"
  ON external_api_cache FOR SELECT
  USING (expires_at > NOW());

-- 更新日時を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_engagement_predictions_updated_at
  BEFORE UPDATE ON engagement_predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 古いキャッシュを自動削除する関数
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM external_api_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 定期的にキャッシュをクリーンアップ（手動実行またはcronで実行）
-- SELECT cleanup_expired_cache();
