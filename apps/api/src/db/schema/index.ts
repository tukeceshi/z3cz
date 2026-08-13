import type { PlatformAiModelParameterRules } from "@dafthunk/types";
import type { GenerationJobResultJson } from "@dafthunk/types";
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * ENUMS & CONSTANTS
 */

// User permission roles
export const UserRole = {
  USER: "user",
  ADMIN: "admin",
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

// Organization member roles
export const OrganizationRole = {
  MEMBER: "member",
  OWNER: "owner",
} as const;

export type OrganizationRoleType =
  (typeof OrganizationRole)[keyof typeof OrganizationRole];

// Authentication providers
export const Provider = {
  GITHUB: "github",
  GOOGLE: "google",
} as const;

export type ProviderType = (typeof Provider)[keyof typeof Provider];

// Workflow trigger types
export const WorkflowTriggerType = {
  MANUAL: "manual",
  HTTP_WEBHOOK: "http_webhook",
  HTTP_REQUEST: "http_request",
  FORM_WEBHOOK: "form_webhook",
  FORM_REQUEST: "form_request",
  EMAIL_MESSAGE: "email_message",
  SCHEDULED: "scheduled",
  QUEUE_MESSAGE: "queue_message",
  DISCORD_EVENT: "discord_event",
  TELEGRAM_EVENT: "telegram_event",
  WHATSAPP_EVENT: "whatsapp_event",
  SLACK_EVENT: "slack_event",
} as const;

export type WorkflowTriggerTypeType =
  (typeof WorkflowTriggerType)[keyof typeof WorkflowTriggerType];

// Workflow runtime types
export const WorkflowRuntime = {
  WORKER: "worker",
  WORKFLOW: "workflow",
} as const;

export type WorkflowRuntimeType =
  (typeof WorkflowRuntime)[keyof typeof WorkflowRuntime];

// Bot provider types
export const BotProvider = {
  DISCORD: "discord",
  TELEGRAM: "telegram",
  WHATSAPP: "whatsapp",
  SLACK: "slack",
} as const;

export type BotProviderType = (typeof BotProvider)[keyof typeof BotProvider];

// Integration provider types
export const IntegrationProvider = {
  GOOGLE_MAIL: "google-mail",
  GOOGLE_CALENDAR: "google-calendar",
  DISCORD: "discord",
  GITHUB: "github",
  REDDIT: "reddit",
  LINKEDIN: "linkedin",
  X: "x",
  WORDPRESS: "wordpress",
} as const;

export type IntegrationProviderType =
  (typeof IntegrationProvider)[keyof typeof IntegrationProvider];

// Integration status types
export const IntegrationStatus = {
  ACTIVE: "active",
  EXPIRED: "expired",
  REVOKED: "revoked",
} as const;

export type IntegrationStatusType =
  (typeof IntegrationStatus)[keyof typeof IntegrationStatus];

// Invitation status types
export const InvitationStatus = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  DECLINED: "declined",
  EXPIRED: "expired",
} as const;

export type InvitationStatusType =
  (typeof InvitationStatus)[keyof typeof InvitationStatus];

// Subscription status types (Stripe)
export const SubscriptionStatus = {
  ACTIVE: "active",
  CANCELED: "canceled",
  PAST_DUE: "past_due",
  UNPAID: "unpaid",
  TRIALING: "trialing",
} as const;

export type SubscriptionStatusType =
  (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

// Inbox message direction
export const MessageDirection = {
  INBOUND: "inbound",
  OUTBOUND: "outbound",
} as const;

export type MessageDirectionType =
  (typeof MessageDirection)[keyof typeof MessageDirection];

/**
 * REUSABLE COLUMNS
 */

const createCreatedAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow();

const createUpdatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow();

/**
 * SCHEMA DEFINITION
 */

// Organizations - Collaborative workspaces for teams
export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    computeCredits: integer("compute_credits").notNull().default(1000),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    subscriptionStatus: text(
      "subscription_status"
    ).$type<SubscriptionStatusType>(),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: "date" }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: "date" }),
    overageLimit: integer("overage_limit"), // null = unlimited
    unlimitedUsage: boolean("unlimited_usage")
      .notNull()
      .default(false),
    creditsExhausted: boolean("credits_exhausted")
      .notNull()
      .default(false),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("organizations_name_idx").on(table.name),
    index("organizations_created_at_idx").on(table.createdAt),
    index("organizations_stripe_customer_id_idx").on(table.stripeCustomerId),
    index("organizations_stripe_subscription_id_idx").on(
      table.stripeSubscriptionId
    ),
    index("organizations_subscription_status_idx").on(table.subscriptionStatus),
    index("organizations_credits_exhausted_idx").on(table.creditsExhausted),
  ]
);

