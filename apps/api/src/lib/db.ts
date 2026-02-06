import { createClient } from '@supabase/supabase-js';

// Note: Environment variables are loaded and validated in index.ts
// This ensures config errors are caught early with clear error messages
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  throw new Error(
    'SUPABASE_URL and SUPABASE_SERVICE_KEY must be set. ' +
    'This should not happen if validateEnv() was called at startup.'
  );
}

export const supabase = createClient(url, key);

export type Org = { id: string; name: string; billing_plan: string };
export type User = { id: string; org_id: string; email: string | null };
export type Model = {
  id: string;
  provider: string;
  model_name: string;
  cost_input: number;
  cost_output: number;
  avg_latency: number;
  strengths: string[];
  supports_functions: boolean;
  supports_vision: boolean;
  max_tokens: number | null;
};
