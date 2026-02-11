/**
 * Validate Model IDs Script
 *
 * Checks for duplicate model IDs across all provider arrays:
 * - OPENROUTER_PROVIDERS (38 models)
 *
 * Usage: npm run validate:model-ids
 */

import { OPENROUTER_PROVIDERS } from '../src/lib/llm/providers/openrouter';

function main() {
  console.log('\n=== Model ID Validation ===\n');

  const allProviders = [
    ...OPENROUTER_PROVIDERS.map(p => ({ id: p.id, provider: 'openrouter' as const, model: p.model })),
  ];

  console.log(`OpenRouter: ${OPENROUTER_PROVIDERS.length} models`);
  console.log(`Total:      ${allProviders.length} models\n`);

  // Check for duplicate internal IDs
  const idMap = new Map<string, Array<{ provider: string; model: string }>>();
  for (const p of allProviders) {
    const existing = idMap.get(p.id) || [];
    existing.push({ provider: p.provider, model: p.model });
    idMap.set(p.id, existing);
  }

  const duplicates = [...idMap.entries()].filter(([, entries]) => entries.length > 1);

  if (duplicates.length > 0) {
    console.error('ERROR: Duplicate model IDs detected!\n');
    for (const [id, entries] of duplicates) {
      console.error(`  "${id}" appears ${entries.length} times:`);
      for (const entry of entries) {
        console.error(`    - ${entry.provider} (model: ${entry.model})`);
      }
    }
    console.error(`\n${duplicates.length} duplicate ID(s) found. Fix before deployment.\n`);
    process.exit(1);
  }

  console.log(`All ${allProviders.length} model IDs are unique across all providers.\n`);

  // Also check for duplicate API model IDs (the model field sent to APIs)
  const modelMap = new Map<string, Array<{ id: string; provider: string }>>();
  for (const p of allProviders) {
    const existing = modelMap.get(p.model) || [];
    existing.push({ id: p.id, provider: p.provider });
    modelMap.set(p.model, existing);
  }

  const modelDuplicates = [...modelMap.entries()].filter(([, entries]) => entries.length > 1);
  if (modelDuplicates.length > 0) {
    console.log('NOTE: Some API model IDs appear across multiple providers (expected for multi-provider routing):');
    for (const [model, entries] of modelDuplicates) {
      console.log(`  "${model}": ${entries.map(e => `${e.id} (${e.provider})`).join(', ')}`);
    }
    console.log('');
  }

  console.log('Validation PASSED.\n');
}

main();
