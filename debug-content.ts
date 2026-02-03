// Debug script to check blog content status
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getDb, matches, matchContent, blogPosts } from './src/lib/db';
import { eq, desc, gte, and, sql } from 'drizzle-orm';

async function debugContent() {
  console.log('🔍 DEBUG: Checking blog and content generation status...\n');

  if (!process.env.DATABASE_URL) {
    console.log('❌ ERROR: DATABASE_URL not configured');
    console.log('Please create .env.local with DATABASE_URL');
    return;
  }

  const db = getDb();

  try {
    // 1. Check recent finished matches (Jan 24-27, 2026)
    console.log('1️⃣ Recent finished matches (Jan 24-27, 2026):');
    const cutoffDate = new Date('2026-01-24T00:00:00.000Z');

    const recentMatches = await db
      .select({
        id: matches.id,
        homeTeam: matches.homeTeam,
        awayTeam: matches.awayTeam,
        kickoffTime: matches.kickoffTime,
        status: matches.status,
      })
      .from(matches)
      .where(and(
        eq(matches.status, 'finished'),
        sql`${matches.kickoffTime} >= ${cutoffDate.toISOString()}`
      ))
      .orderBy(desc(matches.kickoffTime))
      .limit(20);

    console.log(`   Found ${recentMatches.length} finished matches\n`);

    for (const match of recentMatches) {
      // Check if match content exists
      const content = await db
        .select()
        .from(matchContent)
        .where(eq(matchContent.matchId, match.id))
        .limit(1);

      const hasContent = content.length > 0;
      const contentTypes = [];

      if (hasContent) {
        if (content[0].preMatchContent) contentTypes.push('pre');
        if (content[0].bettingContent) contentTypes.push('betting');
        if (content[0].postMatchContent) contentTypes.push('post');
      }

      console.log(`   ${match.homeTeam} vs ${match.awayTeam} (${match.kickoffTime}):`);
      console.log(`      Status: ${hasContent ? '✓ Has content (' + contentTypes.join(',') + ')' : '❌ MISSING'}`);
    }

    // 2. Check blogPosts table
    console.log('\n2️⃣ Blog Posts table:');
    const posts = await db
      .select()
      .from(blogPosts)
      .where(gte(blogPosts.createdAt, new Date('2026-01-20')))
      .orderBy(desc(blogPosts.createdAt));

    console.log(`   Found ${posts.length} blog posts since Jan 20, 2026\n`);

    for (const post of posts.slice(0, 10)) {
      console.log(`   - ${post.title || 'Untitled'}`);
      console.log(`     Created: ${post.createdAt}`);
      console.log(`     Status: ${post.status || 'N/A'}`);
    }

    // 3. Check matchContent without postMatch content
    console.log('\n3️⃣ Matches missing post-match content:');
    const matchesMissingContent = await db
      .select({
        id: matches.id,
        homeTeam: matches.homeTeam,
        awayTeam: matches.awayTeam,
        kickoffTime: matches.kickoffTime,
      })
      .from(matches)
      .leftJoin(matchContent, eq(matches.id, matchContent.matchId))
      .where(and(
        eq(matches.status, 'finished'),
        sql`${matches.kickoffTime} >= ${cutoffDate.toISOString()}`,
        sql`${matchContent.postMatchContent} IS NULL`
      ))
      .orderBy(desc(matches.kickoffTime));

    console.log(`   Found ${matchesMissingContent.length} matches missing post-match content\n`);

    for (const match of matchesMissingContent) {
      console.log(`   ❌ ${match.homeTeam} vs ${match.awayTeam} (${match.kickoffTime})`);
    }

    console.log('\n✅ Debug complete');

  } catch (error) {
    console.error('❌ Error during debug:', error);
  }
}

debugContent().catch(console.error);
