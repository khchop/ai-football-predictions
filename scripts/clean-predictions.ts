/**
 * Clean Predictions Script
 * 
 * Deletes all predictions from old OpenRouter models that are no longer active.
 * This removes orphaned predictions that reference deactivated models.
 * 
 * Usage: npm run clean-predictions
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getDb } from '../src/lib/db';
import { predictions, models } from '../src/lib/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';

async function cleanPredictions() {
  console.log('\n🧹 [Clean Predictions] Starting cleanup...\n');
  
  const db = getDb();
  
  try {
    // Get all inactive models (old OpenRouter models)
    const inactiveModels = await db
      .select({ id: models.id, displayName: models.displayName })
      .from(models)
      .where(eq(models.active, false));
    
    if (inactiveModels.length === 0) {
      console.log('✅ No inactive models found. Nothing to clean.');
      process.exit(0);
    }
    
    console.log(`📋 Found ${inactiveModels.length} inactive models:`);
    inactiveModels.forEach(m => console.log(`   - ${m.displayName} (${m.id})`));
    
    const inactiveModelIds = inactiveModels.map(m => m.id);
    
    // Count predictions to be deleted
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(predictions)
      .where(inArray(predictions.modelId, inactiveModelIds));
    
    const totalToDelete = Number(countResult[0]?.count || 0);
    
    if (totalToDelete === 0) {
      console.log('\n✅ No predictions found for inactive models. Nothing to delete.');
      process.exit(0);
    }
    
    console.log(`\n🗑️  Found ${totalToDelete} predictions to delete`);
    
    // Delete predictions
    const result = await db
      .delete(predictions)
      .where(inArray(predictions.modelId, inactiveModelIds));
    
    console.log('\n✅ [Clean Predictions] Cleanup complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Inactive models: ${inactiveModels.length}`);
    console.log(`   - Predictions deleted: ${totalToDelete}`);
    console.log(`   - Database cleaned successfully\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ [Clean Predictions] Failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanPredictions();
