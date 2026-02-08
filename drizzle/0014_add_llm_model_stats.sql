-- Migration: Add llm_model_stats table for per-model daily health metrics
-- Phase 58: Observability & Monitoring

CREATE TABLE IF NOT EXISTS "llm_model_stats" (
  "id" text PRIMARY KEY NOT NULL,
  "date" text NOT NULL,
  "model_id" text NOT NULL REFERENCES "models"("id"),
  "success_count" integer DEFAULT 0,
  "failure_count" integer DEFAULT 0,
  "total_attempts" integer DEFAULT 0,
  "success_rate" double precision DEFAULT 0,
  "timeout_errors" integer DEFAULT 0,
  "parse_errors" integer DEFAULT 0,
  "api_errors" integer DEFAULT 0,
  "language_errors" integer DEFAULT 0,
  "other_errors" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "llm_model_stats_date_model_unique" UNIQUE("date", "model_id")
);

CREATE INDEX IF NOT EXISTS "idx_llm_model_stats_date" ON "llm_model_stats" ("date");
CREATE INDEX IF NOT EXISTS "idx_llm_model_stats_model_id" ON "llm_model_stats" ("model_id");
CREATE INDEX IF NOT EXISTS "idx_llm_model_stats_date_model" ON "llm_model_stats" ("date", "model_id");
