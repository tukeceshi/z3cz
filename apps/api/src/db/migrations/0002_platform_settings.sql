CREATE TABLE IF NOT EXISTS "platform_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "site_name" text NOT NULL DEFAULT 'Dafthunk',
  "site_tagline" text NOT NULL DEFAULT 'Build serverless workflows visually.',
  "default_locale" text NOT NULL DEFAULT 'en',
  "support_email" text,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" text REFERENCES "users"("id")
);

INSERT INTO "platform_settings" ("id")
VALUES ('default')
ON CONFLICT ("id") DO NOTHING;
