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
  quality_rating?: number; // 0-100 scale (from ArtificialAnalysis)
  speed_index?: number; // 0-100 scale
  price_index?: number; // 0-100 scale
  deprecated?: boolean;
};

// In-memory cache for model registry
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let modelCache: { data: ModelRow[]; timestamp: number } | null = null;

/**
 * Fetch models from database with caching
 */
async function getModelsFromRegistry(): Promise<ModelRow[]> {
  // Check if cache is valid
  if (modelCache && Date.now() - modelCache.timestamp < CACHE_TTL_MS) {
    return modelCache.data;
  }

  // Fetch from database
  const { data: rows, error } = await supabase
    .from('models')
    .select('id, provider, model_name, cost_input, cost_output, avg_latency, strengths, quality_rating, speed_index, price_index, deprecated');

  if (error || !rows?.length) {
    // If fetch fails but we have stale cache, use it
    if (modelCache) {
      return modelCache.data;
    }
    return [];
  }

  // Map to ModelRow and update cache
  const models: ModelRow[] = rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    model_name: r.model_name,
    cost_input: Number(r.cost_input),
    cost_output: Number(r.cost_output),
    avg_latency: r.avg_latency ?? 0,
    strengths: (r.strengths as string[]) ?? [],
    quality_rating: r.quality_rating ? Number(r.quality_rating) : undefined,
    speed_index: r.speed_index ? Number(r.speed_index) : undefined,
    price_index: r.price_index ? Number(r.price_index) : undefined,
    deprecated: r.deprecated ?? false,
  }));

  modelCache = { data: models, timestamp: Date.now() };
  return models;
}

/**
 * Invalidate the model cache (call after model updates)
 */
export function invalidateModelCache(): void {
  modelCache = null;
}

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
  priority: 'cheap' | 'balanced' | 'best' | 'quality',
  latencyPref: 'fast' | 'normal',
  options?: { maxCost?: number; tokenEstimate?: TokenEstimate; availableProviders?: string[] }
): Promise<ModelRow[]> {
  // Fetch models from cache or database
  const rows = await getModelsFromRegistry();

  if (!rows.length) return [];

  // Filter out deprecated models
  const activeModels = rows.filter((r) => !r.deprecated);

  const providerFiltered = options?.availableProviders?.length
    ? activeModels.filter((r) => options.availableProviders?.includes(r.provider))
    : activeModels;

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

  // Determine weights based on priority mode
  let weights: { cost: number; latency: number; task: number; quality: number };

  if (priority === 'quality') {
    // Quality mode: Heavily favor quality ratings
    weights = { cost: 0.1, latency: 0.2, task: 0.3, quality: 0.4 };
  } else {
    // Balanced mode (with latency preference adjustment)
    const balancedWeights =
      latencyPref === 'fast'
        ? { cost: 0.3, latency: 0.35, task: 0.25, quality: 0.1 }
        : { cost: 0.35, latency: 0.25, task: 0.3, quality: 0.1 };
    weights = balancedWeights;
  }

  scored = scored.map((r) => {
    const costNorm = normalizeInverse(r.estimatedCost, costMin, costMax);
    const latencyNorm = normalizeInverse(r.avg_latency ?? 0, latMin, latMax);
    const qualityNorm = ((r as { quality_rating?: number }).quality_rating ?? 50) / 100; // 0-1 scale

    const score =
      weights.cost * costNorm +
      weights.latency * latencyNorm +
      weights.task * r.match +
      weights.quality * qualityNorm;
    return { ...r, costNorm, latencyNorm, qualityNorm, score };
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
