/**
 * Content Deduplication Service
 * 
 * Implements Jaccard similarity for content comparison and deduplication.
 * Used to ensure unique roundups by detecting and preventing duplicate/similar content.
 */

import crypto from 'crypto';
import { getDb, matchRoundups } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { loggers } from '@/lib/logger/modules';

// Configuration
export const DEDUPLICATION_CONFIG = {
  // Jaccard similarity threshold: > 0.7 = too similar, regenerate
  similarityThreshold: 0.7,
  
  // Number of recent roundups to compare against
  recentRoundupsLimit: 10,
  
  // Min token length to include in comparison
  minTokenLength: 3,
  
  // Hash algorithm for content hashing
  hashAlgorithm: 'sha256',
} as const;

/**
 * Tokenize text into word tokens for similarity comparison
 */
export function tokenize(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  // Normalize: lowercase, remove punctuation, normalize whitespace
  const normalized = text
    .toLowerCase()
    // Remove HTML tags
    .replace(/<[^>]*>/g, ' ')
    // Remove punctuation except apostrophes in words
    .replace(/[^\w\s']/g, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
  
  // Split into tokens and filter
  return normalized
    .split(' ')
    .filter(token => token.length >= DEDUPLICATION_CONFIG.minTokenLength);
}

/**
 * Compute Jaccard similarity between two token sets
 * Jaccard = |intersection| / |union|
 */
export function computeJaccardSimilarity(tokens1: string[], tokens2: string[]): number {
  if (!tokens1.length && !tokens2.length) {
    return 0;
  }
  
  if (!tokens1.length || !tokens2.length) {
    return 0;
  }
  
  // Create sets for intersection/union computation
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  // Compute intersection
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  
  // Compute union
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Compute content hash for exact-match detection
 */
export function computeContentHash(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }
  
  // Normalize content before hashing (same normalization as tokenize)
  const normalized = content
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return crypto
    .createHash(DEDUPLICATION_CONFIG.hashAlgorithm)
    .update(normalized)
    .digest('hex');
}

/**
 * Find similar roundups against recent content
 */
export async function findSimilarRoundups(
  content: string,
  excludeMatchId?: string
): Promise<Array<{ matchId: string; similarity: number; roundupId: string }>> {
  const db = getDb();
  
  // Fetch recent roundups
  const recentRoundups = await db
    .select({
      id: matchRoundups.id,
      matchId: matchRoundups.matchId,
      narrative: matchRoundups.narrative,
      similarityHash: matchRoundups.similarityHash,
    })
    .from(matchRoundups)
    .where(eq(matchRoundups.status, 'published'))
    .orderBy(desc(matchRoundups.publishedAt))
    .limit(DEDUPLICATION_CONFIG.recentRoundupsLimit);
  
  // Tokenize new content
  const newTokens = tokenize(content);
  
  const similarRoundups: Array<{ matchId: string; similarity: number; roundupId: string }> = [];
  
  for (const roundup of recentRoundups) {
    // Skip if same match
    if (excludeMatchId && roundup.matchId === excludeMatchId) {
      continue;
    }
    
    // Skip if no narrative
    if (!roundup.narrative) {
      continue;
    }
    
    // Tokenize existing narrative
    const existingTokens = tokenize(roundup.narrative);
    
    // Compute Jaccard similarity
    const similarity = computeJaccardSimilarity(newTokens, existingTokens);
    
    // Add to results if above threshold
    if (similarity > 0) {
      similarRoundups.push({
        matchId: roundup.matchId,
        roundupId: roundup.id,
        similarity,
      });
    }
  }
  
  // Sort by similarity (highest first)
  return similarRoundups.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Check if content is too similar to existing roundups
 */
export async function isTooSimilar(
  content: string,
  threshold: number = DEDUPLICATION_CONFIG.similarityThreshold,
  excludeMatchId?: string
): Promise<{ isTooSimilar: boolean; maxSimilarity: number; similarRoundups: Array<{ matchId: string; similarity: number }> }> {
  const similarRoundups = await findSimilarRoundups(content, excludeMatchId);
  
  if (similarRoundups.length === 0) {
    return {
      isTooSimilar: false,
      maxSimilarity: 0,
      similarRoundups: [],
    };
  }
  
  const maxSimilarity = Math.max(...similarRoundups.map(r => r.similarity));
  
  return {
    isTooSimilar: maxSimilarity > threshold,
    maxSimilarity,
    similarRoundups: similarRoundups.map(r => ({
      matchId: r.matchId,
      similarity: r.similarity,
    })),
  };
}

/**
 * Check for exact duplicate by content hash
 */
export async function findExactDuplicate(
  content: string
): Promise<{ found: boolean; matchId: string | null; roundupId: string | null }> {
  const contentHash = computeContentHash(content);
  
  if (!contentHash) {
    return { found: false, matchId: null, roundupId: null };
  }
  
  const db = getDb();
  
  const result = await db
    .select({
      id: matchRoundups.id,
      matchId: matchRoundups.matchId,
    })
    .from(matchRoundups)
    .where(eq(matchRoundups.similarityHash, contentHash))
    .limit(1);
  
  if (result.length > 0) {
    loggers.content.warn(
      { contentHash, matchId: result[0].matchId },
      'Exact duplicate roundup detected'
    );
    return {
      found: true,
      matchId: result[0].matchId ?? null,
      roundupId: result[0].id,
    };
  }
  
  return { found: false, matchId: null, roundupId: null };
}

/**
 * Complete deduplication check for new roundup content
 */
export async function checkForDuplicates(
  content: string,
  excludeMatchId?: string
): Promise<{
  action: 'allow' | 'regenerate' | 'skip';
  reason: string;
  details: {
    exactDuplicate: boolean;
    similarCount: number;
    maxSimilarity: number;
    similarMatchIds: string[];
  };
}> {
  // Step 1: Check for exact duplicate
  const exactCheck = await findExactDuplicate(content);
  
  if (exactCheck.found) {
    loggers.content.warn(
      { matchId: exactCheck.matchId },
      'Skipping roundup generation - exact duplicate detected'
    );
    return {
      action: 'skip',
      reason: 'Exact duplicate of existing roundup',
      details: {
        exactDuplicate: true,
        similarCount: 0,
        maxSimilarity: 1,
        similarMatchIds: [],
      },
    };
  }
  
  // Step 2: Check for similarity (Jaccard)
  const similarCheck = await isTooSimilar(content, DEDUPLICATION_CONFIG.similarityThreshold, excludeMatchId);
  
  if (similarCheck.isTooSimilar) {
    loggers.content.warn(
      { maxSimilarity: similarCheck.maxSimilarity },
      'Roundup too similar to existing content - regeneration recommended'
    );
    return {
      action: 'regenerate',
      reason: `Content ${(similarCheck.maxSimilarity * 100).toFixed(1)}% similar to existing roundup (threshold: ${(DEDUPLICATION_CONFIG.similarityThreshold * 100).toFixed(0)}%)`,
      details: {
        exactDuplicate: false,
        similarCount: similarCheck.similarRoundups.length,
        maxSimilarity: similarCheck.maxSimilarity,
        similarMatchIds: similarCheck.similarRoundups.map(r => r.matchId),
      },
    };
  }
  
  // Step 3: Allow new content
  return {
    action: 'allow',
    reason: 'Content is unique',
    details: {
      exactDuplicate: false,
      similarCount: similarCheck.similarRoundups.length,
      maxSimilarity: similarCheck.maxSimilarity,
      similarMatchIds: similarCheck.similarRoundups.map(r => r.matchId),
    },
  };
}
