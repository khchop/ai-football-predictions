import { getDb, matchContent, blogPosts, matchPreviews, matchRoundups } from '../src/lib/db';
import { sanitizeContent } from '../src/lib/content/sanitization';
import { eq, sql } from 'drizzle-orm';

/**
 * Clean HTML from existing LLM-generated content
 * Run once to sanitize all existing records
 *
 * Tables processed:
 * - matchContent: preMatchContent, bettingContent, postMatchContent, faqContent (JSON)
 * - blogPosts: title, excerpt, content, metaTitle, metaDescription
 * - matchPreviews: introduction, teamFormAnalysis, headToHead, keyPlayers, tacticalAnalysis, prediction, bettingInsights, metaDescription
 * - matchRoundups: title, narrative, modelPredictions
 */
async function cleanHtmlContent() {
  const db = getDb();
  console.log('Starting HTML sanitization migration...\n');

  // 1. Clean matchContent table
  console.log('Cleaning matchContent...');
  const contentRecords = await db.select().from(matchContent);
  let contentCleaned = 0;

  for (const record of contentRecords) {
    const updates: Record<string, string | null> = {};

    if (record.preMatchContent) {
      updates.preMatchContent = sanitizeContent(record.preMatchContent);
    }
    if (record.bettingContent) {
      updates.bettingContent = sanitizeContent(record.bettingContent);
    }
    if (record.postMatchContent) {
      updates.postMatchContent = sanitizeContent(record.postMatchContent);
    }
    // FAQ is JSON - sanitize each question/answer
    if (record.faqContent) {
      try {
        const faqs = JSON.parse(record.faqContent) as Array<{ question: string; answer: string }>;
        const cleanFaqs = faqs.map((faq) => ({
          question: sanitizeContent(faq.question),
          answer: sanitizeContent(faq.answer),
        }));
        updates.faqContent = JSON.stringify(cleanFaqs);
      } catch {
        // Skip invalid JSON
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(matchContent)
        .set({ ...updates, updatedAt: new Date().toISOString() })
        .where(eq(matchContent.id, record.id));
      contentCleaned++;

      if (contentCleaned % 50 === 0) {
        console.log(`  Processed ${contentCleaned}/${contentRecords.length}...`);
      }
    }
  }
  console.log(`  Cleaned ${contentCleaned} matchContent records\n`);

  // 2. Clean blogPosts table
  console.log('Cleaning blogPosts...');
  const blogRecords = await db.select().from(blogPosts);
  let blogsCleaned = 0;

  for (const blog of blogRecords) {
    // Build updates object, only including nullable fields if they have values
    const blogUpdates: Record<string, string> = {
      // Required fields (notNull in schema) - always sanitize
      title: sanitizeContent(blog.title),
      content: sanitizeContent(blog.content),
      updatedAt: new Date().toISOString(),
    };
    // Optional fields - only set if value exists
    if (blog.excerpt) blogUpdates.excerpt = sanitizeContent(blog.excerpt);
    if (blog.metaTitle) blogUpdates.metaTitle = sanitizeContent(blog.metaTitle);
    if (blog.metaDescription) blogUpdates.metaDescription = sanitizeContent(blog.metaDescription);

    await db.update(blogPosts).set(blogUpdates).where(eq(blogPosts.id, blog.id));

    blogsCleaned++;
    if (blogsCleaned % 10 === 0) {
      console.log(`  Processed ${blogsCleaned}/${blogRecords.length}...`);
    }
  }
  console.log(`  Cleaned ${blogsCleaned} blogPosts records\n`);

  // 3. Clean matchPreviews table
  console.log('Cleaning matchPreviews...');
  const previewRecords = await db.select().from(matchPreviews);
  let previewsCleaned = 0;

  for (const preview of previewRecords) {
    // Build updates object, only including nullable fields if they have values
    const previewUpdates: Record<string, string> = {
      // Required fields (notNull in schema) - always sanitize
      introduction: sanitizeContent(preview.introduction),
      teamFormAnalysis: sanitizeContent(preview.teamFormAnalysis),
      prediction: sanitizeContent(preview.prediction),
      updatedAt: new Date().toISOString(),
    };
    // Optional fields - only set if value exists
    if (preview.headToHead) previewUpdates.headToHead = sanitizeContent(preview.headToHead);
    if (preview.keyPlayers) previewUpdates.keyPlayers = sanitizeContent(preview.keyPlayers);
    if (preview.tacticalAnalysis) previewUpdates.tacticalAnalysis = sanitizeContent(preview.tacticalAnalysis);
    if (preview.bettingInsights) previewUpdates.bettingInsights = sanitizeContent(preview.bettingInsights);
    if (preview.metaDescription) previewUpdates.metaDescription = sanitizeContent(preview.metaDescription);

    await db.update(matchPreviews).set(previewUpdates).where(eq(matchPreviews.id, preview.id));

    previewsCleaned++;
    if (previewsCleaned % 10 === 0) {
      console.log(`  Processed ${previewsCleaned}/${previewRecords.length}...`);
    }
  }
  console.log(`  Cleaned ${previewsCleaned} matchPreviews records\n`);

  // 4. Clean matchRoundups table
  console.log('Cleaning matchRoundups...');
  const roundupRecords = await db.select().from(matchRoundups);
  let roundupsCleaned = 0;

  for (const roundup of roundupRecords) {
    // All content fields are notNull in matchRoundups schema
    await db.update(matchRoundups).set({
      title: sanitizeContent(roundup.title),
      narrative: sanitizeContent(roundup.narrative),
      modelPredictions: sanitizeContent(roundup.modelPredictions),
      updatedAt: new Date(), // matchRoundups uses timestamp type, not text
    }).where(eq(matchRoundups.id, roundup.id));

    roundupsCleaned++;
    if (roundupsCleaned % 10 === 0) {
      console.log(`  Processed ${roundupsCleaned}/${roundupRecords.length}...`);
    }
  }
  console.log(`  Cleaned ${roundupsCleaned} matchRoundups records\n`);

  // 5. Verification
  console.log('Verifying HTML removal...');
  // Note: Using raw SQL for LIKE queries
  // The LIKE '%<%' check may have false positives for legitimate angle brackets
  // (e.g., "score > 3"). This is acceptable - the check is conservative.
  const verificationQuery = sql`
    SELECT 'matchContent' as table_name, COUNT(*) as html_count
    FROM match_content
    WHERE pre_match_content LIKE '%<%'
       OR betting_content LIKE '%<%'
       OR post_match_content LIKE '%<%'
       OR pre_match_content LIKE '%&amp;%'
       OR betting_content LIKE '%&amp;%'
       OR post_match_content LIKE '%&amp;%'
    UNION ALL
    SELECT 'blogPosts', COUNT(*)
    FROM blog_posts
    WHERE title LIKE '%<%' OR content LIKE '%<%'
       OR title LIKE '%&amp;%' OR content LIKE '%&amp;%'
    UNION ALL
    SELECT 'matchPreviews', COUNT(*)
    FROM match_previews
    WHERE introduction LIKE '%<%' OR prediction LIKE '%<%'
       OR introduction LIKE '%&amp;%' OR prediction LIKE '%&amp;%'
    UNION ALL
    SELECT 'matchRoundups', COUNT(*)
    FROM match_roundups
    WHERE title LIKE '%<%' OR narrative LIKE '%<%'
       OR title LIKE '%&amp;%' OR narrative LIKE '%&amp;%'
  `;

  const verification = await db.execute(verificationQuery);

  console.log('\nVerification results:');
  let allClean = true;
  for (const row of verification.rows as Array<{ table_name: string; html_count: string }>) {
    const count = parseInt(row.html_count, 10);
    if (count > 0) {
      console.log(`  Warning: ${row.table_name}: ${count} records may still contain HTML`);
      allClean = false;
    } else {
      console.log(`  OK: ${row.table_name}: clean`);
    }
  }

  console.log('\n' + (allClean ? 'Migration complete - all tables clean!' : 'Migration complete - some records may need manual review'));
}

cleanHtmlContent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
