-- Seed: one org, one user (dev API key), and initial model registry
-- For production: hash the API key and store in api_key_hash; use a secure random key.

INSERT INTO orgs (id, name, billing_plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Org', 'free')
ON CONFLICT DO NOTHING;

-- Dev API key: omni-dev-key-change-in-production (store hash in production)
INSERT INTO users (id, org_id, email, api_key_hash)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'dev@localhost',
  'omni-dev-key-change-in-production'
)
ON CONFLICT (api_key_hash) DO NOTHING;

-- Model registry: cheap chat, reasoning, coding, fallback (pricing approx 2024)
INSERT INTO models (provider, model_name, cost_input, cost_output, avg_latency, strengths, supports_functions, supports_vision, max_tokens)
VALUES
  ('openai', 'gpt-4o-mini', 0.00015, 0.0006, 400, '["chat","summarization"]', false, true, 128000),
  ('openai', 'gpt-4o', 0.0025, 0.01, 800, '["reasoning","coding","chat"]', true, true, 128000),
  ('anthropic', 'claude-3-5-haiku-20241022', 0.0008, 0.004, 350, '["chat","summarization"]', false, true, 200000),
  ('anthropic', 'claude-3-5-sonnet-20241022', 0.003, 0.015, 600, '["reasoning","coding","chat"]', true, true, 200000)
ON CONFLICT (provider, model_name) DO NOTHING;
