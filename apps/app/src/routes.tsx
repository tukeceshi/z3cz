import { SettingsLayout } from "./components/settings-layout";
import type { RouteObject, RouterState } from "react-router";
import { Navigate } from "react-router";

import { AdminProtectedRoute } from "./components/admin-protected-route";
import { createRouteHead } from "./components/route-head";
import { AdminLayout } from "./components/layouts/admin-layout";
import { AppLayout } from "./components/layouts/app-layout";
import { OrgLayout } from "./components/org-layout";
import { OrgFeatureRoute } from "./components/org-feature-route";
import { HomeRedirect } from "./components/home-redirect";
import { OrgRedirect } from "./components/org-redirect";
import { ProtectedRoute } from "./components/protected-route";
import { AdminDashboardPage } from "./pages/admin/admin-dashboard-page";
import { AdminDatabasesPage } from "./pages/admin/admin-databases-page";
import { AdminDatasetsPage } from "./pages/admin/admin-datasets-page";

import { AdminEmailsPage } from "./pages/admin/admin-emails-page";
import { AdminExecutionDetailPage } from "./pages/admin/admin-execution-detail-page";
import { AdminExecutionsPage } from "./pages/admin/admin-executions-page";
import { AdminOrganizationDetailPage } from "./pages/admin/admin-organization-detail-page";
import { AdminOrganizationsPage } from "./pages/admin/admin-organizations-page";
import { AdminQueuesPage } from "./pages/admin/admin-queues-page";
import { AdminSettingsPage } from "./pages/admin/admin-settings-page";
import { AdminAiModelsPage } from "./pages/admin/admin-ai-models-page";
import { AdminModelInvocationsPage } from "./pages/admin/admin-model-invocations-page";
import { AdminFeatureSettingsPage } from "./pages/admin/admin-feature-settings-page";
import { AdminStuckUsersPage } from "./pages/admin/admin-stuck-users-page";
import { AdminSupportPage } from "./pages/admin/admin-support-page";
import { AdminPlatformRelayAccountsPage } from "./pages/admin/admin-platform-relay-accounts-page";
import { AdminWorkflowSchemesPage } from "./pages/admin/admin-workflow-schemes-page";
import { AdminUserDetailPage } from "./pages/admin/admin-user-detail-page";
import { AdminUsersPage } from "./pages/admin/admin-users-page";
import { AdminWorkflowDetailPage } from "./pages/admin/admin-workflow-detail-page";
import { AdminWorkflowsPage } from "./pages/admin/admin-workflows-page";
import { ApiKeysPage } from "./pages/api-keys-page";
import { BillingPage } from "./pages/billing-page";
import { BotDiscordDetailPage } from "./pages/bot-discord-detail-page";
import { BotSlackDetailPage } from "./pages/bot-slack-detail-page";
import { BotTelegramDetailPage } from "./pages/bot-telegram-detail-page";
import { BotWhatsAppDetailPage } from "./pages/bot-whatsapp-detail-page";
import { BotsPage } from "./pages/bots-page";
import { DashboardPage } from "./pages/dashboard-page";
import { DatabaseConsolePage } from "./pages/database-console-page";
import { DatabaseExplorerPage } from "./pages/database-explorer-page";
import { DatabasesPage } from "./pages/databases-page";
import { DatasetDetailPage } from "./pages/dataset-detail-page";
import { DatasetsPage } from "./pages/datasets-page";