// Users - System users with authentication and subscription details
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").unique(),
    githubId: text("github_id").unique(),
    googleId: text("google_id").unique(),
    passwordHash: text("password_hash"),
    avatarUrl: text("avatar_url"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role").$type<UserRoleType>().notNull().default(UserRole.USER),
    developerMode: boolean("developer_mode")
      .notNull()
      .default(false),
    // Onboarding stage timestamps. Null until the user first performs that
    // milestone, then stamped with CURRENT_TIMESTAMP. Powers the admin
    // onboarding funnel; tour_completed replaces the prior boolean column.
    tourCompleted: timestamp("tour_completed", { withTimezone: true, mode: "date" }),
    workflowCreated: timestamp("workflow_created", { withTimezone: true, mode: "date" }),
    workflowExecuted: timestamp("workflow_executed", { withTimezone: true, mode: "date" }),
    workflowExecutedOk: timestamp("workflow_executed_ok", { withTimezone: true, mode: "date" }),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("users_github_id_idx").on(table.githubId),
    index("users_google_id_idx").on(table.googleId),
    index("users_organization_id_idx").on(table.organizationId),
    index("users_email_idx").on(table.email),
    index("users_name_idx").on(table.name),
    index("users_role_idx").on(table.role),
    index("users_developer_mode_idx").on(table.developerMode),
    index("users_created_at_idx").on(table.createdAt),
  ]
);

export const PLATFORM_SETTINGS_ID = "default";

export const WORKFLOW_SCHEME_OMNIPOTENT_ID = "omnipotent";

export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey(),
  siteName: text("site_name").notNull().default("z3cz.com"),
  siteTagline: text("site_tagline")
    .notNull()
    .default("Build serverless workflows visually."),
  defaultLocale: text("default_locale").notNull().default("en"),
  supportEmail: text("support_email"),
  featureConfig: text("feature_config"),
  authConfig: text("auth_config"),
  newUserTourEnabled: boolean("new_user_tour_enabled").notNull().default(false),
  homepageMode: text("homepage_mode")
    .$type<"console" | "marketing">()
    .notNull()
    .default("console"),
  wsBootstrapEnabled: boolean("ws_bootstrap_enabled").notNull().default(false),
  bootstrapConfig: text("bootstrap_config"),
  legalConfig: text("legal_config"),
  persistWorkerPoolEnabled: boolean("persist_worker_pool_enabled")
    .notNull()
    .default(false),
  updatedAt: createUpdatedAt(),
  updatedBy: text("updated_by").references(() => users.id),
});

// Memberships - Join table for users and organizations (many-to-many)
export const memberships = pgTable(
  "memberships",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role")
      .$type<OrganizationRoleType>()
      .notNull()
      .default(OrganizationRole.MEMBER),
    permissions: jsonb("permissions").$type<Record<string, unknown> | null>(),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.organizationId] }),
    index("memberships_role_idx").on(table.role),
    index("memberships_user_id_idx").on(table.userId),
    index("memberships_organization_id_idx").on(table.organizationId),
    index("memberships_created_at_idx").on(table.createdAt),
  ]
);

// API Keys - Authentication keys associated with organizations
export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    key: text("key").notNull().unique(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("api_keys_name_idx").on(table.name),
    index("api_keys_organization_id_idx").on(table.organizationId),
    index("api_keys_created_at_idx").on(table.createdAt),
  ]
);

// Format transform templates — admin-configured standard-to-upstream body transforms
export const formatTransformTemplates = pgTable(
  "format_transform_templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    provider: text("provider").notNull(),
    scope: text("scope").notNull().default("platform"),
    upstreamParams: jsonb("upstream_params").notNull().default([]),
    paramMappings: jsonb("param_mappings").notNull().default([]),
    lockedResolution: text("locked_resolution"),
    supportsTaskCancel: boolean("supports_task_cancel").notNull().default(false),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
    updatedBy: text("updated_by").references(() => users.id),
  },
  (table) => [
    index("format_transform_templates_enabled_idx").on(table.enabled),
    index("format_transform_templates_scope_idx").on(table.scope),
  ]
);

// Workflow schemes (方案) — platform-level node/trigger/runtime catalogs
export const workflowSchemes = pgTable(
  "workflow_schemes",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"),
    allowedTriggers: text("allowed_triggers").notNull(),
    allowedRuntimes: text("allowed_runtimes").notNull(),
    includeTags: text("include_tags"),
    includeNodeTypes: text("include_node_types"),
    excludeNodeTypes: text("exclude_node_types"),
    alwaysIncludeNodeTypes: text("always_include_node_types"),
    isDefault: boolean("is_default").notNull().default(false),
    isSystem: boolean("is_system").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
    updatedBy: text("updated_by").references(() => users.id),
  },
  (table) => [
    index("workflow_schemes_enabled_idx").on(table.enabled),
    index("workflow_schemes_sort_order_idx").on(table.sortOrder),
    index("workflow_schemes_is_default_idx").on(table.isDefault),
  ]
);

