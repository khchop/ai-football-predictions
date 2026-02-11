/**
 * Verify schema syntax - test import
 */
import { matches } from '../src/lib/db/schema';

// If this compiles and runs, the schema syntax is correct
console.log('✅ Schema imports successfully');
console.log(`✅ matches table defined with ${Object.keys(matches).length} properties`);
