import { lazyRoutePage } from "@/components/lazy-route-page";

// Admin
export const AdminDashboardPage = lazyRoutePage(
  () => import("@/pages/admin/admin-dashboard-page"),
  "AdminDashboardPage"
);
export const AdminUsersPage = lazyRoutePage(
  () => import("@/pages/admin/admin-users-page"),
  "AdminUsersPage"
);
export const AdminStuckUsersPage = lazyRoutePage(
  () => import("@/pages/admin/admin-stuck-users-page"),
  "AdminStuckUsersPage"
);
export const AdminUserDetailPage = lazyRoutePage(
  () => import("@/pages/admin/admin-user-detail-page"),
  "AdminUserDetailPage"
);
export const AdminOrganizationRedirectPage = lazyRoutePage(
  () => import("@/pages/admin/admin-organization-redirect-page"),
  "AdminOrganizationRedirectPage"
);
export const AdminWorkflowsPage = lazyRoutePage(
  () => import("@/pages/admin/admin-workflows-page"),
  "AdminWorkflowsPage"
);
export const AdminWorkflowDetailPage = lazyRoutePage(
  () => import("@/pages/admin/admin-workflow-detail-page"),
  "AdminWorkflowDetailPage"
);
export const AdminExecutionsPage = lazyRoutePage(
  () => import("@/pages/admin/admin-executions-page"),
  "AdminExecutionsPage"
);
export const AdminExecutionDetailPage = lazyRoutePage(
  () => import("@/pages/admin/admin-execution-detail-page"),
  "AdminExecutionDetailPage"
);
export const AdminEmailsPage = lazyRoutePage(
  () => import("@/pages/admin/admin-emails-page"),
  "AdminEmailsPage"
);
export const AdminSupportPage = lazyRoutePage(
  () => import("@/pages/admin/admin-support-page"),
  "AdminSupportPage"
);
export const AdminQueuesPage = lazyRoutePage(
  () => import("@/pages/admin/admin-queues-page"),
  "AdminQueuesPage"
);
export const AdminDatasetsPage = lazyRoutePage(
  () => import("@/pages/admin/admin-datasets-page"),
  "AdminDatasetsPage"
);
export const AdminAiModelsPage = lazyRoutePage(
  () => import("@/pages/admin/admin-ai-models-page"),
  "AdminAiModelsPage"
);
export const AdminModelInvocationsPage = lazyRoutePage(
  () => import("@/pages/admin/admin-model-invocations-page"),
  "AdminModelInvocationsPage"
);
export const AdminFeatureSettingsPage = lazyRoutePage(
  () => import("@/pages/admin/admin-feature-settings-page"),
  "AdminFeatureSettingsPage"
);
export const AdminSettingsPage = lazyRoutePage(
  () => import("@/pages/admin/admin-settings-page"),
  "AdminSettingsPage"
);
export const AdminLoginMethodsPage = lazyRoutePage(
  () => import("@/pages/admin/admin-login-methods-page"),
  "AdminLoginMethodsPage"
);
export const AdminLegalDocumentsPage = lazyRoutePage(
  () => import("@/pages/admin/admin-legal-documents-page"),
  "AdminLegalDocumentsPage"
);
export const AdminWorkflowSchemesPage = lazyRoutePage(
  () => import("@/pages/admin/admin-workflow-schemes-page"),
  "AdminWorkflowSchemesPage"
);
export const AdminPersistWorkersPage = lazyRoutePage(
  () => import("@/pages/admin/admin-persist-workers-page"),
  "AdminPersistWorkersPage"
);
export const AdminDatabasesPage = lazyRoutePage(
  () => import("@/pages/admin/admin-databases-page"),
  "AdminDatabasesPage"
);

