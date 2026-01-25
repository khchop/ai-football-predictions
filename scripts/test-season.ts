// Test the season calculation logic
const now = new Date();
console.log('Current date:', now.toISOString());
console.log('Current month (0-indexed):', now.getMonth());
console.log('Current year:', now.getFullYear());

const CURRENT_SEASON = now.getMonth() >= 7 
  ? now.getFullYear() 
  : now.getFullYear() - 1;

console.log('Calculated CURRENT_SEASON:', CURRENT_SEASON);
console.log('Expected: 2025 (for 2025-26 season starting Aug 2025)');
