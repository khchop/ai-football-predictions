CREATE TABLE `model_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`model_id` text NOT NULL,
	`predictions_count` integer DEFAULT 0,
	`total_cost` text DEFAULT '0',
	`created_at` text DEFAULT '2026-01-20T13:59:05.700Z',
	`updated_at` text DEFAULT '2026-01-20T13:59:05.700Z'
);
--> statement-breakpoint
DROP INDEX "matches_external_id_unique";--> statement-breakpoint
ALTER TABLE `competitions` ALTER COLUMN "created_at" TO "created_at" text DEFAULT '2026-01-20T13:59:05.700Z';--> statement-breakpoint
CREATE UNIQUE INDEX `matches_external_id_unique` ON `matches` (`external_id`);--> statement-breakpoint
ALTER TABLE `matches` ALTER COLUMN "created_at" TO "created_at" text DEFAULT '2026-01-20T13:59:05.700Z';--> statement-breakpoint
ALTER TABLE `matches` ALTER COLUMN "updated_at" TO "updated_at" text DEFAULT '2026-01-20T13:59:05.700Z';--> statement-breakpoint
ALTER TABLE `models` ALTER COLUMN "created_at" TO "created_at" text DEFAULT '2026-01-20T13:59:05.700Z';--> statement-breakpoint
ALTER TABLE `predictions` ALTER COLUMN "created_at" TO "created_at" text DEFAULT '2026-01-20T13:59:05.700Z';