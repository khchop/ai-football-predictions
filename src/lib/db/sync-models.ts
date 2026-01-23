/**
 * Model Synchronization
 * 
 * Automatically syncs the database models table with active providers from code.
 * Runs on server startup to ensure database is always in sync.
 */

import { getDb } from './index';
import { models } from './schema';
import { getActiveProviders } from '../llm';
import { eq } from 'drizzle-orm';

/**
 * Sync models from code to database
 * - Upserts active providers into models table
 * - Deactivates models not found in code (preserves historical data)
 * - Safe to run multiple times (idempotent)
 */
export async function syncModelsToDatabase(): Promise<{
  added: number;
  updated: number;
  deactivated: number;
  total: number;
}> {
  console.log('[Model Sync] Starting automatic sync...');
  
  const db = getDb();
  
   try {
     // Get all active providers from code
     const providers = await getActiveProviders();
     
     if (providers.length === 0) {
      console.warn('[Model Sync] ⚠️  No active providers found in code!');
      return { added: 0, updated: 0, deactivated: 0, total: 0 };
    }
    
    let added = 0;
    let updated = 0;
    
    // Upsert each provider into database
    for (const provider of providers) {
      try {
        // Check if model exists
        const existing = await db
          .select()
          .from(models)
          .where(eq(models.id, provider.id))
          .limit(1);
        
        const modelData = {
          id: provider.id,
          provider: provider.name,
          modelName: provider.model,
          displayName: provider.displayName,
          isPremium: provider.isPremium,
          active: true,
          createdAt: new Date().toISOString(),
        };
        
        if (existing.length === 0) {
          // Insert new model
          await db.insert(models).values(modelData);
          added++;
        } else {
          // Update existing model (preserve health tracking data)
          await db
            .update(models)
            .set({
              provider: provider.name,
              modelName: provider.model,
              displayName: provider.displayName,
              isPremium: provider.isPremium,
              active: true,
            })
            .where(eq(models.id, provider.id));
          updated++;
        }
      } catch (error) {
        console.error(`[Model Sync] Error processing ${provider.id}:`, error);
      }
    }
    
    // Get list of provider IDs from code
    const providerIds = providers.map(p => p.id);
    
    // Find models in database that are NOT in code providers
    const allDbModels = await db.select().from(models);
    const orphanedModels = allDbModels.filter(m => !providerIds.includes(m.id));
    
    // Deactivate orphaned models (don't delete, preserve for historical data)
    let deactivated = 0;
    for (const orphan of orphanedModels) {
      if (orphan.active) {
        await db
          .update(models)
          .set({ active: false })
          .where(eq(models.id, orphan.id));
        deactivated++;
      }
    }
    
    console.log(`[Model Sync] ✓ Complete: ${added} added, ${updated} updated, ${deactivated} deactivated (${providers.length} total active)`);
    
    return {
      added,
      updated,
      deactivated,
      total: providers.length,
    };
  } catch (error) {
    console.error('[Model Sync] ❌ Failed:', error);
    throw error;
  }
}
