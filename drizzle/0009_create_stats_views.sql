-- Stats Foundation: Materialized views for aggregated model performance tracking
-- Refresh policy: Run REFRESH MATERIALIZED VIEW CONCURRENTLY every 10 minutes via cron job
-- Data is limited to current season only

-- Materialized view: Overall model statistics across all competitions/seasons
-- Used for leaderboard rankings and model comparison
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_model_stats_overall AS
SELECT
  p.model_id,
  COUNT(*) AS total_matches,
  COALESCE(SUM(p.total_points), 0) AS total_points,
  ROUND(COALESCE(AVG(p.total_points), 0)::numeric, 2) AS avg_points,
  ROUND(
    CASE
      WHEN COUNT(*) > 0 THEN
        (COUNT(*) FILTER (WHERE p.total_points >= 3))::numeric / COUNT(*)
      ELSE 0
    END,
    4
  ) AS win_rate,
  COUNT(*) FILTER (WHERE p.total_points >= 3) AS win_count,
  COUNT(*) FILTER (WHERE p.total_points = 2) AS draw_count,
  COUNT(*) FILTER (WHERE p.total_points <= 1 AND p.total_points IS NOT NULL) AS loss_count
FROM predictions p
INNER JOIN matches m ON p.match_id = m.id
INNER JOIN competitions c ON m.competition_id = c.id
WHERE p.status = 'scored'
  AND c.season = (SELECT season FROM competitions WHERE active = true LIMIT 1)
GROUP BY p.model_id
WITH DATA;

-- Unique index for O(1) lookup by model
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_model_stats_overall_model_id
ON mv_model_stats_overall(model_id);

COMMENT ON MATERIALIZED VIEW mv_model_stats_overall IS 'Aggregated overall model statistics. Refresh: CONCURRENTLY every 10 minutes. Limited to current active season.';

-- Materialized view: Model statistics per competition and season
-- Used for competition-specific leaderboards
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_model_stats_competition AS
SELECT
  p.model_id,
  m.competition_id,
  c.season,
  COUNT(*) AS total_matches,
  COALESCE(SUM(p.total_points), 0) AS total_points,
  ROUND(COALESCE(AVG(p.total_points), 0)::numeric, 2) AS avg_points,
  ROUND(
    CASE
      WHEN COUNT(*) > 0 THEN
        (COUNT(*) FILTER (WHERE p.total_points >= 3))::numeric / COUNT(*)
      ELSE 0
    END,
    4
  ) AS win_rate
FROM predictions p
INNER JOIN matches m ON p.match_id = m.id
INNER JOIN competitions c ON m.competition_id = c.id
WHERE p.status = 'scored'
GROUP BY p.model_id, m.competition_id, c.season
WITH DATA;

-- Unique index for competition-specific lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_model_stats_competition_unique
ON mv_model_stats_competition(model_id, competition_id, season);

COMMENT ON MATERIALIZED VIEW mv_model_stats_competition IS 'Model statistics by competition and season. Refresh: CONCURRENTLY every 10 minutes.';

-- Materialized view: Model statistics per club (home/away split)
-- Used for team-specific performance analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_model_stats_club AS
SELECT
  p.model_id,
  CASE WHEN p.predicted_result = 'H' THEN m.homeTeam ELSE m.awayTeam END AS club_id,
  c.season,
  CASE WHEN p.predicted_result = 'H' THEN true ELSE false END AS is_home,
  COUNT(*) AS total_matches,
  COALESCE(SUM(p.total_points), 0) AS total_points,
  ROUND(COALESCE(AVG(p.total_points), 0)::numeric, 2) AS avg_points,
  ROUND(
    CASE
      WHEN COUNT(*) > 0 THEN
        (COUNT(*) FILTER (WHERE p.total_points >= 3))::numeric / COUNT(*)
      ELSE 0
    END,
    4
  ) AS win_rate
FROM predictions p
INNER JOIN matches m ON p.match_id = m.id
INNER JOIN competitions c ON m.competition_id = c.id
WHERE p.status = 'scored'
GROUP BY p.model_id, club_id, c.season, is_home
WITH DATA;

-- Unique index for club-specific lookups with home/away split
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_model_stats_club_unique
ON mv_model_stats_club(model_id, club_id, season, is_home);

COMMENT ON MATERIALIZED VIEW mv_model_stats_club IS 'Model statistics by club (home/away). Refresh: CONCURRENTLY every 10 minutes.';

-- Composite indexes on source tables for query optimization
-- These improve the performance of materialized view refreshes

-- Index for predictions model + match lookup (used in all MV queries)
CREATE INDEX IF NOT EXISTS idx_predictions_model_match
ON predictions(model_id, match_id);

-- Index for matches competition + season lookup
CREATE INDEX IF NOT EXISTS idx_matches_competition_season
ON matches(competition_id, season);

-- Index for pending match scoring (status + kickoff_at for cron jobs)
CREATE INDEX IF NOT EXISTS idx_matches_status_scheduled
ON matches(status, kickoff_time)
WHERE status = 'scheduled';
