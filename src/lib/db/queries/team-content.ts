/**
 * Team Content Queries
 *
 * CRUD operations for AI-generated team analysis and FAQ content.
 * Includes Redis caching (5 min TTL) for read operations.
 */

import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { getDb, teamContent } from '@/lib/db';
import type { TeamContent } from '@/lib/db';
import { withCache, cacheDelete } from '@/lib/cache/redis';
import type { FAQItem } from '@/lib/seo/schemas';

/**
 * Get team content by team name (with Redis caching)
 * Returns cached content if available, otherwise fetches from DB
 */
export async function getTeamContent(teamName: string): Promise<TeamContent | null> {
  const cacheKey = `team-content:${teamName}`;

  return withCache(
    cacheKey,
    300, // 5 minutes TTL
    async () => {
      const db = getDb();
      const results = await db
        .select()
        .from(teamContent)
        .where(eq(teamContent.teamName, teamName))
        .limit(1);

      return results.length > 0 ? results[0] : null;
    }
  );
}

/**
 * Upsert team analysis content
 * Updates analysis text and generation metadata, invalidates cache
 */
export async function upsertTeamAnalysis(
  teamName: string,
  analysis: string,
  metadata: {
    generatedBy: string;
    totalTokens: number;
    totalCost: string;
  }
): Promise<void> {
  const db = getDb();
  const nowISOString = new Date().toISOString();
  const contentId = uuidv4();

  await db
    .insert(teamContent)
    .values({
      id: contentId,
      teamName,
      analysis,
      analysisGeneratedAt: nowISOString,
      generatedBy: metadata.generatedBy,
      totalTokens: metadata.totalTokens,
      totalCost: metadata.totalCost,
      createdAt: nowISOString,
      updatedAt: nowISOString,
    })
    .onConflictDoUpdate({
      target: teamContent.teamName,
      set: {
        analysis,
        analysisGeneratedAt: nowISOString,
        generatedBy: metadata.generatedBy,
        totalTokens: metadata.totalTokens,
        totalCost: metadata.totalCost,
        updatedAt: nowISOString,
      },
    });

  // Invalidate cache after write
  await cacheDelete(`team-content:${teamName}`);
}

/**
 * Upsert team FAQ content
 * Updates FAQ JSON and generation metadata, invalidates cache
 */
export async function upsertTeamFAQs(
  teamName: string,
  faqs: FAQItem[],
  metadata: {
    generatedBy: string;
    totalTokens: number;
    totalCost: string;
  }
): Promise<void> {
  const db = getDb();
  const nowISOString = new Date().toISOString();
  const contentId = uuidv4();

  await db
    .insert(teamContent)
    .values({
      id: contentId,
      teamName,
      faqContent: JSON.stringify(faqs),
      faqGeneratedAt: nowISOString,
      generatedBy: metadata.generatedBy,
      totalTokens: metadata.totalTokens,
      totalCost: metadata.totalCost,
      createdAt: nowISOString,
      updatedAt: nowISOString,
    })
    .onConflictDoUpdate({
      target: teamContent.teamName,
      set: {
        faqContent: JSON.stringify(faqs),
        faqGeneratedAt: nowISOString,
        generatedBy: metadata.generatedBy,
        totalTokens: metadata.totalTokens,
        totalCost: metadata.totalCost,
        updatedAt: nowISOString,
      },
    });

  // Invalidate cache after write
  await cacheDelete(`team-content:${teamName}`);
}
