ALTER TABLE "api_interface_request_logs"
  ADD COLUMN IF NOT EXISTS "operation" text;
