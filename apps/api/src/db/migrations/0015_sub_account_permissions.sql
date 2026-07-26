ALTER TABLE "memberships" ADD COLUMN IF NOT EXISTS "permissions" jsonb;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "permissions" jsonb;--> statement-breakpoint
UPDATE "memberships" SET "role" = 'member' WHERE "role" = 'admin';
