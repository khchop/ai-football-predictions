import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    console.log('🔗 Connecting to database...');
    const db = getDb();
    
    const migrationSQL = fs.readFileSync(
      path.join(process.cwd(), 'migrations', '002_predictions_system.sql'),
      'utf-8'
    );
    
    console.log('📝 Running migration: 002_predictions_system.sql');
    console.log('   - Dropping betting tables (bets, model_balances, seasons)');
    console.log('   - Creating predictions table');
    
    await db.execute(sql.raw(migrationSQL));
    
    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Rebuild the application: npm run build');
    console.log('2. Restart workers to use new predictions system');
    console.log('3. Test with a prediction job');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('');
    console.error('The database may be in an inconsistent state.');
    console.error('Please check the error and restore from backup if needed.');
    process.exit(1);
  }
}

runMigration();
