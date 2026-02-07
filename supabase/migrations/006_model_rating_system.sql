-- Migration 006: Add model rating and quality tracking system
-- Purpose: Support integration with OpenRouter and ArtificialAnalysis for:
--   - Real-time pricing updates
--   - Quality ratings and benchmarks
--   - Model deprecation tracking
--   - Automated data synchronization

-- Add quality rating column (from ArtificialAnalysis)
-- Scale: 0-100, with 2 decimal precision
ALTER TABLE models ADD COLUMN quality_rating DECIMAL(5,2);

-- Add speed index column (from ArtificialAnalysis)
-- Relative speed metric, 0-100 scale
ALTER TABLE models ADD COLUMN speed_index DECIMAL(5,2);

-- Add price index column (from ArtificialAnalysis)
-- Relative cost metric, 0-100 scale
ALTER TABLE models ADD COLUMN price_index DECIMAL(5,2);

-- Add benchmark scores (JSONB for flexibility)
-- Example: {"mmlu": 85.5, "humaneval": 72.3, "gsm8k": 90.1}
ALTER TABLE models ADD COLUMN benchmark_scores JSONB DEFAULT '{}';

-- Add sync metadata
-- Track when model data was last updated from external sources
ALTER TABLE models ADD COLUMN last_synced_at TIMESTAMPTZ;

-- Add data source tracking
-- Values: 'manual', 'openrouter', 'artificialanalysis'
ALTER TABLE models ADD COLUMN data_source TEXT DEFAULT 'manual';

-- Add deprecation tracking
-- Mark models that are no longer available or recommended
ALTER TABLE models ADD COLUMN deprecated BOOLEAN DEFAULT false;
ALTER TABLE models ADD COLUMN deprecated_at TIMESTAMPTZ;
ALTER TABLE models ADD COLUMN replacement_model_id UUID REFERENCES models(id);
ALTER TABLE models ADD COLUMN deprecation_reason TEXT;

-- Add index for common queries
CREATE INDEX idx_models_deprecated ON models(deprecated);
CREATE INDEX idx_models_data_source ON models(data_source);
CREATE INDEX idx_models_last_synced ON models(last_synced_at DESC);

-- Add GIN index for benchmark_scores JSONB queries
CREATE INDEX idx_models_benchmark_scores ON models USING GIN (benchmark_scores);

-- Add comment to table
COMMENT ON COLUMN models.quality_rating IS 'Quality rating from ArtificialAnalysis (0-100 scale)';
COMMENT ON COLUMN models.speed_index IS 'Speed index from ArtificialAnalysis (0-100 scale, higher is faster)';
COMMENT ON COLUMN models.price_index IS 'Price index from ArtificialAnalysis (0-100 scale, higher is more expensive)';
COMMENT ON COLUMN models.benchmark_scores IS 'Benchmark scores (JSONB): {"mmlu": 85.5, "humaneval": 72.3}';
COMMENT ON COLUMN models.last_synced_at IS 'Timestamp of last data sync from external source';
COMMENT ON COLUMN models.data_source IS 'Source of model data: manual, openrouter, artificialanalysis';
COMMENT ON COLUMN models.deprecated IS 'Whether this model is deprecated and should not be used';
COMMENT ON COLUMN models.replacement_model_id IS 'FK to replacement model if this one is deprecated';

-- Create audit table for model changes (optional, for tracking pricing changes over time)
CREATE TABLE IF NOT EXISTS model_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  changed_by TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  source TEXT -- 'manual', 'openrouter_sync', 'artificialanalysis_sync'
);

-- Add index for querying model change history
CREATE INDEX idx_model_changes_model_id ON model_changes(model_id, changed_at DESC);
CREATE INDEX idx_model_changes_field ON model_changes(field_name);

COMMENT ON TABLE model_changes IS 'Audit trail for model metadata changes (pricing, ratings, etc.)';

-- Mark existing models as manually entered
UPDATE models SET data_source = 'manual', last_synced_at = now() WHERE data_source IS NULL;

-- Run ANALYZE to update statistics for query planner
ANALYZE models;
ANALYZE model_changes;
