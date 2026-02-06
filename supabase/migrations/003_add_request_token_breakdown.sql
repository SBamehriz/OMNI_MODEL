-- Add input/output token breakdown for usage + logging
-- This keeps backward compatibility with existing rows that only have `tokens`.

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS tokens_input INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_output INT NOT NULL DEFAULT 0;

-- Best-effort backfill for existing rows that only had `tokens` total.
-- We don't know the true split, so we use an even 50/50 approximation.
UPDATE requests
SET
  tokens_input = COALESCE(tokens_input, 0) + (COALESCE(tokens, 0) / 2),
  tokens_output = COALESCE(tokens_output, 0) + (COALESCE(tokens, 0) - (COALESCE(tokens, 0) / 2))
WHERE (tokens_input = 0 AND tokens_output = 0) AND COALESCE(tokens, 0) > 0;