export const organizationAiInterfaces = pgTable(
  "organization_ai_interfaces",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Legacy; unused after template retirement. Kept nullable for old rows. */
    templateId: text("template_id"),
    templateVersion: integer("template_version"),
    name: text("name").notNull(),
    provider: text("provider").notNull(),
    baseUrl: text("base_url"),
    selectedModel: text("selected_model"),
    apiKeyEncrypted: text("api_key_encrypted").notNull(),
    metadata: text("metadata"),
    volcanoSetupStatus: text("volcano_setup_status"),
    enabled: boolean("enabled").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("organization_ai_interfaces_org_provider_idx").on(
      table.organizationId,
      table.provider
    ),
    index("organization_ai_interfaces_template_id_idx").on(table.templateId),
  ]
);

export const aiInterfaceCreateIdempotency = pgTable(
  "ai_interface_create_idempotency",
  {
    key: text("key").primaryKey(),
    organizationId: text("organization_id").notNull(),
    interfaceId: text("interface_id").notNull(),
    createdAt: createCreatedAt(),
  },
  (table) => [
    index("ai_interface_create_idempotency_org_idx").on(table.organizationId),
  ]
);

export const platformAiModels = pgTable("platform_ai_models", {
  canonicalId: text("canonical_id").primaryKey(),
  displayName: text("display_name").notNull(),
  modality: text("modality").notNull(),
  platformEnabled: boolean("platform_enabled").notNull().default(true),
  parameterRules: jsonb("parameter_rules")
    .$type<PlatformAiModelParameterRules>()
    .notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  brandIcon: text("brand_icon"),
  description: text("description").notNull().default(""),
  createdAt: createCreatedAt(),
  updatedAt: createUpdatedAt(),
});

export const platformAiModelChannels = pgTable(
  "platform_ai_model_channels",
  {
    canonicalId: text("canonical_id")
      .notNull()
      .references(() => platformAiModels.canonicalId, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    presetId: text("preset_id").notNull(),
    upstreamModelId: text("upstream_model_id").notNull(),
    channelEnabled: boolean("channel_enabled").notNull().default(true),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.canonicalId, table.channel] }),
  })
);

export const aiModelInvocations = pgTable(
  "ai_model_invocations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    canonicalId: text("canonical_id").notNull(),
    displayName: text("display_name").notNull(),
    interfaceId: text("interface_id"),
    interfaceName: text("interface_name"),
    promptExcerpt: text("prompt_excerpt").notNull().default(""),
    content: text("content").notNull().default(""),
    source: text("source").notNull(),
    status: text("status").notNull(),
    error: text("error"),
    generationJobId: text("generation_job_id"),
    workflowId: text("workflow_id"),
    nodeId: text("node_id"),
    createdAt: createCreatedAt(),
  },
  (table) => [
    index("ai_model_invocations_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),
    index("ai_model_invocations_generation_job_idx").on(
      table.generationJobId
    ),
  ]
);

/** Upstream AI interface HTTP calls — correlate via invocation_id / generation_job_id. */
export const apiInterfaceRequestLogs = pgTable(
  "api_interface_request_logs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    interfaceId: text("interface_id"),
    invocationId: text("invocation_id"),
    generationJobId: text("generation_job_id"),
    operation: text("operation"),
    method: text("method").notNull(),
    url: text("url").notNull(),
    httpStatus: integer("http_status"),
    durationMs: integer("duration_ms"),
    upstreamRequestId: text("upstream_request_id"),
    requestBody: jsonb("request_body").$type<Record<string, unknown> | null>(),
    responseExcerpt: text("response_excerpt"),
    error: text("error"),
    createdAt: createCreatedAt(),
  },
  (table) => [
    index("api_interface_request_logs_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),
    index("api_interface_request_logs_invocation_idx").on(table.invocationId),
    index("api_interface_request_logs_generation_job_idx").on(
      table.generationJobId
    ),
  ]
);

export const organizationCloudStorageHealth = pgTable(
  "organization_cloud_storage_health",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organizations.id, { onDelete: "cascade" }),
    interfaceId: text("interface_id").notNull(),
    status: text("status").notNull(),
    reason: text("reason"),
    message: text("message"),
    bucket: text("bucket").notNull(),
    region: text("region").notNull(),
    consecutiveFailureCount: integer("consecutive_failure_count")
      .notNull()
      .default(0),
    checkedAt: timestamp("checked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("organization_cloud_storage_health_status_checked_idx").on(
      table.status,
      table.checkedAt
    ),
  ]
);

export const persistWorkers = pgTable(
  "persist_workers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    secretHash: text("secret_hash").notNull(),
    maxConcurrentJobs: integer("max_concurrent_jobs").notNull().default(1),
    activeJobCount: integer("active_job_count").notNull().default(0),
    host: text("host"),
    sshPort: integer("ssh_port").notNull().default(22),
    sshUsername: text("ssh_username"),
    deployStatus: text("deploy_status").notNull().default("manual"),
    deployError: text("deploy_error"),
    lastDeployAt: timestamp("last_deploy_at", { withTimezone: true }),
    initializedAt: timestamp("initialized_at", { withTimezone: true }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
    updatedBy: text("updated_by").references(() => users.id),
  },
  (table) => [index("persist_workers_enabled_idx").on(table.enabled)]
);

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    workflowId: text("workflow_id"),
    nodeId: text("node_id"),
    modality: text("modality").notNull(),
    status: text("status").notNull(),
    upstreamTaskId: text("upstream_task_id"),
    modelCanonicalId: text("model_canonical_id").notNull(),
    interfaceId: text("interface_id").notNull(),
    failureReason: text("failure_reason"),
    healthReason: text("health_reason"),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    resultJson: jsonb("result_json").$type<GenerationJobResultJson>(),
    clientRequestId: text("client_request_id"),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("generation_jobs_org_status_idx").on(
      table.organizationId,
      table.status
    ),
    index("generation_jobs_org_upstream_task_idx").on(
      table.organizationId,
      table.upstreamTaskId
    ),
  ]
);

