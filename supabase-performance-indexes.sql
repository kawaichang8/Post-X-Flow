-- Performance Optimization: Additional Indexes for Post-X-Flow
-- Run this in Supabase SQL Editor

-- Composite indexes for common query patterns
-- These indexes significantly improve query performance for large datasets

-- 1. User + Created At (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_post_history_user_created_at 
ON post_history(user_id, created_at DESC);

-- 2. User + Status + Created At (filtered queries)
CREATE INDEX IF NOT EXISTS idx_post_history_user_status_created 
ON post_history(user_id, status, created_at DESC);

-- 3. User + Account + Created At (multi-account filtering)
CREATE INDEX IF NOT EXISTS idx_post_history_user_account_created 
ON post_history(user_id, twitter_account_id, created_at DESC)
WHERE twitter_account_id IS NOT NULL;

-- 4. User + Engagement Score (for high engagement queries)
CREATE INDEX IF NOT EXISTS idx_post_history_user_engagement 
ON post_history(user_id, engagement_score DESC NULLS LAST)
WHERE engagement_score IS NOT NULL;

-- 5. User + Status (for status filtering)
CREATE INDEX IF NOT EXISTS idx_post_history_user_status 
ON post_history(user_id, status);

-- 6. Scheduled tweets query optimization
CREATE INDEX IF NOT EXISTS idx_post_history_scheduled 
ON post_history(user_id, scheduled_for)
WHERE status = 'scheduled' AND scheduled_for IS NOT NULL;

-- 7. Composite index for analytics queries (user + date range)
CREATE INDEX IF NOT EXISTS idx_post_history_user_date_range 
ON post_history(user_id, created_at DESC, status, engagement_score DESC);

-- 8. Full-text search optimization (if using text search)
-- Note: Requires pg_trgm extension
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS idx_post_history_text_search 
-- ON post_history USING gin(text gin_trgm_ops);

-- 9. Hashtags array search optimization
CREATE INDEX IF NOT EXISTS idx_post_history_hashtags 
ON post_history USING gin(hashtags);

-- 10. Twitter account tokens optimization
CREATE INDEX IF NOT EXISTS idx_twitter_tokens_user_updated 
ON user_twitter_tokens(user_id, updated_at DESC);

-- Analyze tables to update statistics
ANALYZE post_history;
ANALYZE user_twitter_tokens;
ANALYZE quoted_tweets;

-- Query performance monitoring
-- Run this periodically to check index usage:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE tablename IN ('post_history', 'user_twitter_tokens', 'quoted_tweets')
-- ORDER BY idx_scan DESC;
