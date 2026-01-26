CREATE TABLE `competitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`api_football_id` integer NOT NULL,
	`season` integer NOT NULL,
	`active` integer DEFAULT true,
	`created_at` text DEFAULT '2026-01-20T13:21:30.183Z'
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`competition_id` text NOT NULL,
	`home_team` text NOT NULL,
	`away_team` text NOT NULL,
	`home_team_logo` text,
	`away_team_logo` text,
	`kickoff_time` text NOT NULL,
	`home_score` integer,
	`away_score` integer,
	`status` text DEFAULT 'scheduled',
	`round` text,
	`venue` text,
	`created_at` text DEFAULT '2026-01-20T13:21:30.184Z',
	`updated_at` text DEFAULT '2026-01-20T13:21:30.184Z',
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_external_id_unique` ON `matches` (`external_id`);--> statement-breakpoint
CREATE TABLE `models` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`model_name` text NOT NULL,
	`display_name` text NOT NULL,
	`is_premium` integer DEFAULT false,
	`active` integer DEFAULT true,
	`created_at` text DEFAULT '2026-01-20T13:21:30.184Z'
);
--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`model_id` text NOT NULL,
	`predicted_home_score` integer NOT NULL,
	`predicted_away_score` integer NOT NULL,
	`confidence` text,
	`raw_response` text,
	`processing_time_ms` integer,
	`created_at` text DEFAULT '2026-01-20T13:21:30.184Z',
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE no action
);