export const mediaResources = pgTable(
  "media_resources",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().$type<"cloud" | "local" | "ephemeral">(),
    mimeType: text("mime_type").notNull(),
    storageKey: text("storage_key"),
    upstreamUrl: text("upstream_url"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    contentSha256: text("content_sha256"),
    createdAt: createCreatedAt(),
  },
  (table) => [index("media_resources_organization_id_idx").on(table.organizationId)]
);

// Workflows - Workflow definitions created and edited by users
// Note: Full workflow data is stored in R2, only metadata is in the database
export const workflowFolders = pgTable(
  "workflow_folders",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    coverObjectId: text("cover_object_id"),
    coverMimeType: text("cover_mime_type"),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("workflow_folders_organization_id_idx").on(table.organizationId),
    index("workflow_folders_updated_at_idx").on(table.updatedAt),
  ]
);

export const workflows = pgTable(
  "workflows",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    schemeId: text("scheme_id")
      .notNull()
      .default(WORKFLOW_SCHEME_OMNIPOTENT_ID)
      .references(() => workflowSchemes.id),
    trigger: text("trigger")
      .$type<WorkflowTriggerTypeType>()
      .notNull()
      .default(WorkflowTriggerType.MANUAL),
    runtime: text("runtime")
      .$type<WorkflowRuntimeType>()
      .notNull()
      .default(WorkflowRuntime.WORKFLOW),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    folderId: text("folder_id").references(() => workflowFolders.id, {
      onDelete: "set null",
    }),
    coverObjectId: text("cover_object_id"),
    coverMimeType: text("cover_mime_type"),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("workflows_name_idx").on(table.name),
    index("workflows_scheme_id_idx").on(table.schemeId),
    index("workflows_trigger_idx").on(table.trigger),
    index("workflows_runtime_idx").on(table.runtime),
    index("workflows_organization_id_idx").on(table.organizationId),
    index("workflows_folder_id_idx").on(table.folderId),
    index("workflows_created_at_idx").on(table.createdAt),
    index("workflows_updated_at_idx").on(table.updatedAt),
  ]
);

// Scheduled Triggers - Scheduled triggers for workflows
export const scheduledTriggers = pgTable(
  "scheduled_triggers",
  {
    workflowId: text("workflow_id")
      .primaryKey()
      .references(() => workflows.id, { onDelete: "cascade" }),
    scheduleExpression: text("schedule_expression").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("scheduled_triggers_workflow_id_idx").on(table.workflowId),
    index("scheduled_triggers_active_idx").on(table.active),
    index("scheduled_triggers_created_at_idx").on(table.createdAt),
    index("scheduled_triggers_updated_at_idx").on(table.updatedAt),
  ]
);

// Datasets - Data collections associated with organizations
export const datasets = pgTable(
  "datasets",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("datasets_name_idx").on(table.name),
    index("datasets_organization_id_idx").on(table.organizationId),
    index("datasets_created_at_idx").on(table.createdAt),
  ]
);

// Execution feedback sentiment types
export const FeedbackSentiment = {
  POSITIVE: "positive",
  NEGATIVE: "negative",
} as const;

export type FeedbackSentimentType =
  (typeof FeedbackSentiment)[keyof typeof FeedbackSentiment];

// Feedback Criteria - Evaluation questions per workflow
export const feedbackCriteria = pgTable(
  "feedback_criteria",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    description: text("description"),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("feedback_criteria_workflow_id_idx").on(table.workflowId),
    index("feedback_criteria_organization_id_idx").on(table.organizationId),
    index("feedback_criteria_display_order_idx").on(table.displayOrder),
  ]
);

// Feedback - User feedback on workflow executions (per criterion)
export const feedback = pgTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    executionId: text("execution_id").notNull(),
    criterionId: text("criterion_id")
      .notNull()
      .references(() => feedbackCriteria.id, { onDelete: "cascade" }),
    workflowId: text("workflow_id").references(() => workflows.id, {
      onDelete: "cascade",
    }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    sentiment: text("sentiment").$type<FeedbackSentimentType>().notNull(),
    comment: text("comment"),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("feedback_execution_id_idx").on(table.executionId),
    index("feedback_criterion_id_idx").on(table.criterionId),
    index("feedback_workflow_id_idx").on(table.workflowId),
    index("feedback_organization_id_idx").on(table.organizationId),
    index("feedback_user_id_idx").on(table.userId),
    index("feedback_sentiment_idx").on(table.sentiment),
    index("feedback_created_at_idx").on(table.createdAt),
    // One feedback per execution per criterion
    uniqueIndex("feedback_execution_id_criterion_id_unique").on(
      table.executionId,
      table.criterionId
    ),
  ]
);

