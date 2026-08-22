ALTER TABLE "platform_settings" ADD COLUMN "maintenance_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "platform_settings" ADD COLUMN "maintenance_message" text;
