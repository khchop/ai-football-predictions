import { getMatchesNeedingRescore } from '@/lib/db/queries';
import { settlementQueue, JOB_TYPES, closeQueueConnection } from '@/lib/queue';

async function triggerRescore() {
  console.log('🔍 Checking for matches needing rescore...');
  
  // Find matches that are finished but have pending predictions
  const matches = await getMatchesNeedingRescore();
  
  if (matches.length === 0) {
    console.log('✅ No matches need re-scoring.');
    await closeQueueConnection();
    process.exit(0);
  }

  console.log(`found ${matches.length} matches needing rescore.`);
  
  for (const match of matches) {
      console.log(`Queueing rescore for match: ${match.homeTeam} vs ${match.awayTeam} (${match.id})`);
      await settlementQueue.add(
        JOB_TYPES.SETTLE_MATCH,
        {
          matchId: match.id,
        },
        {
          priority: 2,
          jobId: `rescore-${match.id}-${Date.now()}`,
        }
      );
  }
  
  console.log('✅ All jobs queued.');
  
  // Allow time for jobs to be sent
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await closeQueueConnection();
  process.exit(0);
}

triggerRescore().catch(async (err) => {
    console.error('Error:', err);
    await closeQueueConnection();
    process.exit(1);
});