// Queues - Message queues associated with organizations
export const queues = pgTable(
  "queues",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("queues_name_idx").on(table.name),
    index("queues_organization_id_idx").on(table.organizationId),
    index("queues_created_at_idx").on(table.createdAt),
  ]
);

// Databases - Postgres-backed user databases associated with organizations
export const databases = pgTable(
  "databases",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("databases_name_idx").on(table.name),
    index("databases_organization_id_idx").on(table.organizationId),
    index("databases_created_at_idx").on(table.createdAt),
  ]
);

// Schemas - User-defined record schemas for validation
export const schemas = pgTable(
  "schemas",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    fields: text("fields").notNull(), // JSON string of Field[]
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("schemas_name_idx").on(table.name),
    index("schemas_organization_id_idx").on(table.organizationId),
    index("schemas_created_at_idx").on(table.createdAt),
  ]
);

export type SchemaInsert = typeof schemas.$inferInsert;
export type SchemaRow = typeof schemas.$inferSelect;

// Queue Triggers - Message queue triggers for workflows
export const queueTriggers = pgTable(
  "queue_triggers",
  {
    workflowId: text("workflow_id")
      .primaryKey()
      .references(() => workflows.id, { onDelete: "cascade" }),
    queueId: text("queue_id")
      .notNull()
      .references(() => queues.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("queue_triggers_workflow_id_idx").on(table.workflowId),
    index("queue_triggers_queue_id_idx").on(table.queueId),
    index("queue_triggers_active_idx").on(table.active),
    index("queue_triggers_created_at_idx").on(table.createdAt),
    index("queue_triggers_updated_at_idx").on(table.updatedAt),
  ]
);

// Emails - Emails associated with organizations
export const emails = pgTable(
  "emails",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    handle: text("handle").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("emails_name_idx").on(table.name),
    uniqueIndex("emails_handle_unique_idx").on(table.handle),
    index("emails_organization_id_idx").on(table.organizationId),
    index("emails_created_at_idx").on(table.createdAt),
  ]
);

// Email Triggers - Email triggers for workflows
export const emailTriggers = pgTable(
  "email_triggers",
  {
    workflowId: text("workflow_id")
      .primaryKey()
      .references(() => workflows.id, { onDelete: "cascade" }),
    emailId: text("email_id")
      .notNull()
      .references(() => emails.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("email_triggers_workflow_id_idx").on(table.workflowId),
    index("email_triggers_email_id_idx").on(table.emailId),
    index("email_triggers_active_idx").on(table.active),
    index("email_triggers_created_at_idx").on(table.createdAt),
    index("email_triggers_updated_at_idx").on(table.updatedAt),
  ]
);

// Inboxes - Logical inboxes (e.g. "support"). The `id` is the opaque UUID used
// as the top-level R2 key segment so the bucket layout doesn't depend on the
// alias; renaming an inbox doesn't move any data. The handler that decides
// which inbox an inbound message belongs to looks the row up by `alias`.
export const inboxes = pgTable(
  "inboxes",
  {
    id: text("id").primaryKey(),
    alias: text("alias").notNull().unique(),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [index("inboxes_alias_idx").on(table.alias)]
);

// Threads - Conversations in the admin inbox (e.g. support email). One row per
// distinct conversation, threaded by RFC 5322 In-Reply-To / References, with
// subject + fromEmail as a fallback. Only minimal metadata lives here; raw
// MIME, parsed bodies, and attachments live in R2 under `{inboxId}/...`.
export const threads = pgTable(
  "threads",
  {
    id: text("id").primaryKey(),
    // `.notNull()` is TS-only; SQL column is nullable (migration 0059).
    inboxId: text("inbox_id")
      .notNull()
      .references(() => inboxes.id, { onDelete: "restrict" }),
    subject: text("subject").notNull(),
    fromEmail: text("from_email").notNull(),
    fromName: text("from_name"),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    organizationId: text("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("threads_inbox_id_idx").on(table.inboxId),
    index("threads_archived_at_idx").on(table.archivedAt),
    index("threads_last_message_at_idx").on(table.lastMessageAt),
    index("threads_from_email_idx").on(table.fromEmail),
    index("threads_user_id_idx").on(table.userId),
    index("threads_organization_id_idx").on(table.organizationId),
    index("threads_created_at_idx").on(table.createdAt),
  ]
);

// Messages - Individual emails within a thread. `id` is our internal UUID and
// also the R2 key prefix; `rfc822MessageId` is the RFC 5322 Message-ID used for
// threading lookups against incoming In-Reply-To / References headers.
export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    direction: text("direction").$type<MessageDirectionType>().notNull(),
    rfc822MessageId: text("rfc822_message_id").notNull().unique(),
    inReplyTo: text("in_reply_to"),
    referencesChain: text("references_chain"),
    fromEmail: text("from_email").notNull(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    snippet: text("snippet").notNull().default(""),
    hasHtml: boolean("has_html").notNull().default(false),
    hasText: boolean("has_text").notNull().default(false),
    attachmentCount: integer("attachment_count").notNull().default(0),
    rawR2Key: text("raw_r2_key").notNull(),
    authorAdminUserId: text("author_admin_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createCreatedAt(),
  },
  (table) => [
    index("messages_thread_id_idx").on(table.threadId),
    index("messages_rfc822_message_id_idx").on(table.rfc822MessageId),
    index("messages_direction_idx").on(table.direction),
    index("messages_created_at_idx").on(table.createdAt),
  ]
);

// Thread reads - Per-admin read state. One row per (thread, admin user)
// pair, tracking the last time that admin opened the thread. Used to surface
// an unread count and badge in the admin UI.
export const threadReads = pgTable(
  "thread_reads",
  {
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.threadId, table.userId] }),
    index("thread_reads_user_id_idx").on(table.userId),
    index("thread_reads_thread_id_idx").on(table.threadId),
  ]
);

