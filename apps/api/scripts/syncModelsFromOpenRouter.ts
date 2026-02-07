#!/usr/bin/env tsx
/**
 * Sync models and pricing from OpenRouter API
 *
 * This script fetches the latest model catalog from OpenRouter.ai and updates
 * our database with current pricing, context limits, and capabilities.
 *
 * Usage:
 *   npm run sync-openrouter
 *   or: tsx scripts/syncModelsFromOpenRouter.ts
 *
 * Environment variables required:
 *   - OPENROUTER_API_KEY (optional, but recommended for higher rate limits)
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_KEY
 */

import 'dotenv/config';
import { supabase } from '../src/lib/db.js';
import { invalidateModelCache } from '../src/lib/router.js';

interface OpenRouterModel {
  id: string; // e.g., "openai/gpt-4o"
  name: string; // e.g., "GPT-4o"
  description?: string;
  pricing: {
    prompt: string; // Price per million tokens (string format)
    completion: string; // Price per million tokens
    request?: string; // Per-request pricing (if applicable)
    image?: string; // Image generation pricing
  };
  context_length: number;
  architecture?: {
    modality?: string; // "text", "multimodal", etc.
    tokenizer?: string;
    instruct_type?: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  per_request_limits?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

interface OpenRouterResponse {
  data: OpenRouterModel[];
}

/**
 * Fetch models from OpenRouter API
 */
async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const url = 'https://openrouter.ai/api/v1/models';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add API key if available (improves rate limits)
  if (process.env.OPENROUTER_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  }

  console.log('Fetching models from OpenRouter API...');
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as OpenRouterResponse;
  console.log(`✓ Fetched ${result.data.length} models from OpenRouter`);

  return result.data;
}

/**
 * Parse pricing from OpenRouter format (per-million) to our format (per-thousand)
 */
function parsePricing(pricingStr: string): number {
  const perMillion = parseFloat(pricingStr);
  if (isNaN(perMillion)) return 0;
  // Convert per-million to per-thousand
  return perMillion / 1000;
}

/**
 * Parse model ID to extract provider and model name
 */
function parseModelId(id: string): { provider: string; modelName: string } {
  const parts = id.split('/');
  if (parts.length < 2) {
    // Fallback for non-standard formats
    return { provider: 'unknown', modelName: id };
  }

  const provider = parts[0];
  const modelName = parts.slice(1).join('/'); // Handle IDs like "anthropic/claude-3-5-sonnet"

  return { provider, modelName };
}

/**
 * Determine if model supports vision based on modality
 */
function supportsVision(model: OpenRouterModel): boolean {
  return model.architecture?.modality === 'multimodal' || model.architecture?.modality === 'image->text';
}

/**
 * Determine if model supports function calling
 * (Heuristic based on model name and description)
 */
function supportsFunctions(model: OpenRouterModel): boolean {
  const id = model.id.toLowerCase();
  const name = model.name.toLowerCase();
  const desc = (model.description || '').toLowerCase();

  // Known models with function calling
  const functionCallingModels = [
    'gpt-4', 'gpt-3.5-turbo', 'claude-3', 'gemini-1.5', 'gemini-pro',
  ];

  return functionCallingModels.some((pattern) => id.includes(pattern) || name.includes(pattern)) ||
    desc.includes('function') || desc.includes('tool');
}

/**
 * Infer model strengths based on name and capabilities
 */
function inferStrengths(model: OpenRouterModel): string[] {
  const id = model.id.toLowerCase();
  const name = model.name.toLowerCase();
  const desc = (model.description || '').toLowerCase();

  const strengths: string[] = [];

  // Coding models
  if (id.includes('code') || name.includes('code') || desc.includes('code')) {
    strengths.push('coding');
  }

  // Reasoning models
  if (id.includes('o1') || id.includes('o3') || name.includes('reasoning') || desc.includes('reasoning')) {
    strengths.push('reasoning');
  }

  // Image generation/analysis
  if (supportsVision(model) || id.includes('vision') || id.includes('image')) {
    strengths.push('image');
  }

  // Default to chat if no specific strengths identified
  if (strengths.length === 0) {
    strengths.push('chat');
  }

  return strengths;
}

/**
 * Sync a single model to database
 */
async function syncModel(model: OpenRouterModel): Promise<void> {
  const { provider, modelName } = parseModelId(model.id);

  const costInput = parsePricing(model.pricing.prompt);
  const costOutput = parsePricing(model.pricing.completion);

  // Skip models with invalid pricing
  if (costInput === 0 && costOutput === 0) {
    console.log(`⊘ Skipping ${model.id} (no pricing data)`);
    return;
  }

  const modelData = {
    provider,
    model_name: modelName,
    cost_input: costInput,
    cost_output: costOutput,
    max_tokens: model.context_length || 4096,
    supports_vision: supportsVision(model),
    supports_functions: supportsFunctions(model),
    strengths: inferStrengths(model),
    data_source: 'openrouter',
    last_synced_at: new Date().toISOString(),
  };

  // Check if model exists
  const { data: existing } = await supabase
    .from('models')
    .select('id, cost_input, cost_output')
    .eq('provider', provider)
    .eq('model_name', modelName)
    .single();

  if (existing) {
    // Update existing model
    const changed =
      Number(existing.cost_input) !== costInput ||
      Number(existing.cost_output) !== costOutput;

    if (changed) {
      // Log change to audit table
      await supabase.from('model_changes').insert([
        {
          model_id: existing.id,
          changed_by: 'openrouter_sync',
          field_name: 'cost_input',
          old_value: String(existing.cost_input),
          new_value: String(costInput),
          source: 'openrouter_sync',
        },
        {
          model_id: existing.id,
          changed_by: 'openrouter_sync',
          field_name: 'cost_output',
          old_value: String(existing.cost_output),
          new_value: String(costOutput),
          source: 'openrouter_sync',
        },
      ]);
    }

    const { error } = await supabase
      .from('models')
      .update(modelData)
      .eq('id', existing.id);

    if (error) {
      console.error(`✗ Error updating ${model.id}:`, error.message);
    } else {
      console.log(`↻ Updated ${model.id}${changed ? ' (pricing changed)' : ''}`);
    }
  } else {
    // Insert new model
    const { error } = await supabase
      .from('models')
      .insert(modelData);

    if (error) {
      console.error(`✗ Error inserting ${model.id}:`, error.message);
    } else {
      console.log(`+ Added ${model.id}`);
    }
  }
}

/**
 * Main sync function
 */
async function main() {
  console.log('🔄 Starting OpenRouter model sync...\n');

  try {
    // Fetch models from OpenRouter
    const models = await fetchOpenRouterModels();

    // Filter to only major providers (reduce noise)
    const majorProviders = ['openai', 'anthropic', 'google', 'meta', 'mistral', 'cohere'];
    const filteredModels = models.filter((m) => {
      const { provider } = parseModelId(m.id);
      return majorProviders.includes(provider.toLowerCase());
    });

    console.log(`\nProcessing ${filteredModels.length} models from major providers...\n`);

    // Sync each model
    let successCount = 0;
    let errorCount = 0;

    for (const model of filteredModels) {
      try {
        await syncModel(model);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`✗ Error syncing ${model.id}:`, error);
      }
    }

    // Invalidate model cache so router picks up new data
    invalidateModelCache();

    console.log(`\n✓ Sync complete: ${successCount} succeeded, ${errorCount} failed`);
    console.log('✓ Model cache invalidated\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { fetchOpenRouterModels, syncModel };