import { EditorPage } from "./pages/editor-page";
import { EmailInboxPage } from "./pages/email-inbox-page";
import { EmailsPage } from "./pages/emails-page";
import { ExecutionDetailPage } from "./pages/execution-detail-page";
import { ModelCallsPage } from "./pages/model-calls-page";
import { ExecutionsPage } from "./pages/executions-page";
import { FeedbackFormPage } from "./pages/feedback-form-page";
import { FeedbackPage } from "./pages/feedback-page";
import { FormPage } from "./pages/form-page";
import { FormTriggerPage } from "./pages/form-trigger-page";
import { IntegrationsPage } from "./pages/integrations-page";
import { InvitationsPage } from "./pages/invitations-page";
import { LoginPage } from "./pages/login-page";
import { MembersPage } from "./pages/members-page";
import { NotFoundPage } from "./pages/not-found-page";
import { OrganizationsPage } from "./pages/organizations-page";
import { PlaygroundExecutePage } from "./pages/playground-execute-page";
import { PlaygroundPage } from "./pages/playground-page";
import { ProfilePage } from "./pages/profile-page";
import { QueuesPage } from "./pages/queues-page";
import { SchemasPage } from "./pages/schemas-page";
import { SecretsPage } from "./pages/secrets-page";
import { OrganizationAiInterfacesPage } from "./pages/organization-ai-interfaces-page";
import { TemplateDetailPage } from "./pages/template-detail-page";
import { TemplatePreviewPage } from "./pages/template-preview-page";
import { TemplateTryPage } from "./pages/template-try-page";
import { TemplatesPage } from "./pages/templates-page";
import { WorkflowsPage } from "./pages/workflows-page";

export interface RouteHandle {
  head?:
    | React.ReactElement
    | ((
        params: Readonly<Record<string, string | undefined>>,
        context: {
          url: URL;
          location: RouterState["location"];
        }
      ) => React.ReactElement);
}

export type AppRouteObject = RouteObject & {
  handle?: RouteHandle;
};

