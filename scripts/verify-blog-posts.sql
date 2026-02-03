-- Check what blog posts currently exist
SELECT
  content_type,
  COUNT(*) as count,
  STRING_AGG(DISTINCT LEFT(slug, 30), ', ' ORDER BY LEFT(slug, 30)) as sample_slugs
FROM blog_posts
GROUP BY content_type
ORDER BY content_type;

-- Check if Eredivisie and Super Lig have posts
SELECT
  id,
  title,
  slug,
  competition_id,
  status,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created
FROM blog_posts
WHERE slug ILIKE '%eredivisie%'
   OR slug ILIKE '%super-lig%'
   OR slug ILIKE '%superlig%'
ORDER BY created_at DESC;

-- List all competitions that should have roundups (have finished matches)
-- This query identifies competitions with finished matches
