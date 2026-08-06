ALTER TABLE "ai_model_invocations"
  ADD COLUMN IF NOT EXISTS "workflow_id" text;
--> statement-breakpoint
ALTER TABLE "ai_model_invocations"
  ADD COLUMN IF NOT EXISTS "node_id" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_interface_request_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "interface_id" text,
  "invocation_id" text,
  "generation_job_id" text,
  "method" text NOT NULL,
  "url" text NOT NULL,
  "http_status" integer,
  "duration_ms" integer,
  "upstream_request_id" text,
  "request_body" jsonb,
  "response_excerpt" text,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_interface_request_logs_org_created_idx"
  ON "api_interface_request_logs" ("organization_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_interface_request_logs_invocation_idx"
  ON "api_interface_request_logs" ("invocation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_interface_request_logs_generation_job_idx"
  ON "api_interface_request_logs" ("generation_job_id");
