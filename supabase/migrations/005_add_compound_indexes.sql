-- Migration 005: Add compound indexes for query optimization
-- This migration adds composite indexes to speed up common query patterns

-- Compound index for requests filtered by org_id and created_at
-- Used by dashboard queries: GET /v1/usage with date ranges
-- This is more efficient than separate indexes when filtering by both columns
CREATE INDEX IF NOT EXISTS idx_requests_org_created
ON requests(org_id, created_at DESC);

-- Compound index for requests by org_id and success status
-- Useful for error rate queries and debugging
CREATE INDEX IF NOT EXISTS idx_requests_org_success
ON requests(org_id, success, created_at DESC);

-- Index on routing_logs created_at for cleanup/archival queries
CREATE INDEX IF NOT EXISTS idx_routing_logs_created_at
ON routing_logs(created_at DESC);

-- Compound index on routing_logs for request debugging
CREATE INDEX IF NOT EXISTS idx_routing_logs_request_created
ON routing_logs(request_id, created_at DESC);

-- Performance notes:
-- - Compound indexes are most effective when query filters use the leftmost columns
-- - DESC on created_at optimizes for "recent first" queries (most common pattern)
-- - These indexes will slightly slow down INSERT operations but dramatically speed up SELECT
-- - Monitor index usage with: SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';

-- Drop old single-column indexes that are now redundant:
-- Keep idx_requests_org_id as it's useful for org-only queries
-- Keep idx_requests_created_at for time-range-only queries

-- Analyze tables to update query planner statistics
ANALYZE requests;
ANALYZE routing_logs;
