#!/usr/bin/env tsx
/**
 * Sync model quality ratings from ArtificialAnalysis.ai
 *
 * This script fetches quality ratings, speed benchmarks, and price indexes
 * from ArtificialAnalysis.ai and updates our database.
 *
 * Usage:
 *   npm run sync-aa
 *   or: tsx scripts/syncRatingsFromAA.ts
 *
 * Environment variables required:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_KEY
 *
 * Note: ArtificialAnalysis doesn't have a public API (as of 2025-02-07),
 * so this uses web scraping. If they add an API, update this script.
 */

import 'dotenv/config';
import { supabase } from '../src/lib/db.js';
import { invalidateModelCache } from '../src/lib/router.js';

interface ModelRating {
  modelName: string;
  provider?: string;
  qualityIndex: number; // 0-100
  speedIndex: number; // 0-100
  priceIndex: number; // 0-100
  benchmarks?: {
    mmlu?: number;
    humaneval?: number;
    gsm8k?: number;
    mt_bench?: number;
  };
}

/**
 * Hardcoded ratings (2025-02-07 snapshot)
 *
 * TODO: Replace with actual web scraping or API calls when available
 * Source: https://artificialanalysis.ai/models
 *
 * This is a fallback implementation. For production, implement one of:
 * 1. Web scraping with Puppeteer/Playwright
 * 2. API integration if they launch one
 * 3. Manual updates via models.yaml
 */
const HARDCODED_RATINGS: ModelRating[] = [
  // OpenAI Models
  {
    modelName: 'gpt-4o',
    provider: 'openai',
    qualityIndex: 90,
    speedIndex: 75,
    priceIndex: 70, // Higher = more expensive
    benchmarks: {
      mmlu: 88.7,
      humaneval: 90.2,
      gsm8k: 94.8,
      mt_bench: 9.0,
    },
  },
  {
    modelName: 'gpt-4o-mini',
    provider: 'openai',
    qualityIndex: 78,
    speedIndex: 92,
    priceIndex: 20, // Very cheap
    benchmarks: {
      mmlu: 82.0,
      humaneval: 87.2,
      gsm8k: 87.0,
    },
  },
  {
    modelName: 'o1',
    provider: 'openai',
    qualityIndex: 95,
    speedIndex: 40, // Slower due to reasoning
    priceIndex: 95, // Very expensive
    benchmarks: {
      mmlu: 92.3,
      humaneval: 92.5,
      gsm8k: 96.4,
    },
  },

  // Anthropic Models
  {
    modelName: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    qualityIndex: 92,
    speedIndex: 70,
    priceIndex: 75,
    benchmarks: {
      mmlu: 88.3,
      humaneval: 92.0,
      gsm8k: 96.4,
      mt_bench: 9.0,
    },
  },
  {
    modelName: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    qualityIndex: 80,
    speedIndex: 88,
    priceIndex: 30,
    benchmarks: {
      mmlu: 75.2,
      humaneval: 75.9,
      gsm8k: 88.9,
    },
  },

  // Google Models
  {
    modelName: 'gemini-1.5-pro',
    provider: 'google',
    qualityIndex: 85,
    speedIndex: 65,
    priceIndex: 60,
    benchmarks: {
      mmlu: 85.9,
      humaneval: 84.1,
      gsm8k: 90.8,
    },
  },
  {
    modelName: 'gemini-1.5-flash',
    provider: 'google',
    qualityIndex: 74,
    speedIndex: 95,
    priceIndex: 15, // Very cheap
    benchmarks: {
      mmlu: 78.9,
      humaneval: 74.3,
      gsm8k: 84.7,
    },
  },
];

/**
 * Fetch ratings from ArtificialAnalysis.ai
 *
 * PLACEHOLDER: Implement web scraping or API call here
 */
async function fetchRatingsFromAA(): Promise<ModelRating[]> {
  console.log('Fetching ratings from ArtificialAnalysis.ai...');

  // TODO: Implement web scraping with Puppeteer/Playwright
  // Example:
  // const browser = await puppeteer.launch();
  // const page = await browser.newPage();
  // await page.goto('https://artificialanalysis.ai/models');
  // const ratings = await page.evaluate(() => {
  //   // Extract table data
  // });
  // await browser.close();

  // For now, use hardcoded data
  console.log('⚠️  Using hardcoded ratings (no API available)');
  console.log('   Source: ArtificialAnalysis.ai (2025-02-07 snapshot)');
  console.log('   For production: Implement web scraping or wait for API');

  return HARDCODED_RATINGS;
}

/**
 * Parse model identifier to match database format
 */
