/**
 * One-time script to fix the model count in the database.
 * Deactivates all models not in the current ALL_PROVIDERS list.
 * 
 * Run with: npx tsx scripts/fix-model-count.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, models } from '../src/lib/db/index';
import { notInArray, eq } from 'drizzle-orm';
import { ALL_PROVIDERS } from '../src/lib/llm';

async function fixModelCount() {
  const db = getDb();
  
  // Get current model IDs from ALL_PROVIDERS
  const currentModelIds = ALL_PROVIDERS.map(p => p.id);
  console.log(`Current models in code: ${currentModelIds.length}`);
  console.log('Model IDs:', currentModelIds.join(', '));
  
  // Count active models before
  const beforeCount = await db.select().from(models).where(eq(models.active, true));
  console.log(`\nActive models in DB before: ${beforeCount.length}`);
  
  // Find models to deactivate
  const toDeactivate = beforeCount.filter(m => !currentModelIds.includes(m.id));
  console.log(`\nModels to deactivate (${toDeactivate.length}):`);
  for (const model of toDeactivate) {
    console.log(`  - ${model.id}: ${model.displayName}`);
  }
  
  if (toDeactivate.length > 0) {
    // Deactivate old models
    await db
      .update(models)
      .set({ active: false })
      .where(notInArray(models.id, currentModelIds));
    
    console.log('\nDeactivated old models.');
  }
  
  // Count active models after
  const afterCount = await db.select().from(models).where(eq(models.active, true));
  console.log(`\nActive models in DB after: ${afterCount.length}`);
  
  console.log('\nDone!');
  process.exit(0);
}

fixModelCount().catch(console.error);
