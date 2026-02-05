-- Omni-Model Router — initial schema
-- Run in Supabase SQL editor or via supabase db push

-- Orgs (tenants)
CREATE TABLE IF NOT EXISTS orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  billing_plan TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users (API key is hashed in production; store hash, verify with constant-time compare)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email TEXT,
  api_key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(api_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);

-- API keys table: raw key prefix for lookup, full hash for verify (optional; if not using users.api_key_hash)
-- For MVP we use a single api_key column on users with plain lookup; replace with hash + api_keys table for production
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key_prefix TEXT;
CREATE INDEX IF NOT EXISTS idx_users_api_key_prefix ON users(api_key_prefix);

-- Model registry (drives routing)
CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  cost_input DECIMAL(12, 8) NOT NULL DEFAULT 0,
  cost_output DECIMAL(12, 8) NOT NULL DEFAULT 0,
  avg_latency INT NOT NULL DEFAULT 0,
  strengths JSONB NOT NULL DEFAULT '[]',
  supports_functions BOOLEAN NOT NULL DEFAULT false,
  supports_vision BOOLEAN NOT NULL DEFAULT false,
  max_tokens INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, model_name)
);

CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider);
CREATE INDEX IF NOT EXISTS idx_models_strengths ON models USING GIN(strengths);

-- Request log (per request metrics)
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  task_type TEXT,
  model_used TEXT NOT NULL,
  tokens INT,
  cost DECIMAL(12, 8) NOT NULL DEFAULT 0,
  latency_ms INT,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requests_org_id ON requests(org_id);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_requests_org_created ON requests(org_id, created_at);

-- Routing decision log (for debug and tuning)
CREATE TABLE IF NOT EXISTS routing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  considered_models JSONB NOT NULL DEFAULT '[]',
  final_model TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routing_logs_request_id ON routing_logs(request_id);

-- RLS (optional for Supabase): enable if using Supabase Auth
-- ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE routing_logs ENABLE ROW LEVEL SECURITY;
