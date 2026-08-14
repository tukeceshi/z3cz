/** Build-time prefetch pack module roots (Vite manifest keys). */

export interface PrefetchPackDefinition {
  readonly modules: readonly string[];
}

export const PREFETCH_PACK_DEFINITIONS: Readonly<
  Record<string, PrefetchPackDefinition>
> = {
  shared: {
    modules: [
      "src/components/layouts/inset-layout.tsx",
      "src/components/layouts/app-layout.tsx",
      "src/components/org-layout.tsx",
      "src/components/inset-loading.tsx",
      "src/components/route-page-fallback.tsx",
      "src/components/org-permission-gate.tsx",
    ],
  },
  dashboard: {
    modules: ["src/pages/dashboard-page.tsx"],
  },
  workflows: {
    modules: [
      "src/pages/workflows-page.tsx",
      "src/pages/workflow-folder-page.tsx",
      "src/components/workflow/workflow-library-view.tsx",
    ],
  },
  executions: {
    modules: [
      "src/pages/executions-page.tsx",
      "src/pages/execution-detail-page.tsx",
    ],
  },
  templates: {
    modules: [
      "src/pages/templates-page.tsx",
      "src/pages/template-detail-page.tsx",
      "src/pages/template-try-page.tsx",
    ],
  },
  "model-calls": {
    modules: ["src/pages/model-calls-page.tsx"],
  },
  editor: {
    modules: [
      "src/pages/editor-page.tsx",
      "src/components/workflow/workflow-builder.tsx",
    ],
  },
  settings: {
    modules: [
      "src/pages/organization-ai-interfaces-page.tsx",
      "src/pages/integrations-page.tsx",
      "src/pages/secrets-page.tsx",
      "src/pages/members-page.tsx",
      "src/pages/api-keys-page.tsx",
      "src/pages/billing-page.tsx",
    ],
  },
};

export const ROUTE_TO_PREFETCH_PACKS: Readonly<
  Record<string, readonly string[]>
> = {
  DashboardPage: ["dashboard"],
  WorkflowsPage: ["workflows"],
  WorkflowFolderPage: ["workflows"],
  ExecutionsPage: ["executions"],
  ExecutionDetailPage: ["executions"],
  TemplatesPage: ["templates"],
  TemplateDetailPage: ["templates"],
  TemplateTryPage: ["templates"],
  ModelCallsPage: ["model-calls"],
  EditorPage: ["editor"],
  OrganizationAiInterfacesPage: ["settings"],
  IntegrationsPage: ["settings"],
  SecretsPage: ["settings"],
  MembersPage: ["settings"],
  ApiKeysPage: ["settings"],
  BillingPage: ["settings"],
};

export const ALL_PREFETCH_PACK_IDS = Object.keys(
  PREFETCH_PACK_DEFINITIONS
) as (keyof typeof PREFETCH_PACK_DEFINITIONS)[];