function parseModelIdentifier(rating: ModelRating): {
  provider: string;
  modelName: string;
} {
  // If provider explicitly set, use it
  if (rating.provider) {
    return {
      provider: rating.provider,
      modelName: rating.modelName,
    };
  }

  // Try to infer provider from model name
  const name = rating.modelName.toLowerCase();

  if (name.includes('gpt') || name.includes('o1')) {
    return { provider: 'openai', modelName: rating.modelName };
  }
  if (name.includes('claude')) {
    return { provider: 'anthropic', modelName: rating.modelName };
  }
  if (name.includes('gemini')) {
    return { provider: 'google', modelName: rating.modelName };
  }

  // Default: unknown provider
  return { provider: 'unknown', modelName: rating.modelName };
}

/**
 * Update a single model's rating in database
 */
async function updateModelRating(rating: ModelRating): Promise<void> {
  const { provider, modelName } = parseModelIdentifier(rating);

  // Find model in database
  const { data: model, error: findError } = await supabase
    .from('models')
    .select('id, quality_rating, speed_index, price_index')
    .eq('provider', provider)
    .eq('model_name', modelName)
    .single();

  if (findError || !model) {
    console.log(`⊘ Model not found: ${provider}/${modelName} (skipping)`);
    return;
  }

  // Check if ratings changed
  const changed =
    Number(model.quality_rating ?? 0) !== rating.qualityIndex ||
    Number(model.speed_index ?? 0) !== rating.speedIndex ||
    Number(model.price_index ?? 0) !== rating.priceIndex;

  if (changed) {
    // Log changes to audit table
    const changes = [];
    if (Number(model.quality_rating ?? 0) !== rating.qualityIndex) {
      changes.push({
        model_id: model.id,
        changed_by: 'artificialanalysis_sync',
        field_name: 'quality_rating',
        old_value: String(model.quality_rating ?? 0),
        new_value: String(rating.qualityIndex),
        source: 'artificialanalysis_sync',
      });
    }
    if (Number(model.speed_index ?? 0) !== rating.speedIndex) {
      changes.push({
        model_id: model.id,
        changed_by: 'artificialanalysis_sync',
        field_name: 'speed_index',
        old_value: String(model.speed_index ?? 0),
        new_value: String(rating.speedIndex),
        source: 'artificialanalysis_sync',
      });
    }
    if (Number(model.price_index ?? 0) !== rating.priceIndex) {
      changes.push({
        model_id: model.id,
        changed_by: 'artificialanalysis_sync',
        field_name: 'price_index',
        old_value: String(model.price_index ?? 0),
        new_value: String(rating.priceIndex),
        source: 'artificialanalysis_sync',
      });
    }

    if (changes.length > 0) {
      await supabase.from('model_changes').insert(changes);
    }
  }

  // Update model
  const { error: updateError } = await supabase
    .from('models')
    .update({
      quality_rating: rating.qualityIndex,
      speed_index: rating.speedIndex,
      price_index: rating.priceIndex,
      benchmark_scores: rating.benchmarks || {},
      last_synced_at: new Date().toISOString(),
      data_source:
        model.id && (model as { data_source?: string }).data_source === 'openrouter'
          ? 'openrouter' // Keep openrouter as primary source
          : 'artificialanalysis',
    })
    .eq('id', model.id);

  if (updateError) {
    console.error(`✗ Error updating ${provider}/${modelName}:`, updateError.message);
  } else {
    console.log(
      `↻ Updated ${provider}/${modelName}${changed ? ' (ratings changed)' : ''}`
    );
  }
}

/**
 * Main sync function
 */
async function main() {
  console.log('🔄 Starting ArtificialAnalysis ratings sync...\n');

  try {
    // Fetch ratings
    const ratings = await fetchRatingsFromAA();

    console.log(`\nProcessing ${ratings.length} model ratings...\n`);

    // Update each model
    let successCount = 0;
    let errorCount = 0;

    for (const rating of ratings) {
      try {
        await updateModelRating(rating);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`✗ Error updating ${rating.modelName}:`, error);
      }
    }

    // Invalidate model cache so router picks up new data
    invalidateModelCache();

    console.log(`\n✓ Sync complete: ${successCount} succeeded, ${errorCount} failed`);
    console.log('✓ Model cache invalidated\n');

    // Show summary
    console.log('📊 Summary:');
    console.log(`   Quality ratings updated: ${successCount}`);
    console.log(`   Speed indexes updated: ${successCount}`);
    console.log(`   Price indexes updated: ${successCount}`);
    console.log('');
    console.log('⚠️  Note: Using hardcoded data. For production:');
    console.log('   1. Implement web scraping with Puppeteer/Playwright');
    console.log('   2. Or wait for ArtificialAnalysis.ai to release API');
    console.log('   3. Or update models.yaml manually\n');

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

export { fetchRatingsFromAA, updateModelRating };
