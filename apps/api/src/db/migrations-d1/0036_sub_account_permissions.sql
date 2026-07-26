ALTER TABLE "memberships" ADD COLUMN "permissions" text;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "permissions" text;--> statement-breakpoint
UPDATE "memberships" SET "role" = 'member' WHERE "role" = 'admin';
