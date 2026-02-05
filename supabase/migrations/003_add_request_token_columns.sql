-- Omni-Model Router — add input/output token columns for accuracy

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS tokens_input INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_output INT DEFAULT 0;

UPDATE requests
  SET tokens_input = 0
  WHERE tokens_input IS NULL;

UPDATE requests
  SET tokens_output = 0
  WHERE tokens_output IS NULL;

CREATE INDEX IF NOT EXISTS idx_requests_tokens_input ON requests(tokens_input);
CREATE INDEX IF NOT EXISTS idx_requests_tokens_output ON requests(tokens_output);
