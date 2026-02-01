/**
 * Sync Models Script
 * 
 * Synchronizes the database models table with the active providers from code.
 * This ensures the database always has the correct models for predictions.
 * 
 * Usage: npm run sync-models
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getDb } from '../src/lib/db';
import { models } from '../src/lib/db/schema';
import { TOGETHER_PROVIDERS } from '../src/lib/llm/providers/together';
import { eq } from 'drizzle-orm';

async function syncModels() {
  console.log('\n🔄 [Sync Models] Starting database sync...\n');
  
  const db = getDb();
  
  try {
    // Get all active providers from code
    const providers = TOGETHER_PROVIDERS;
    console.log(`📦 Found ${providers.length} providers in code`);
    
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
          console.log(`  ✅ Added: ${provider.displayName} (${provider.id})`);
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
          console.log(`  🔄 Updated: ${provider.displayName} (${provider.id})`);
          updated++;
        }
      } catch (error) {
        console.error(`  ❌ Error processing ${provider.id}:`, error);
      }
    }
    
    // Get list of provider IDs from code
    const providerIds = providers.map(p => p.id);
    
    // Find models in database that are NOT in code providers
    const allDbModels = await db.select().from(models);
    const orphanedModels = allDbModels.filter(m => !providerIds.includes(m.id));
    
    console.log(`\n🗑️  Found ${orphanedModels.length} orphaned models (not in code)`);
    
    // Deactivate orphaned models (don't delete, preserve for historical data)
    let deactivated = 0;
    for (const orphan of orphanedModels) {
      await db
        .update(models)
        .set({ active: false })
        .where(eq(models.id, orphan.id));
      console.log(`  ⏸️  Deactivated: ${orphan.displayName} (${orphan.id})`);
      deactivated++;
    }
    
    console.log('\n✅ [Sync Models] Database sync complete!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Added: ${added} models`);
    console.log(`   - Updated: ${updated} models`);
    console.log(`   - Deactivated: ${deactivated} models`);
    console.log(`   - Total active: ${providers.length} models\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ [Sync Models] Failed:', error);
    process.exit(1);
  }
}

// Run the sync
syncModels();
