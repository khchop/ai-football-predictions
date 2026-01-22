import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runHotfixMigration() {
  try {
    console.log('🔗 Connecting to database...');
    const db = getDb();
    
    const migrationSQL = fs.readFileSync(
      path.join(process.cwd(), 'migrations', '003_hotfix_restore_betting_tables.sql'),
      'utf-8'
    );
    
    console.log('📝 Running hotfix migration: 003_hotfix_restore_betting_tables.sql');
    console.log('   - Restoring bets table (empty structure)');
    console.log('   - Restoring model_balances table (empty structure)');
    console.log('   - Restoring seasons table (empty structure)');
    
    await db.execute(sql.raw(migrationSQL));
    
    console.log('');
    console.log('✅ Hotfix migration completed successfully!');
    console.log('');
    console.log('System can now run without errors.');
    console.log('Tables are empty - they exist only for backwards compatibility.');
    console.log('');
    console.log('Next: Deploy proper fix to use predictions instead of bets.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Hotfix migration failed:', error);
    console.error('');
    console.error('Please check the error and try again.');
    process.exit(1);
  }
}

runHotfixMigration();
