import { supabase } from './db.js';
import type { TaskType } from './taskClassifier.js';
import type { TokenEstimate } from './tokens.js';

export type ModelRow = {
  id: string;
  provider: string;
  model_name: string;
  cost_input: number;
  cost_output: number;
  avg_latency: number;
  strengths: string[];
};

export type RoutingDecision = {
  provider: string;
  model_name: string;
  reason: string;
};

function estimateCostForModel(model: ModelRow, tokens: TokenEstimate): number {
  const inCost = Number(model.cost_input);
  const outCost = Number(model.cost_output);
  return (tokens.inputTokens / 1000) * inCost + (tokens.outputTokens / 1000) * outCost;
}

/**
 * Rule-based router: pick model by task + priority + latency_pref.
 * Returns ordered list [primary, backup, ...] for fallback.
 */
export async function selectModels(
  taskType: TaskType,
  priority: 'cheap' | 'balanced' | 'best',
  latencyPref: 'fast' | 'normal',
  options?: { maxCost?: number; tokenEstimate?: TokenEstimate; availableProviders?: string[] }
): Promise<ModelRow[]> {
  const { data: rows, error } = await supabase
    .from('models')
    .select('id, provider, model_name, cost_input, cost_output, avg_latency, strengths')
    .order('cost_input', { ascending: priority === 'cheap' });

  if (error || !rows?.length) return [];

  const providerFiltered = options?.availableProviders?.length
    ? rows.filter((r) => options.availableProviders?.includes(r.provider))
    : rows;

  const withStrength = (r: (typeof rows)[0]) => {
    const strengths = (r.strengths as string[]) ?? [];
    const match = strengths.includes(taskType) ? 1 : strengths.includes('chat') ? 0.5 : 0;
    const costNorm = 1 - Math.min(Number(r.cost_input) * 1000, 1);
    const latNorm = latencyPref === 'fast' ? 1 - Math.min((r.avg_latency ?? 0) / 2000, 1) : 1;
    const score = 0.4 * costNorm + 0.3 * latNorm + 0.3 * match;
    return { ...r, score, strengths };
  };

  let scored = providerFiltered.map(withStrength).sort((a, b) => b.score - a.score);
  const maxCost = options?.maxCost;
  const tokenEstimate = options?.tokenEstimate;
  if (maxCost !== undefined && tokenEstimate) {
    scored = scored.filter((r) => estimateCostForModel(r as ModelRow, tokenEstimate) <= maxCost);
  }
  const primary = scored[0];
  const fallbacks = scored.slice(1);

  return [primary, ...fallbacks].map((r) => ({
    id: r.id,
    provider: r.provider,
    model_name: r.model_name,
    cost_input: Number(r.cost_input),
    cost_output: Number(r.cost_output),
    avg_latency: r.avg_latency ?? 0,
    strengths: (r.strengths as string[]) ?? [],
  }));
}

export function getRoutingDecision(
  models: ModelRow[],
  taskType: TaskType
): RoutingDecision {
  const primary = models[0];
  if (!primary)
    return { provider: 'openai', model_name: 'gpt-4o-mini', reason: 'no registry; default' };
  return {
    provider: primary.provider,
    model_name: primary.model_name,
    reason: `task=${taskType}, primary=${primary.provider}/${primary.model_name}`,
  };
}