// Org app pages
export const ProfilePage = lazyRoutePage(
  () => import("@/pages/profile-page"),
  "ProfilePage"
);
export const DashboardPage = lazyRoutePage(
  () => import("@/pages/dashboard-page"),
  "DashboardPage"
);
export const WorkflowsPage = lazyRoutePage(
  () => import("@/pages/workflows-page"),
  "WorkflowsPage"
);
export const WorkflowFolderPage = lazyRoutePage(
  () => import("@/pages/workflow-folder-page"),
  "WorkflowFolderPage"
);
export const TemplatesPage = lazyRoutePage(
  () => import("@/pages/templates-page"),
  "TemplatesPage"
);
export const TemplateDetailPage = lazyRoutePage(
  () => import("@/pages/template-detail-page"),
  "TemplateDetailPage"
);
export const TemplateTryPage = lazyRoutePage(
  () => import("@/pages/template-try-page"),
  "TemplateTryPage"
);
export const ExecutionsPage = lazyRoutePage(
  () => import("@/pages/executions-page"),
  "ExecutionsPage"
);
export const ModelCallsPage = lazyRoutePage(
  () => import("@/pages/model-calls-page"),
  "ModelCallsPage"
);
export const DatasetsPage = lazyRoutePage(
  () => import("@/pages/datasets-page"),
  "DatasetsPage"
);
export const ApiKeysPage = lazyRoutePage(
  () => import("@/pages/api-keys-page"),
  "ApiKeysPage"
);
export const BillingPage = lazyRoutePage(
  () => import("@/pages/billing-page"),
  "BillingPage"
);
export const MembersPage = lazyRoutePage(
  () => import("@/pages/members-page"),
  "MembersPage"
);
export const SecretsPage = lazyRoutePage(
  () => import("@/pages/secrets-page"),
  "SecretsPage"
);
export const OrganizationAiInterfacesPage = lazyRoutePage(
  () => import("@/pages/organization-ai-interfaces-page"),
  "OrganizationAiInterfacesPage"
);
export const IntegrationsPage = lazyRoutePage(
  () => import("@/pages/integrations-page"),
  "IntegrationsPage"
);
export const DatasetDetailPage = lazyRoutePage(
  () => import("@/pages/dataset-detail-page"),
  "DatasetDetailPage"
);
export const DatabasesPage = lazyRoutePage(
  () => import("@/pages/databases-page"),
  "DatabasesPage"
);
export const DatabaseConsolePage = lazyRoutePage(
  () => import("@/pages/database-console-page"),
  "DatabaseConsolePage"
);
export const DatabaseExplorerPage = lazyRoutePage(
  () => import("@/pages/database-explorer-page"),
  "DatabaseExplorerPage"
);
export const SchemasPage = lazyRoutePage(
  () => import("@/pages/schemas-page"),
  "SchemasPage"
);
export const QueuesPage = lazyRoutePage(
  () => import("@/pages/queues-page"),
  "QueuesPage"
);
export const EmailsPage = lazyRoutePage(
  () => import("@/pages/emails-page"),
  "EmailsPage"
);
export const EmailInboxPage = lazyRoutePage(
  () => import("@/pages/email-inbox-page"),
  "EmailInboxPage"
);
export const BotsPage = lazyRoutePage(
  () => import("@/pages/bots-page"),
  "BotsPage"
);
export const BotDiscordDetailPage = lazyRoutePage(
  () => import("@/pages/bot-discord-detail-page"),
  "BotDiscordDetailPage"
);
export const BotTelegramDetailPage = lazyRoutePage(
  () => import("@/pages/bot-telegram-detail-page"),
  "BotTelegramDetailPage"
);
export const BotSlackDetailPage = lazyRoutePage(
  () => import("@/pages/bot-slack-detail-page"),
  "BotSlackDetailPage"
);
export const BotWhatsAppDetailPage = lazyRoutePage(
  () => import("@/pages/bot-whatsapp-detail-page"),
  "BotWhatsAppDetailPage"
);
export const ExecutionDetailPage = lazyRoutePage(
  () => import("@/pages/execution-detail-page"),
  "ExecutionDetailPage"
);
export const PlaygroundPage = lazyRoutePage(
  () => import("@/pages/playground-page"),
  "PlaygroundPage"
);
export const PlaygroundExecutePage = lazyRoutePage(
  () => import("@/pages/playground-execute-page"),
  "PlaygroundExecutePage"
);
export const EditorPage = lazyRoutePage(
  () => import("@/pages/editor-page"),
  "EditorPage"
);

// Public standalone pages
export const FormPage = lazyRoutePage(
  () => import("@/pages/form-page"),
  "FormPage",
  "full"
);
export const FormTriggerPage = lazyRoutePage(
  () => import("@/pages/form-trigger-page"),
  "FormTriggerPage",
  "full"
);
export const TemplatePreviewPage = lazyRoutePage(
  () => import("@/pages/template-preview-page"),
  "TemplatePreviewPage",
  "full"
);
export const NotFoundPage = lazyRoutePage(
  () => import("@/pages/not-found-page"),
  "NotFoundPage"
);
