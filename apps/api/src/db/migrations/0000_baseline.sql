CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"r2_key" text NOT NULL,
	"content_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_triggers" (
	"workflow_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"bot_id" text,
	"provider" text NOT NULL,
	"metadata" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bots" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"encrypted_token" text NOT NULL,
	"token_last_four" text NOT NULL,
	"metadata" text,
	"encrypted_metadata" text,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "databases" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_triggers" (
	"workflow_id" text PRIMARY KEY NOT NULL,
	"email_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"handle" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"execution_id" text NOT NULL,
	"criterion_id" text NOT NULL,
	"workflow_id" text,
	"organization_id" text NOT NULL,
	"user_id" text,
	"sentiment" text NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_criteria" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"question" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inboxes" (
	"id" text PRIMARY KEY NOT NULL,
	"alias" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inboxes_alias_unique" UNIQUE("alias")
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"encrypted_token" text NOT NULL,
	"encrypted_refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"metadata" text,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_user_id_organization_id_pk" PRIMARY KEY("user_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"direction" text NOT NULL,
	"rfc822_message_id" text NOT NULL,
	"in_reply_to" text,
	"references_chain" text,
	"from_email" text NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"snippet" text DEFAULT '' NOT NULL,
	"has_html" boolean DEFAULT false NOT NULL,
	"has_text" boolean DEFAULT false NOT NULL,
	"attachment_count" integer DEFAULT 0 NOT NULL,
	"raw_r2_key" text NOT NULL,
	"author_admin_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_rfc822_message_id_unique" UNIQUE("rfc822_message_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"compute_credits" integer DEFAULT 1000 NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_status" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"overage_limit" integer,
	"unlimited_usage" boolean DEFAULT false NOT NULL,
	"credits_exhausted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queue_triggers" (
	"workflow_id" text PRIMARY KEY NOT NULL,
	"queue_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queues" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_triggers" (
	"workflow_id" text PRIMARY KEY NOT NULL,
	"schedule_expression" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schemas" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"fields" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secrets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"encrypted_value" text NOT NULL,
	"organization_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thread_reads" (
	"thread_id" text NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp with time zone NOT NULL,
	CONSTRAINT "thread_reads_thread_id_user_id_pk" PRIMARY KEY("thread_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" text PRIMARY KEY NOT NULL,
	"inbox_id" text NOT NULL,
	"subject" text NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text,
	"user_id" text,
	"organization_id" text,
	"archived_at" timestamp with time zone,
	"last_message_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"github_id" text,
	"google_id" text,
	"avatar_url" text,
	"organization_id" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"developer_mode" boolean DEFAULT false NOT NULL,
	"tour_completed" timestamp with time zone,
	"workflow_created" timestamp with time zone,
	"workflow_executed" timestamp with time zone,
	"workflow_executed_ok" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"runtime" text DEFAULT 'workflow' NOT NULL,
	"organization_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_triggers" ADD CONSTRAINT "bot_triggers_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_triggers" ADD CONSTRAINT "bot_triggers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_triggers" ADD CONSTRAINT "bot_triggers_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bots" ADD CONSTRAINT "bots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "databases" ADD CONSTRAINT "databases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_triggers" ADD CONSTRAINT "email_triggers_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_triggers" ADD CONSTRAINT "email_triggers_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_criterion_id_feedback_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."feedback_criteria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_criteria" ADD CONSTRAINT "feedback_criteria_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_criteria" ADD CONSTRAINT "feedback_criteria_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_admin_user_id_users_id_fk" FOREIGN KEY ("author_admin_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_triggers" ADD CONSTRAINT "queue_triggers_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_triggers" ADD CONSTRAINT "queue_triggers_queue_id_queues_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."queues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queues" ADD CONSTRAINT "queues_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_triggers" ADD CONSTRAINT "scheduled_triggers_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schemas" ADD CONSTRAINT "schemas_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_reads" ADD CONSTRAINT "thread_reads_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_reads" ADD CONSTRAINT "thread_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_inbox_id_inboxes_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."inboxes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_name_idx" ON "api_keys" USING btree ("name");--> statement-breakpoint
CREATE INDEX "api_keys_organization_id_idx" ON "api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "api_keys_created_at_idx" ON "api_keys" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "attachments_message_id_idx" ON "attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "attachments_content_id_idx" ON "attachments" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "bot_triggers_organization_id_idx" ON "bot_triggers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bot_triggers_bot_id_idx" ON "bot_triggers" USING btree ("bot_id");--> statement-breakpoint
CREATE INDEX "bot_triggers_provider_idx" ON "bot_triggers" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "bot_triggers_active_idx" ON "bot_triggers" USING btree ("active");--> statement-breakpoint
CREATE INDEX "bot_triggers_created_at_idx" ON "bot_triggers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bot_triggers_updated_at_idx" ON "bot_triggers" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "bots_name_idx" ON "bots" USING btree ("name");--> statement-breakpoint
CREATE INDEX "bots_provider_idx" ON "bots" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "bots_organization_id_idx" ON "bots" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bots_created_at_idx" ON "bots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "databases_name_idx" ON "databases" USING btree ("name");--> statement-breakpoint
CREATE INDEX "databases_organization_id_idx" ON "databases" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "databases_created_at_idx" ON "databases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "datasets_name_idx" ON "datasets" USING btree ("name");--> statement-breakpoint
CREATE INDEX "datasets_organization_id_idx" ON "datasets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "datasets_created_at_idx" ON "datasets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_triggers_workflow_id_idx" ON "email_triggers" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "email_triggers_email_id_idx" ON "email_triggers" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "email_triggers_active_idx" ON "email_triggers" USING btree ("active");--> statement-breakpoint
CREATE INDEX "email_triggers_created_at_idx" ON "email_triggers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_triggers_updated_at_idx" ON "email_triggers" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "emails_name_idx" ON "emails" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "emails_handle_unique_idx" ON "emails" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "emails_organization_id_idx" ON "emails" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "emails_created_at_idx" ON "emails" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feedback_execution_id_idx" ON "feedback" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "feedback_criterion_id_idx" ON "feedback" USING btree ("criterion_id");--> statement-breakpoint
CREATE INDEX "feedback_workflow_id_idx" ON "feedback" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "feedback_organization_id_idx" ON "feedback" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "feedback_user_id_idx" ON "feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_sentiment_idx" ON "feedback" USING btree ("sentiment");--> statement-breakpoint
CREATE INDEX "feedback_created_at_idx" ON "feedback" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_execution_id_criterion_id_unique" ON "feedback" USING btree ("execution_id","criterion_id");--> statement-breakpoint
CREATE INDEX "feedback_criteria_workflow_id_idx" ON "feedback_criteria" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "feedback_criteria_organization_id_idx" ON "feedback_criteria" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "feedback_criteria_display_order_idx" ON "feedback_criteria" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "inboxes_alias_idx" ON "inboxes" USING btree ("alias");--> statement-breakpoint
CREATE INDEX "integrations_name_idx" ON "integrations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "integrations_provider_idx" ON "integrations" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "integrations_status_idx" ON "integrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "integrations_organization_id_idx" ON "integrations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integrations_created_at_idx" ON "integrations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_organization_id_name_provider_unique_idx" ON "integrations" USING btree ("organization_id","name","provider");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitations_organization_id_idx" ON "invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitations_status_idx" ON "invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invitations_invited_by_idx" ON "invitations" USING btree ("invited_by");--> statement-breakpoint
CREATE INDEX "invitations_expires_at_idx" ON "invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "invitations_created_at_idx" ON "invitations" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_organization_id_email_status_unique_idx" ON "invitations" USING btree ("organization_id","email","status");--> statement-breakpoint
CREATE INDEX "memberships_role_idx" ON "memberships" USING btree ("role");--> statement-breakpoint
CREATE INDEX "memberships_user_id_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_organization_id_idx" ON "memberships" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "memberships_created_at_idx" ON "memberships" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "messages_thread_id_idx" ON "messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "messages_rfc822_message_id_idx" ON "messages" USING btree ("rfc822_message_id");--> statement-breakpoint
CREATE INDEX "messages_direction_idx" ON "messages" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "organizations_name_idx" ON "organizations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "organizations_created_at_idx" ON "organizations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "organizations_stripe_customer_id_idx" ON "organizations" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "organizations_stripe_subscription_id_idx" ON "organizations" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "organizations_subscription_status_idx" ON "organizations" USING btree ("subscription_status");--> statement-breakpoint
CREATE INDEX "organizations_credits_exhausted_idx" ON "organizations" USING btree ("credits_exhausted");--> statement-breakpoint
CREATE INDEX "queue_triggers_workflow_id_idx" ON "queue_triggers" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "queue_triggers_queue_id_idx" ON "queue_triggers" USING btree ("queue_id");--> statement-breakpoint
CREATE INDEX "queue_triggers_active_idx" ON "queue_triggers" USING btree ("active");--> statement-breakpoint
CREATE INDEX "queue_triggers_created_at_idx" ON "queue_triggers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "queue_triggers_updated_at_idx" ON "queue_triggers" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "queues_name_idx" ON "queues" USING btree ("name");--> statement-breakpoint
CREATE INDEX "queues_organization_id_idx" ON "queues" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "queues_created_at_idx" ON "queues" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scheduled_triggers_workflow_id_idx" ON "scheduled_triggers" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "scheduled_triggers_active_idx" ON "scheduled_triggers" USING btree ("active");--> statement-breakpoint
CREATE INDEX "scheduled_triggers_created_at_idx" ON "scheduled_triggers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scheduled_triggers_updated_at_idx" ON "scheduled_triggers" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "schemas_name_idx" ON "schemas" USING btree ("name");--> statement-breakpoint
CREATE INDEX "schemas_organization_id_idx" ON "schemas" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "schemas_created_at_idx" ON "schemas" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "secrets_name_idx" ON "secrets" USING btree ("name");--> statement-breakpoint
CREATE INDEX "secrets_organization_id_idx" ON "secrets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "secrets_created_at_idx" ON "secrets" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "secrets_organization_id_name_unique_idx" ON "secrets" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "thread_reads_user_id_idx" ON "thread_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "thread_reads_thread_id_idx" ON "thread_reads" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "threads_inbox_id_idx" ON "threads" USING btree ("inbox_id");--> statement-breakpoint
CREATE INDEX "threads_archived_at_idx" ON "threads" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "threads_last_message_at_idx" ON "threads" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "threads_from_email_idx" ON "threads" USING btree ("from_email");--> statement-breakpoint
CREATE INDEX "threads_user_id_idx" ON "threads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "threads_organization_id_idx" ON "threads" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "threads_created_at_idx" ON "threads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_github_id_idx" ON "users" USING btree ("github_id");--> statement-breakpoint
CREATE INDEX "users_google_id_idx" ON "users" USING btree ("google_id");--> statement-breakpoint
CREATE INDEX "users_organization_id_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_name_idx" ON "users" USING btree ("name");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_developer_mode_idx" ON "users" USING btree ("developer_mode");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "workflows_name_idx" ON "workflows" USING btree ("name");--> statement-breakpoint
CREATE INDEX "workflows_trigger_idx" ON "workflows" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "workflows_runtime_idx" ON "workflows" USING btree ("runtime");--> statement-breakpoint
CREATE INDEX "workflows_organization_id_idx" ON "workflows" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "workflows_enabled_idx" ON "workflows" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "workflows_created_at_idx" ON "workflows" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "workflows_updated_at_idx" ON "workflows" USING btree ("updated_at");