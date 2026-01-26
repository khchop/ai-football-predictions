CREATE TABLE `match_analysis` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`favorite_team_id` integer,
	`favorite_team_name` text,
	`home_win_pct` integer,
	`draw_pct` integer,
	`away_win_pct` integer,
	`advice` text,
	`form_home_pct` integer,
	`form_away_pct` integer,
	`attack_home_pct` integer,
	`attack_away_pct` integer,
	`defense_home_pct` integer,
	`defense_away_pct` integer,
	`home_team_form` text,
	`away_team_form` text,
	`home_goals_scored` integer,
	`home_goals_conceded` integer,
	`away_goals_scored` integer,
	`away_goals_conceded` integer,
	`odds_home` text,
	`odds_draw` text,
	`odds_away` text,
	`likely_scores` text,
	`home_injuries_count` integer DEFAULT 0,
	`away_injuries_count` integer DEFAULT 0,
	`key_injuries` text,
	`home_formation` text,
	`away_formation` text,
	`home_starting_xi` text,
	`away_starting_xi` text,
	`home_coach` text,
	`away_coach` text,
	`lineups_available` integer DEFAULT false,
	`lineups_updated_at` text,
	`raw_predictions_data` text,
	`raw_injuries_data` text,
	`raw_odds_data` text,
	`raw_lineups_data` text,
	`analysis_updated_at` text,
	`created_at` text DEFAULT '2026-01-20T14:59:35.468Z',
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
DROP INDEX "matches_external_id_unique";--> statement-breakpoint
ALTER TABLE `competitions` ALTER COLUMN "created_at" TO "created_at" text DEFAULT '2026-01-20T14:59:35.467Z';--> statement-breakpoint
CREATE UNIQUE INDEX `matches_external_id_unique` ON `matches` (`external_id`);--> statement-breakpoint
ALTER TABLE `matches` ALTER COLUMN "created_at" TO "created_at" text DEFAULT '2026-01-20T14:59:35.468Z';--> statement-breakpoint
ALTER TABLE `matches` ALTER COLUMN "updated_at" TO "updated_at" text DEFAULT '2026-01-20T14:59:35.468Z';--> statement-breakpoint
ALTER TABLE `matches` ADD `is_upset` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `model_usage` ALTER COLUMN "created_at" TO "created_at" text DEFAULT '2026-01-20T14:59:35.468Z';--> statement-breakpoint
ALTER TABLE `model_usage` ALTER COLUMN "updated_at" TO "updated_at" text DEFAULT '2026-01-20T14:59:35.468Z';--> statement-breakpoint
ALTER TABLE `models` ALTER COLUMN "created_at" TO "created_at" text DEFAULT '2026-01-20T14:59:35.468Z';--> statement-breakpoint
ALTER TABLE `predictions` ALTER COLUMN "created_at" TO "created_at" text DEFAULT '2026-01-20T14:59:35.468Z';--> statement-breakpoint
ALTER TABLE `predictions` ADD `points_exact_score` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `predictions` ADD `points_result` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `predictions` ADD `points_goal_diff` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `predictions` ADD `points_over_under` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `predictions` ADD `points_btts` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `predictions` ADD `points_upset_bonus` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `predictions` ADD `points_total` integer DEFAULT 0;