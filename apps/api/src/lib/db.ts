import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const envCandidates = [
  path.resolve(process.cwd(), 'apps/api/.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(here, '../.env'),
];
const envPath = envCandidates.find((p) => fs.existsSync(p));
dotenv.config(envPath ? { path: envPath } : undefined);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
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
