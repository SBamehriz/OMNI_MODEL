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

function estimateCostForSort(model: ModelRow, tokens?: TokenEstimate): number {
  if (tokens) return estimateCostForModel(model, tokens);
  return Number(model.cost_input) + Number(model.cost_output);
}

function taskMatchScore(strengths: string[], taskType: TaskType): number {
  if (strengths.includes(taskType)) return 1;
  if (strengths.includes('chat')) return 0.5;
  return 0;
}

function normalizeInverse(value: number, min: number, max: number): number {
  if (max <= min) return 1;
  const ratio = (value - min) / (max - min);
  return 1 - Math.min(Math.max(ratio, 0), 1);
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
    .select('id, provider, model_name, cost_input, cost_output, avg_latency, strengths');

  if (error || !rows?.length) return [];

  const providerFiltered = options?.availableProviders?.length
    ? rows.filter((r) => options.availableProviders?.includes(r.provider))
    : rows;

  if (!providerFiltered.length) return [];

  const tokenEstimate = options?.tokenEstimate;
  let scored = providerFiltered.map((r) => {
    const strengths = (r.strengths as string[]) ?? [];
    const match = taskMatchScore(strengths, taskType);
    const estimatedCost = estimateCostForSort(r as ModelRow, tokenEstimate);
    return {
      ...r,
      strengths,
      match,
      estimatedCost,
      avg_latency: r.avg_latency ?? 0,
    };
  });

  const maxCost = options?.maxCost;
  if (maxCost !== undefined && tokenEstimate) {
    scored = scored.filter((r) => estimateCostForModel(r as ModelRow, tokenEstimate) <= maxCost);
  }
  if (!scored.length) return [];

  const costValues = scored.map((r) => r.estimatedCost);
  const latencyValues = scored.map((r) => r.avg_latency ?? 0);
  const costMin = Math.min(...costValues);
  const costMax = Math.max(...costValues);
  const latMin = Math.min(...latencyValues);
  const latMax = Math.max(...latencyValues);

  const balancedWeights =
    latencyPref === 'fast'
      ? { cost: 0.3, latency: 0.4, task: 0.3 }
      : { cost: 0.4, latency: 0.3, task: 0.3 };

  scored = scored.map((r) => {
    const costNorm = normalizeInverse(r.estimatedCost, costMin, costMax);
    const latencyNorm = normalizeInverse(r.avg_latency ?? 0, latMin, latMax);
    const score =
      balancedWeights.cost * costNorm +
      balancedWeights.latency * latencyNorm +
      balancedWeights.task * r.match;
    return { ...r, costNorm, latencyNorm, score };
  });

  let ordered: typeof scored = [];
  if (priority === 'cheap') {
    ordered = [...scored].sort((a, b) => {
      if (a.estimatedCost !== b.estimatedCost) return a.estimatedCost - b.estimatedCost;
      if (latencyPref === 'fast' && a.avg_latency !== b.avg_latency) return a.avg_latency - b.avg_latency;
      if (a.match !== b.match) return b.match - a.match;
      return a.avg_latency - b.avg_latency;
    });
  } else if (priority === 'best') {
    ordered = [...scored].sort((a, b) => {
      if (a.match !== b.match) return b.match - a.match;
      if (latencyPref === 'fast' && a.avg_latency !== b.avg_latency) return a.avg_latency - b.avg_latency;
      if (a.estimatedCost !== b.estimatedCost) return b.estimatedCost - a.estimatedCost;
      return a.avg_latency - b.avg_latency;
    });
  } else {
    ordered = [...scored].sort((a, b) => b.score - a.score);
  }

  return ordered.map((r) => ({
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
  taskType: TaskType,
  priority: 'cheap' | 'balanced' | 'best' = 'balanced',
  latencyPref: 'fast' | 'normal' = 'normal'
): RoutingDecision {
  const primary = models[0];
  if (!primary)
    return {
      provider: 'openai',
      model_name: 'gpt-4o-mini',
      reason: `task=${taskType}, priority=${priority}, latency=${latencyPref}, no registry; default`,
    };
  return {
    provider: primary.provider,
    model_name: primary.model_name,
    reason: `task=${taskType}, priority=${priority}, latency=${latencyPref}, primary=${primary.provider}/${primary.model_name}`,
  };
}
