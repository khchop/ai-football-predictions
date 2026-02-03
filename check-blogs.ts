
import { getDb, blogPosts } from './src/lib/db';
import { desc, gte } from 'drizzle-orm';

async function checkBlogPosts() {
  const db = getDb();
  const recentPosts = await db
    .select()
    .from(blogPosts)
    .where(gte(blogPosts.createdAt, new Date('2026-01-20')))
    .orderBy(desc(blogPosts.createdAt));

  console.log('Recent Blog Posts:', JSON.stringify(recentPosts, null, 2));
}

checkBlogPosts().catch(console.error);
