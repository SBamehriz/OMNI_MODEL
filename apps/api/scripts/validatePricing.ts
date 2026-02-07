#!/usr/bin/env tsx
/**
 * Pricing validation script
 *
 * Validates model pricing against external sources and alerts if prices
 * have changed significantly (>10% threshold).
 *
 * Usage:
 *   npm run validate-pricing
 *   or: tsx scripts/validatePricing.ts
 *
 * Use cases:
 *   - Daily cron job to detect pricing changes
 *   - Pre-deployment verification
 *   - Manual pricing audits
 */

import 'dotenv/config';
import { supabase } from '../src/lib/db.js';
import { fetchOpenRouterModels } from './syncModelsFromOpenRouter.js';

const ALERT_THRESHOLD_PERCENT = 10; // Alert if price changes >10%

interface PricingDiff {
  provider: string;
  modelName: string;
  field: 'cost_input' | 'cost_output';
  currentValue: number;
  expectedValue: number;
  percentChange: number;
  severity: 'ok' | 'warning' | 'critical';
}

/**
 * Calculate percent change
 */
function percentChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) return newValue === 0 ? 0 : 100;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Determine severity based on percent change
 */
function getSeverity(percentChange: number): 'ok' | 'warning' | 'critical' {
  const absChange = Math.abs(percentChange);
  if (absChange < 5) return 'ok';
  if (absChange < ALERT_THRESHOLD_PERCENT) return 'warning';
  return 'critical';
}

/**
 * Validate pricing against OpenRouter
 */
async function validateAgainstOpenRouter(): Promise<PricingDiff[]> {
  console.log('Fetching current pricing from OpenRouter...');

  const openRouterModels = await fetchOpenRouterModels();
  const diffs: PricingDiff[] = [];

  // Fetch our database models
  const { data: dbModels, error } = await supabase
    .from('models')
    .select('provider, model_name, cost_input, cost_output');

  if (error || !dbModels) {
    throw new Error('Failed to fetch models from database');
  }

  console.log(`Comparing ${dbModels.length} database models with OpenRouter data...\n`);

  for (const dbModel of dbModels) {
    // Find corresponding OpenRouter model
    const orModel = openRouterModels.find((m) => {
      const [provider, ...modelParts] = m.id.split('/');
      const modelName = modelParts.join('/');
      return (
        provider.toLowerCase() === dbModel.provider.toLowerCase() &&
        modelName === dbModel.model_name
      );
    });

    if (!orModel) {
      // Model not found in OpenRouter (might be deprecated or from another source)
      continue;
    }

    // Parse OpenRouter pricing (per-million to per-thousand)
    const orInputPrice = parseFloat(orModel.pricing.prompt) / 1000;
    const orOutputPrice = parseFloat(orModel.pricing.completion) / 1000;

    // Compare input pricing
    const inputChange = percentChange(Number(dbModel.cost_input), orInputPrice);
    if (Math.abs(inputChange) > 0.01) {
      // More than 0.01% difference
      diffs.push({
        provider: dbModel.provider,
        modelName: dbModel.model_name,
        field: 'cost_input',
        currentValue: Number(dbModel.cost_input),
        expectedValue: orInputPrice,
        percentChange: inputChange,
        severity: getSeverity(inputChange),
      });
    }

    // Compare output pricing
    const outputChange = percentChange(Number(dbModel.cost_output), orOutputPrice);
    if (Math.abs(outputChange) > 0.01) {
      diffs.push({
        provider: dbModel.provider,
        modelName: dbModel.model_name,
        field: 'cost_output',
        currentValue: Number(dbModel.cost_output),
        expectedValue: orOutputPrice,
        percentChange: outputChange,
        severity: getSeverity(outputChange),
      });
    }
  }

  return diffs;
}

/**
 * Format pricing for display
 */
function formatPrice(price: number): string {
  return `$${price.toFixed(8)}/1K tokens`;
}

/**
 * Print validation report
 */
function printReport(diffs: PricingDiff[]): void {
  if (diffs.length === 0) {
    console.log('✓ All model pricing is up to date!\n');
    return;
  }

  // Group by severity
  const critical = diffs.filter((d) => d.severity === 'critical');
  const warnings = diffs.filter((d) => d.severity === 'warning');
  const ok = diffs.filter((d) => d.severity === 'ok');

  console.log('═'.repeat(80));
  console.log('PRICING VALIDATION REPORT');
  console.log('═'.repeat(80));
  console.log('');

  // Critical issues (>10% change)
  if (critical.length > 0) {
    console.log(`🚨 CRITICAL: ${critical.length} pricing discrepancies >${ALERT_THRESHOLD_PERCENT}%`);
    console.log('─'.repeat(80));
    for (const diff of critical) {
      console.log(`${diff.provider}/${diff.modelName} - ${diff.field}`);
      console.log(`  Current:  ${formatPrice(diff.currentValue)}`);
      console.log(`  Expected: ${formatPrice(diff.expectedValue)}`);
      console.log(`  Change:   ${diff.percentChange > 0 ? '+' : ''}${diff.percentChange.toFixed(2)}%`);
      console.log('');
    }
  }

  // Warnings (5-10% change)
  if (warnings.length > 0) {
    console.log(`⚠️  WARNING: ${warnings.length} pricing discrepancies 5-${ALERT_THRESHOLD_PERCENT}%`);
    console.log('─'.repeat(80));
    for (const diff of warnings) {
      console.log(`${diff.provider}/${diff.modelName} - ${diff.field}`);
      console.log(`  Current:  ${formatPrice(diff.currentValue)}`);
      console.log(`  Expected: ${formatPrice(diff.expectedValue)}`);
      console.log(`  Change:   ${diff.percentChange > 0 ? '+' : ''}${diff.percentChange.toFixed(2)}%`);
      console.log('');
    }
  }

  // Minor differences (<5% change)
  if (ok.length > 0) {
    console.log(`ℹ️  INFO: ${ok.length} minor pricing differences <5%`);
    console.log('─'.repeat(80));
    for (const diff of ok) {
      console.log(
        `${diff.provider}/${diff.modelName} - ${diff.field}: ${diff.percentChange > 0 ? '+' : ''}${diff.percentChange.toFixed(2)}%`
      );
    }
    console.log('');
  }

  console.log('═'.repeat(80));
  console.log('');

  // Recommendations
  if (critical.length > 0) {
    console.log('🔧 RECOMMENDED ACTIONS:');
    console.log('  1. Run: npm run sync-models');
    console.log('  2. Review model_changes table for audit trail');
    console.log('  3. Alert team about significant pricing changes');
    console.log('');
  } else if (warnings.length > 0) {
    console.log('💡 RECOMMENDED:');
    console.log('  - Consider running: npm run sync-models');
    console.log('');
  }
}

/**
 * Main validation function
 */
async function main() {
  console.log('🔍 Starting pricing validation...\n');

  try {
    const diffs = await validateAgainstOpenRouter();

    printReport(diffs);

    // Exit with error code if critical issues found
    const critical = diffs.filter((d) => d.severity === 'critical');
    if (critical.length > 0) {
      console.error(`❌ Validation failed: ${critical.length} critical pricing discrepancies found`);
      process.exit(1);
    }

    console.log('✓ Pricing validation complete\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { validateAgainstOpenRouter, printReport };
