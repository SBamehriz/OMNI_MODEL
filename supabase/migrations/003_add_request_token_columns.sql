-- Omni-Model Router — add input/output token breakdown columns
-- Keeps backward compatibility with existing rows that only have `tokens`.

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS tokens_input INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_output INT NOT NULL DEFAULT 0;

-- Backfill NULLs to 0
UPDATE requests SET tokens_input = 0 WHERE tokens_input IS NULL;
UPDATE requests SET tokens_output = 0 WHERE tokens_output IS NULL;

-- Best-effort backfill for rows that only had the aggregate `tokens` column.
-- Uses 50/50 split as approximation when breakdown is unknown.
UPDATE requests
SET
  tokens_input  = COALESCE(tokens, 0) / 2,
  tokens_output = COALESCE(tokens, 0) - (COALESCE(tokens, 0) / 2)
WHERE tokens_input = 0 AND tokens_output = 0 AND COALESCE(tokens, 0) > 0;

CREATE INDEX IF NOT EXISTS idx_requests_tokens_input ON requests(tokens_input);
CREATE INDEX IF NOT EXISTS idx_requests_tokens_output ON requests(tokens_output);
