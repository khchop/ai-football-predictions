import { getDb } from '@/lib/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  try {
    console.log('🔗 Connecting to database...');
    const db = getDb();
    
    const migrationSQL = fs.readFileSync(
      path.join(process.cwd(), 'migrations', '003_fix_tendency_constraint.sql'),
      'utf-8'
    );
    
    console.log('📝 Running migration: 003_fix_tendency_constraint.sql');
    
    await db.execute(sql.raw(migrationSQL));
    
    console.log('');
    console.log('✅ Constraint fixed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run the rescoring script to process pending (failed) predictions');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