export const routes: AppRouteObject[] = [
  {
    path: "/",
    element: <HomeRedirect />,
  },
  {
    path: "/login",
    element: <LoginPage />,
    handle: {
      head: createRouteHead("seo.routes.login", "seo.routes.loginDescription"),
    },
  },
  {
    path: "/settings",
    element: <Navigate to="/settings/profile" replace />,
  },
  {
    path: "/settings/profile",
    element: (
      <SettingsLayout>
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      </SettingsLayout>
    ),
    handle: { head: createRouteHead("seo.routes.profile") },
  },
  // Admin routes
  {
    path: "/admin",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminDashboardPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminDashboard") },
  },
  {
    path: "/admin/users",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminUsersPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminUsers") },
  },
  {
    path: "/admin/onboarding",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminStuckUsersPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: {
      head: createRouteHead("seo.routes.adminStuckUsers"),
    },
  },
  {
    path: "/admin/users/:userId",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminUserDetailPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminUserDetail") },
  },
  {
    path: "/admin/organizations",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminOrganizationsPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminOrganizations") },
  },
  {
    path: "/admin/organizations/:organizationId",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminOrganizationDetailPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: {
      head: createRouteHead("seo.routes.adminOrganizationDetail"),
    },
  },
  {
    path: "/admin/workflows",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminWorkflowsPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminWorkflows") },
  },
  {
    path: "/admin/workflows/:workflowId",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminWorkflowDetailPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: {
      head: createRouteHead("seo.routes.adminWorkflowDetail"),
    },
  },

  {
    path: "/admin/executions",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminExecutionsPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminExecutions") },
  },
  {
    path: "/admin/executions/:executionId",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminExecutionDetailPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: {
      head: createRouteHead("seo.routes.adminExecutionDetail"),
    },
  },
  {
    path: "/admin/emails",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminEmailsPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminEmails") },
  },
  {
    path: "/admin/support",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminSupportPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminSupport") },
  },
  {
    path: "/admin/queues",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminQueuesPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminQueues") },
  },
  {
    path: "/admin/datasets",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminDatasetsPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminDatasets") },
  },
  {
    path: "/admin/ai-models",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminAiModelsPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminAiModels") },
  },
  {
    path: "/admin/model-invocations",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminModelInvocationsPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminModelInvocations") },
  },
  {
    path: "/admin/feature-settings",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminFeatureSettingsPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminFeatureSettings") },
  },
  {
    path: "/admin/settings",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminSettingsPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminSettings") },
  },
  {
    path: "/admin/workflow-schemes",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminWorkflowSchemesPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminWorkflowSchemes") },
  },
  {
    path: "/admin/platform-relay-accounts",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminPlatformRelayAccountsPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminRelayAccounts") },
  },
  {
    path: "/admin/databases",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminDatabasesPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminDatabases") },
  },
  {
    path: "/org",
    element: <OrgRedirect to="/org/:organizationId/dashboard" />,
  },
  {
    path: "/settings/organizations",
    element: (
      <SettingsLayout>
        <ProtectedRoute>
          <OrganizationsPage />
        </ProtectedRoute>
      </SettingsLayout>
    ),
    handle: { head: createRouteHead("seo.routes.organizations") },
  },
  {
    path: "/settings/invitations",
    element: (
      <SettingsLayout>
        <ProtectedRoute>
          <InvitationsPage />
        </ProtectedRoute>
      </SettingsLayout>
    ),
    handle: { head: createRouteHead("seo.routes.invitations") },
  },
  {
    path: "/org/:organizationId/dashboard",
    element: (
      <OrgLayout title="Dashboard">
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      </OrgLayout>
    ),
    handle: { head: createRouteHead("seo.routes.dashboard") },
  },
  {
    path: "/workflows",
    element: <OrgRedirect to="/org/:organizationId/workflows" />,
  },
  {
    path: "/org/:organizationId/workflows",
    element: (
      <OrgLayout title="Workflows">
        <ProtectedRoute>
          <WorkflowsPage />
        </ProtectedRoute>
      </OrgLayout>
    ),
    handle: { head: createRouteHead("seo.routes.workflows") },
  },
  {
    path: "/templates",
    element: <OrgRedirect to="/org/:organizationId/templates" />,
  },
  {
    path: "/org/:organizationId/templates",
    element: (
      <OrgLayout title="Workflows">
        <ProtectedRoute>
          <TemplatesPage />
        </ProtectedRoute>
      </OrgLayout>
    ),
    handle: { head: createRouteHead("seo.routes.templates") },
  },
  {
    path: "/templates/:templateId",
    element: <OrgRedirect to="/org/:organizationId/templates/:templateId" />,
  },
  {
    path: "/org/:organizationId/templates/:templateId",
    element: (
      <OrgLayout title="Workflows">
        <ProtectedRoute>
          <TemplateDetailPage />
        </ProtectedRoute>
      </OrgLayout>
    ),
    handle: { head: createRouteHead("seo.routes.templateDetail") },
  },
  {
    path: "/templates/:templateId/try",
    element: (
      <OrgRedirect to="/org/:organizationId/templates/:templateId/try" />
    ),
  },
  {
    path: "/org/:organizationId/templates/:templateId/try",
    element: (
      <OrgLayout title="Workflows">
        <ProtectedRoute>
          <TemplateTryPage />
        </ProtectedRoute>
      </OrgLayout>
    ),
    handle: { head: createRouteHead("seo.routes.templateTry") },
  },
  {
    path: "/executions",
    element: <OrgRedirect to="/org/:organizationId/executions" />,
  },
  {
    path: "/org/:organizationId/executions",
    element: (
      <OrgLayout title="Workflows">
        <ProtectedRoute>
          <ExecutionsPage />
        </ProtectedRoute>
      </OrgLayout>
    ),
    handle: { head: createRouteHead("seo.routes.executions") },
  },
  {
    path: "/model-calls",
    element: <OrgRedirect to="/org/:organizationId/model-calls" />,
  },
  {
    path: "/org/:organizationId/model-calls",
    element: (
      <OrgLayout title="Workflows">
        <ProtectedRoute>
          <ModelCallsPage />
        </ProtectedRoute>
      </OrgLayout>
    ),
    handle: { head: createRouteHead("seo.routes.modelCalls") },
  },
  {
    path: "/datasets",
    element: <OrgRedirect to="/org/:organizationId/datasets" />,
  },
  {
    path: "/org/:organizationId/datasets",
    element: (
      <OrgFeatureRoute feature="datasets" title="Datasets">
        <DatasetsPage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.datasets") },
  },
  {
    path: "/feedback",
    element: <OrgRedirect to="/org/:organizationId/feedback" />,
  },
  {
    path: "/org/:organizationId/feedback",
    element: (
      <OrgLayout title="Feedback">
        <ProtectedRoute>
          <FeedbackPage />
        </ProtectedRoute>
      </OrgLayout>
    ),
    handle: { head: createRouteHead("seo.routes.feedback") },
  },
  {
    path: "/api-keys",
    element: <OrgRedirect to="/org/:organizationId/api-keys" />,
  },
  {
    path: "/members",
    element: <OrgRedirect to="/org/:organizationId/members" />,
  },
  {
    path: "/org/:organizationId/api-keys",
    element: (
      <OrgLayout title="Settings">
        <ProtectedRoute>
          <ApiKeysPage />
        </ProtectedRoute>
      </OrgLayout>
    ),
    handle: { head: createRouteHead("seo.routes.apiKeys") },
  },
  {
    path: "/billing",
    element: <OrgRedirect to="/org/:organizationId/billing" />,
  },
  {
    path: "/org/:organizationId/billing",
    element: (
      <OrgLayout title="Settings">
        <ProtectedRoute>
          <BillingPage />
        </ProtectedRoute>
      </OrgLayout>
    ),
    handle: { head: createRouteHead("seo.routes.billing") },
  },
  {
    path: "/org/:organizationId/members",
    element: (
      <OrgLayout title="Organization Members">
        <ProtectedRoute>
          <MembersPage />
        </ProtectedRoute>
      </OrgLayout>
    ),
    handle: { head: createRouteHead("seo.routes.members") },
  },
  {
    path: "/secrets",
    element: <OrgRedirect to="/org/:organizationId/secrets" />,
  },
  {
    path: "/org/:organizationId/secrets",
    element: (
      <OrgFeatureRoute feature="secrets" title="Settings">
        <SecretsPage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.secrets") },
  },
  {
    path: "/org/:organizationId/ai-interfaces",
    element: (
      <OrgFeatureRoute feature="ai-interfaces" title="Settings">
        <OrganizationAiInterfacesPage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.aiInterfaces") },
  },
  {
    path: "/integrations",
    element: <OrgRedirect to="/org/:organizationId/integrations" />,
  },
  {
    path: "/org/:organizationId/integrations",
    element: (
      <OrgFeatureRoute feature="integrations" title="Settings">
        <IntegrationsPage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.integrations") },
  },
  {
    path: "/org/:organizationId/datasets/:datasetId",
    element: (
      <OrgFeatureRoute feature="datasets" title="Datasets">
        <DatasetDetailPage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.datasetDetail") },
  },
  {
    path: "/databases",
    element: <OrgRedirect to="/org/:organizationId/databases" />,
  },
  {
    path: "/org/:organizationId/databases",
    element: (
      <OrgFeatureRoute feature="databases" title="Databases">
        <DatabasesPage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.databases") },
  },
  {
    path: "/org/:organizationId/databases/:id/console",
    element: (
      <OrgFeatureRoute feature="databases" title="Database Console">
        <DatabaseConsolePage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.databaseConsole") },
  },
  {
    path: "/org/:organizationId/databases/:id/explorer",
    element: (
      <OrgFeatureRoute feature="databases" title="Database Explorer">
        <DatabaseExplorerPage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.databaseExplorer") },
  },
  {
    path: "/schemas",
    element: <OrgRedirect to="/org/:organizationId/schemas" />,
  },
  {
    path: "/org/:organizationId/schemas",
    element: (
      <OrgFeatureRoute feature="schemas" title="Schemas">
        <SchemasPage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.schemas") },
  },
  {
    path: "/queues",
    element: <OrgRedirect to="/org/:organizationId/queues" />,
  },
  {
    path: "/org/:organizationId/queues",
    element: (
      <OrgFeatureRoute feature="queues" title="Queues">
        <QueuesPage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.queues") },
  },
  {
    path: "/emails",
    element: <OrgRedirect to="/org/:organizationId/emails" />,
  },
  {
    path: "/org/:organizationId/emails",
    element: (
      <OrgFeatureRoute feature="emails" title="Emails">
        <EmailsPage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.emails") },
  },
  {
    path: "/org/:organizationId/emails/:emailId",
    element: (
      <OrgFeatureRoute feature="emails" title="Emails">
        <EmailInboxPage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.emailInbox") },
  },
  {
    path: "/bots",
    element: <OrgRedirect to="/org/:organizationId/bots" />,
  },
  {
    path: "/discord-bots",
    element: <OrgRedirect to="/org/:organizationId/bots" />,
  },
  {
    path: "/org/:organizationId/discord-bots",
    element: <OrgRedirect to="/org/:organizationId/bots" />,
  },
  {
    path: "/telegram-bots",
    element: <OrgRedirect to="/org/:organizationId/bots" />,
  },
  {
    path: "/org/:organizationId/telegram-bots",
    element: <OrgRedirect to="/org/:organizationId/bots" />,
  },
  {
    path: "/org/:organizationId/bots",
    element: (
      <OrgFeatureRoute feature="bots" title="Bots">
        <BotsPage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.bots") },
  },
  {
    path: "/org/:organizationId/bots/discord/:id",
    element: (
      <OrgFeatureRoute feature="bots" title="Bots">
        <BotDiscordDetailPage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.botDetail") },
  },
  {
    path: "/org/:organizationId/bots/telegram/:id",
    element: (
      <OrgFeatureRoute feature="bots" title="Bots">
        <BotTelegramDetailPage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.botDetail") },
  },
  {
    path: "/org/:organizationId/bots/slack/:id",
    element: (
      <OrgFeatureRoute feature="bots" title="Bots">
        <BotSlackDetailPage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.botDetail") },
  },
  {
    path: "/org/:organizationId/bots/whatsapp/:id",
    element: (
      <OrgFeatureRoute feature="bots" title="Bots">
        <BotWhatsAppDetailPage />
      </OrgFeatureRoute>
    ),
    handle: { head: createRouteHead("seo.routes.botAccountDetail") },
  },

  {
    path: "/org/:organizationId/executions/:executionId",
    element: (
      <OrgLayout title="Workflows">
        <ProtectedRoute>
          <ExecutionDetailPage />
        </ProtectedRoute>
      </OrgLayout>
    ),
    handle: {
      head: createRouteHead("seo.routes.executionDetail"),
    },
  },
  {
    path: "/playground",
    element: <OrgRedirect to="/org/:organizationId/playground" />,
  },
  {
    path: "/playground/:nodeType",
    element: <OrgRedirect to="/org/:organizationId/playground/:nodeType" />,
  },
  {
    path: "/org/:organizationId/playground",
    element: (
      <OrgLayout title="Workflows">
        <ProtectedRoute>
          <PlaygroundPage />
        </ProtectedRoute>
      </OrgLayout>
    ),
    handle: { head: createRouteHead("seo.routes.playground") },
  },
  {
    path: "/org/:organizationId/playground/:nodeType",
    element: (
      <OrgLayout title="Workflows">
        <ProtectedRoute>
          <PlaygroundExecutePage />
        </ProtectedRoute>
      </OrgLayout>
    ),
    handle: { head: createRouteHead("seo.routes.playground") },
  },
  {
    path: "/org/:organizationId/workflows/:id",
    element: (
      <OrgLayout title="Workflows" sidebarDefaultOpen={false}>
        <ProtectedRoute>
          <EditorPage />
        </ProtectedRoute>
      </OrgLayout>
    ),
    handle: { head: createRouteHead("seo.routes.editor") },
  },
  {
    path: "/form/:signedToken",
    element: <FormPage />,
    handle: {
      head: createRouteHead("seo.routes.form"),
    },
  },
  {
    path: "/forms/:workflowId",
    element: <FormTriggerPage />,
    handle: {
      head: createRouteHead("seo.routes.form"),
    },
  },
  {
    path: "/feedback/:signedToken",
    element: <FeedbackFormPage />,
    handle: {
      head: createRouteHead("seo.routes.feedbackForm"),
    },
  },
  {
    path: "/embed/templates/:templateId",
    element: <TemplatePreviewPage />,
    handle: {
      head: createRouteHead("seo.routes.templatePreview"),
    },
  },
  {
    path: "*",
    element: (
      <AppLayout>
        <NotFoundPage />
      </AppLayout>
    ),
    handle: { head: createRouteHead("seo.routes.notFound") },
  },
];
