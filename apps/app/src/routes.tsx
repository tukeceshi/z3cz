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
import {
  AdminAiModelsPage,
  AdminDashboardPage,
  AdminExecutionDetailPage,
  AdminExecutionsPage,
  AdminModelInvocationsPage,
  AdminPersistWorkersPage,
  AdminOrganizationRedirectPage,
  AdminSettingsPage,
  AdminLoginMethodsPage,
  AdminBootstrapPage,
  AdminLegalDocumentsPage,
  AdminStuckUsersPage,
  AdminSupportPage,
  AdminUserDetailPage,
  AdminUsersPage,
  AdminWorkflowDetailPage,
  AdminWorkflowSchemesPage,
  AdminWorkflowsPage,
  ApiKeysPage,
  BillingPage,
  BotDiscordDetailPage,
  BotSlackDetailPage,
  BotTelegramDetailPage,
  BotWhatsAppDetailPage,
  BotsPage,
  DashboardPage,
  DatabaseConsolePage,
  DatabaseExplorerPage,
  DatabasesPage,
  EditorPage,
  EmailsPage,
  ExecutionDetailPage,
  ExecutionsPage,
  FormPage,
  FormTriggerPage,
  IntegrationsPage,
  MembersPage,
  ModelCallsPage,
  NotFoundPage,
  OrganizationAiInterfacesPage,
  ProfilePage,
  QueuesPage,
  SchemasPage,
  SecretsPage,
  TemplateDetailPage,
  TemplatePreviewPage,
  TemplateTryPage,
  TemplatesPage,
  WorkflowFolderPage,
  WorkflowsPage,
} from "./lazy-pages";
import { LoginPage } from "./pages/login-page";

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
    element: <Navigate to="/admin/users" replace />,
  },
  {
    path: "/admin/organizations/:organizationId",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminOrganizationRedirectPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
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
    path: "/admin/persist-workers",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminPersistWorkersPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminPersistWorkers") },
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
    path: "/admin/login-methods",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminLoginMethodsPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminLoginMethods") },
  },
  {
    path: "/admin/bootstrap",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminBootstrapPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminBootstrap") },
  },
  {
    path: "/admin/legal-documents",
    element: (
      <AdminLayout>
        <AdminProtectedRoute>
          <AdminLegalDocumentsPage />
        </AdminProtectedRoute>
      </AdminLayout>
    ),
    handle: { head: createRouteHead("seo.routes.adminLegalDocuments") },
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
    path: "/org",
    element: <OrgRedirect to="/org/:organizationId/dashboard" />,
  },
  {
    path: "/settings/organizations",
    element: <OrgRedirect to="/org/:organizationId/members" />,
  },
  {
    path: "/settings/invitations",
    element: <OrgRedirect to="/org/:organizationId/members" />,
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
    path: "/org/:organizationId/workflows/folders/:folderId",
    element: (
      <OrgLayout title="Workflows">
        <ProtectedRoute>
          <WorkflowFolderPage />
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
    path: "/org/:organizationId/workflows/:id",
    element: (
      <OrgLayout title="Workflows">
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