// Attachments - File parts of a message, stored in R2 with metadata indexed
// here. `contentId` enables inline references in HTML bodies.
export const attachments = pgTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    r2Key: text("r2_key").notNull(),
    contentId: text("content_id"),
    createdAt: createCreatedAt(),
  },
  (table) => [
    index("attachments_message_id_idx").on(table.messageId),
    index("attachments_content_id_idx").on(table.contentId),
  ]
);

// Discord Bots - User-provided Discord bots associated with organizations
// Bots - Unified table for all bot types (Discord, Telegram, WhatsApp, Slack)
export const bots = pgTable(
  "bots",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    provider: text("provider").$type<BotProviderType>().notNull(),
    encryptedToken: text("encrypted_token").notNull(),
    tokenLastFour: text("token_last_four").notNull(),
    metadata: text("metadata"), // JSON for provider-specific plain data
    encryptedMetadata: text("encrypted_metadata"), // JSON for provider-specific encrypted fields
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("bots_name_idx").on(table.name),
    index("bots_provider_idx").on(table.provider),
    index("bots_organization_id_idx").on(table.organizationId),
    index("bots_created_at_idx").on(table.createdAt),
  ]
);

// Bot Triggers - Unified table for all bot-based workflow triggers
export const botTriggers = pgTable(
  "bot_triggers",
  {
    workflowId: text("workflow_id")
      .primaryKey()
      .references(() => workflows.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    botId: text("bot_id").references(() => bots.id, {
      onDelete: "set null",
    }),
    provider: text("provider").$type<BotProviderType>().notNull(),
    metadata: text("metadata"), // JSON for provider-specific trigger config
    active: boolean("active").notNull().default(true),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("bot_triggers_organization_id_idx").on(table.organizationId),
    index("bot_triggers_bot_id_idx").on(table.botId),
    index("bot_triggers_provider_idx").on(table.provider),
    index("bot_triggers_active_idx").on(table.active),
    index("bot_triggers_created_at_idx").on(table.createdAt),
    index("bot_triggers_updated_at_idx").on(table.updatedAt),
  ]
);

// Secrets - Encrypted secrets associated with organizations
export const secrets = pgTable(
  "secrets",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    encryptedValue: text("encrypted_value").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("secrets_name_idx").on(table.name),
    index("secrets_organization_id_idx").on(table.organizationId),
    index("secrets_created_at_idx").on(table.createdAt),
    // Ensure unique secret names per organization
    uniqueIndex("secrets_organization_id_name_unique_idx").on(
      table.organizationId,
      table.name
    ),
  ]
);

// Invitations - Pending invitations to join organizations
export const invitations = pgTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role")
      .$type<OrganizationRoleType>()
      .notNull()
      .default(OrganizationRole.MEMBER),
    permissions: jsonb("permissions").$type<Record<string, unknown> | null>(),
    status: text("status")
      .$type<InvitationStatusType>()
      .notNull()
      .default(InvitationStatus.PENDING),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("invitations_email_idx").on(table.email),
    index("invitations_organization_id_idx").on(table.organizationId),
    index("invitations_status_idx").on(table.status),
    index("invitations_invited_by_idx").on(table.invitedBy),
    index("invitations_expires_at_idx").on(table.expiresAt),
    index("invitations_created_at_idx").on(table.createdAt),
    // Ensure unique pending invitation per email per organization
    uniqueIndex("invitations_organization_id_email_status_unique_idx").on(
      table.organizationId,
      table.email,
      table.status
    ),
  ]
);

