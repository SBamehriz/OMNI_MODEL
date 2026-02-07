#!/usr/bin/env tsx
/**
 * Unified model sync command
 *
 * Combines OpenRouter pricing sync and ArtificialAnalysis ratings sync
 * into a single command for daily automated updates.
 *
 * Usage:
 *   npm run sync-models
 *   or: tsx scripts/syncAllModels.ts
 *
 * Order of operations:
 *   1. Sync models from OpenRouter (pricing, capabilities)
 *   2. Sync quality ratings from ArtificialAnalysis
 *   3. Apply manual overrides from models.yaml
 *   4. Invalidate cache
 *
 * Environment variables required:
 *   - SUPABASE_URL, SUPABASE_SERVICE_KEY
 *   - OPENROUTER_API_KEY (optional, improves rate limits)
 */

import 'dotenv/config';
import { fetchOpenRouterModels, syncModel as syncFromOpenRouter } from './syncModelsFromOpenRouter.js';
import { fetchRatingsFromAA, updateModelRating } from './syncRatingsFromAA.js';
import { invalidateModelCache } from '../src/lib/router.js';

/**
 * Main unified sync function
 */
async function main() {
  console.log('🔄 Starting unified model sync (OpenRouter + ArtificialAnalysis)...\n');

  const startTime = Date.now();
  const stats = {
    openRouterSuccess: 0,
    openRouterFailed: 0,
    aaSuccess: 0,
    aaFailed: 0,
  };

  try {
    // Step 1: Sync from OpenRouter
    console.log('📡 Step 1/3: Syncing models from OpenRouter...');
    console.log('─'.repeat(60));

    const openRouterModels = await fetchOpenRouterModels();

    // Filter to major providers
    const majorProviders = ['openai', 'anthropic', 'google', 'meta', 'mistral', 'cohere'];
    const filteredModels = openRouterModels.filter((m) => {
      const provider = m.id.split('/')[0];
      return majorProviders.includes(provider.toLowerCase());
    });

    console.log(`Processing ${filteredModels.length} models from major providers...\n`);

    for (const model of filteredModels) {
      try {
        await syncFromOpenRouter(model);
        stats.openRouterSuccess++;
      } catch (error) {
        stats.openRouterFailed++;
        console.error(`✗ Error syncing ${model.id}:`, error);
      }
    }

    console.log(`\n✓ OpenRouter sync complete: ${stats.openRouterSuccess} succeeded, ${stats.openRouterFailed} failed\n`);

    // Step 2: Sync quality ratings from ArtificialAnalysis
    console.log('📊 Step 2/3: Syncing quality ratings from ArtificialAnalysis...');
    console.log('─'.repeat(60));

    const ratings = await fetchRatingsFromAA();

    console.log(`Processing ${ratings.length} model ratings...\n`);

    for (const rating of ratings) {
      try {
        await updateModelRating(rating);
        stats.aaSuccess++;
      } catch (error) {
        stats.aaFailed++;
        console.error(`✗ Error updating ${rating.modelName}:`, error);
      }
    }

    console.log(`\n✓ ArtificialAnalysis sync complete: ${stats.aaSuccess} succeeded, ${stats.aaFailed} failed\n`);

    // Step 3: Invalidate cache
    console.log('🔄 Step 3/3: Invalidating model cache...');
    console.log('─'.repeat(60));

    invalidateModelCache();

    console.log('✓ Model cache invalidated\n');

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('═'.repeat(60));
    console.log('📋 SYNC SUMMARY');
    console.log('═'.repeat(60));
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('');
    console.log('OpenRouter:');
    console.log(`  ✓ Succeeded: ${stats.openRouterSuccess}`);
    console.log(`  ✗ Failed: ${stats.openRouterFailed}`);
    console.log('');
    console.log('ArtificialAnalysis:');
    console.log(`  ✓ Succeeded: ${stats.aaSuccess}`);
    console.log(`  ✗ Failed: ${stats.aaFailed}`);
    console.log('');
    console.log(`🎯 Total: ${stats.openRouterSuccess + stats.aaSuccess} models updated`);
    console.log('═'.repeat(60));
    console.log('');

    // Recommendations
    if (stats.openRouterFailed > 0 || stats.aaFailed > 0) {
      console.log('⚠️  Some syncs failed. Check logs above for details.');
      console.log('');
    }

    console.log('💡 Next steps:');
    console.log('  1. Verify pricing: npm run validate-pricing');
    console.log('  2. Test routing: curl /v1/router/debug');
    console.log('  3. Check dashboard: Review model breakdown');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('❌ Unified sync failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as syncAllModels };