// Integrations - Third-party service connections with OAuth tokens
export const integrations = pgTable(
  "integrations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    provider: text("provider").$type<IntegrationProviderType>().notNull(),
    status: text("status")
      .$type<IntegrationStatusType>()
      .notNull()
      .default(IntegrationStatus.ACTIVE),
    encryptedToken: text("encrypted_token").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true, mode: "date" }),
    metadata: text("metadata"), // JSON for provider-specific data
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdAt: createCreatedAt(),
    updatedAt: createUpdatedAt(),
  },
  (table) => [
    index("integrations_name_idx").on(table.name),
    index("integrations_provider_idx").on(table.provider),
    index("integrations_status_idx").on(table.status),
    index("integrations_organization_id_idx").on(table.organizationId),
    index("integrations_created_at_idx").on(table.createdAt),
    // Ensure unique integration names per organization per provider
    // This allows the same name (e.g., email) across different providers
    uniqueIndex("integrations_organization_id_name_provider_unique_idx").on(
      table.organizationId,
      table.name,
      table.provider
    ),
  ]
);

/**
 * RELATION DEFINITIONS
 */

export const usersRelations = relations(users, ({ many, one }) => ({
  memberships: many(memberships),
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));

export const organizationsRelations = relations(
  organizations,
  ({ many, one }) => ({
    memberships: many(memberships),
    workflows: many(workflows),
    apiKeys: many(apiKeys),
    datasets: many(datasets),
    feedbackCriteria: many(feedbackCriteria),
    feedback: many(feedback),
    queues: many(queues),
    databases: many(databases),
    emails: many(emails),
    secrets: many(secrets),
    bots: many(bots),
    integrations: many(integrations),
    invitations: many(invitations),
    users: one(users),
  })
);

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  organization: one(organizations, {
    fields: [apiKeys.organizationId],
    references: [organizations.id],
  }),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workflows.organizationId],
    references: [organizations.id],
  }),
  folder: one(workflowFolders, {
    fields: [workflows.folderId],
    references: [workflowFolders.id],
  }),
  scheduledTrigger: one(scheduledTriggers, {
    fields: [workflows.id],
    references: [scheduledTriggers.workflowId],
  }),
  queueTrigger: one(queueTriggers, {
    fields: [workflows.id],
    references: [queueTriggers.workflowId],
  }),
  emailTrigger: one(emailTriggers, {
    fields: [workflows.id],
    references: [emailTriggers.workflowId],
  }),
  botTrigger: one(botTriggers, {
    fields: [workflows.id],
    references: [botTriggers.workflowId],
  }),
  feedbackCriteria: many(feedbackCriteria),
}));

export const workflowFoldersRelations = relations(
  workflowFolders,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [workflowFolders.organizationId],
      references: [organizations.id],
    }),
    workflows: many(workflows),
  })
);

export const scheduledTriggersRelations = relations(
  scheduledTriggers,
  ({ one }) => ({
    workflow: one(workflows, {
      fields: [scheduledTriggers.workflowId],
      references: [workflows.id],
    }),
  })
);

export const datasetsRelations = relations(datasets, ({ one }) => ({
  organization: one(organizations, {
    fields: [datasets.organizationId],
    references: [organizations.id],
  }),
}));

export const feedbackCriteriaRelations = relations(
  feedbackCriteria,
  ({ one, many }) => ({
    workflow: one(workflows, {
      fields: [feedbackCriteria.workflowId],
      references: [workflows.id],
    }),
    organization: one(organizations, {
      fields: [feedbackCriteria.organizationId],
      references: [organizations.id],
    }),
    feedbacks: many(feedback),
  })
);

export const feedbackRelations = relations(feedback, ({ one }) => ({
  organization: one(organizations, {
    fields: [feedback.organizationId],
    references: [organizations.id],
  }),
  workflow: one(workflows, {
    fields: [feedback.workflowId],
    references: [workflows.id],
  }),
  user: one(users, {
    fields: [feedback.userId],
    references: [users.id],
  }),
  criterion: one(feedbackCriteria, {
    fields: [feedback.criterionId],
    references: [feedbackCriteria.id],
  }),
}));

export const queuesRelations = relations(queues, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [queues.organizationId],
    references: [organizations.id],
  }),
  queueTriggers: many(queueTriggers),
}));

export const queueTriggersRelations = relations(queueTriggers, ({ one }) => ({
  workflow: one(workflows, {
    fields: [queueTriggers.workflowId],
    references: [workflows.id],
  }),
  queue: one(queues, {
    fields: [queueTriggers.queueId],
    references: [queues.id],
  }),
}));

export const databasesRelations = relations(databases, ({ one }) => ({
  organization: one(organizations, {
    fields: [databases.organizationId],
    references: [organizations.id],
  }),
}));

export const emailsRelations = relations(emails, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [emails.organizationId],
    references: [organizations.id],
  }),
  emailTriggers: many(emailTriggers),
}));

export const emailTriggersRelations = relations(emailTriggers, ({ one }) => ({
  workflow: one(workflows, {
    fields: [emailTriggers.workflowId],
    references: [workflows.id],
  }),
  email: one(emails, {
    fields: [emailTriggers.emailId],
    references: [emails.id],
  }),
}));

export const threadsRelations = relations(threads, ({ one, many }) => ({
  user: one(users, {
    fields: [threads.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [threads.organizationId],
    references: [organizations.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  thread: one(threads, {
    fields: [messages.threadId],
    references: [threads.id],
  }),
  authorAdminUser: one(users, {
    fields: [messages.authorAdminUserId],
    references: [users.id],
  }),
  attachments: many(attachments),
}));

export const threadReadsRelations = relations(threadReads, ({ one }) => ({
  thread: one(threads, {
    fields: [threadReads.threadId],
    references: [threads.id],
  }),
  user: one(users, {
    fields: [threadReads.userId],
    references: [users.id],
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  message: one(messages, {
    fields: [attachments.messageId],
    references: [messages.id],
  }),
}));

export const botsRelations = relations(bots, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [bots.organizationId],
    references: [organizations.id],
  }),
  botTriggers: many(botTriggers),
}));

export const botTriggersRelations = relations(botTriggers, ({ one }) => ({
  workflow: one(workflows, {
    fields: [botTriggers.workflowId],
    references: [workflows.id],
  }),
  bot: one(bots, {
    fields: [botTriggers.botId],
    references: [bots.id],
  }),
}));

export const secretsRelations = relations(secrets, ({ one }) => ({
  organization: one(organizations, {
    fields: [secrets.organizationId],
    references: [organizations.id],
  }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  organization: one(organizations, {
    fields: [integrations.organizationId],
    references: [organizations.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  inviter: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

/**
 * HELPER FUNCTIONS
 */

// Updates the updatedAt timestamp for record modifications
export function withUpdatedTimestamp<T extends Record<string, any>>(
  data: T
): T & { updatedAt: Date } {
  return {
    ...data,
    updatedAt: new Date(),
  };
}

/**
 * TYPE EXPORTS
 */

export type OrganizationRow = typeof organizations.$inferSelect;
export type OrganizationInsert = typeof organizations.$inferInsert;

export type MembershipRow = typeof memberships.$inferSelect;
export type MembershipInsert = typeof memberships.$inferInsert;

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type ApiKeyInsert = typeof apiKeys.$inferInsert;

export type WorkflowRow = typeof workflows.$inferSelect;
export type WorkflowFolderRow = typeof workflowFolders.$inferSelect;
export type WorkflowInsert = typeof workflows.$inferInsert;

export type ScheduledTriggerRow = typeof scheduledTriggers.$inferSelect;
export type ScheduledTriggerInsert = typeof scheduledTriggers.$inferInsert;

export type DatasetRow = typeof datasets.$inferSelect;
export type DatasetInsert = typeof datasets.$inferInsert;

export type FeedbackCriteriaRow = typeof feedbackCriteria.$inferSelect;
export type FeedbackCriteriaInsert = typeof feedbackCriteria.$inferInsert;

export type FeedbackRow = typeof feedback.$inferSelect;
export type FeedbackInsert = typeof feedback.$inferInsert;

export type QueueRow = typeof queues.$inferSelect;
export type QueueInsert = typeof queues.$inferInsert;

export type QueueTriggerRow = typeof queueTriggers.$inferSelect;
export type QueueTriggerInsert = typeof queueTriggers.$inferInsert;

export type DatabaseRow = typeof databases.$inferSelect;
export type DatabaseInsert = typeof databases.$inferInsert;

export type EmailRow = typeof emails.$inferSelect;
export type EmailInsert = typeof emails.$inferInsert;

export type EmailTriggerRow = typeof emailTriggers.$inferSelect;
export type EmailTriggerInsert = typeof emailTriggers.$inferInsert;

export type BotRow = typeof bots.$inferSelect;
export type BotInsert = typeof bots.$inferInsert;

export type BotTriggerRow = typeof botTriggers.$inferSelect;
export type BotTriggerInsert = typeof botTriggers.$inferInsert;

export type SecretRow = typeof secrets.$inferSelect;
export type SecretInsert = typeof secrets.$inferInsert;

export type IntegrationRow = typeof integrations.$inferSelect;
export type IntegrationInsert = typeof integrations.$inferInsert;

export type InvitationRow = typeof invitations.$inferSelect;
export type InvitationInsert = typeof invitations.$inferInsert;

export type ThreadRow = typeof threads.$inferSelect;
export type ThreadInsert = typeof threads.$inferInsert;

export type MessageRow = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;

export type AttachmentRow = typeof attachments.$inferSelect;
export type AttachmentInsert = typeof attachments.$inferInsert;

export type ThreadReadRow = typeof threadReads.$inferSelect;
export type ThreadReadInsert = typeof threadReads.$inferInsert;

export type PlatformSettingsRow = typeof platformSettings.$inferSelect;
export type PlatformSettingsInsert = typeof platformSettings.$inferInsert;

export type WorkflowSchemeRow = typeof workflowSchemes.$inferSelect;
export type WorkflowSchemeInsert = typeof workflowSchemes.$inferInsert;

export type FormatTransformTemplateRow =
  typeof formatTransformTemplates.$inferSelect;
export type FormatTransformTemplateInsert =
  typeof formatTransformTemplates.$inferInsert;
